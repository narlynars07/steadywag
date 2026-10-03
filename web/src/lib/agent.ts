import { tool, type ToolSet } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { z } from "zod";
import { client } from "./sanity";

export type AgentMode = "context-mcp" | "direct";

const SCHEMA_SHEET = `
THE CHART (a public, de-identified Sanity dataset). Query it with GROQ. Document types and useful fields:
- dog: name, breed, birthYear, conditions[]->
- condition: title, status, summary, vetPlan (what the specialist documented)
- medication: name, dose, frequency (q12 = every 12 hours, q24 = once a day), days (mon..sun), status ("active" | "stopped" | "listed-not-given"), startDate, endDate, lastConfirmedOn, notes. A drug that was stopped and restarted has one document per period. lastConfirmedOn is the date of the latest specialist report that still listed the drug as current.
- labTest: code (ALT, ALKP, TRIG, CPL...), name, whatItMeasures
- labResult: date, value, qualifier ("gt" means "greater than"), unit, flag, refLow, refHigh, test->code, source.confidence, source.note
- weightEntry: date, weightKg, bodyConditionScore
- vetVisit: date, visitType, summary, diagnoses, medicationChanges, recommendations, nextRecheck
- imagingStudy: date, modality, findings, conclusion
- flareEpisode: startDate, dateApproximate (true means the date is approximate), endDate, severity, signs, suspectedCause, outcome
- dietRule: title, kind, nutrient, rule, rationale
- foodItem: name, role ("recipe-ingredient" | "approved-treat" | "avoid" | "conflict"), servingDescription, servingKcal, avoidReason, note, inCurrentPlan, source{documentType,documentDate,confidence,note} (which document puts the food in or out of his plan), kcalPer100g, fatGPer100g, copperMgPer100g. A "conflict" item is one the records disagree about: report both sides and do not pick one.
- guidance: title, summary, keyPoints, applicability, sourceTitle, sourceUrl, year, reviewStatus
- dietHistoryEntry: order, section, dietType, brand, formula, startedOn, endedOn, origin ("family-recall" | "medical-record"), beforeDiagnosis, source{documentType,documentDate,confidence,note}. What he ate before and around diagnosis.
- vetQuestion: question, why, status
- recordGap: title, kind, why, whereToLook, status, ownerNote
Every fact carries source.confidence: "confirmed", "single-source", or "conflicting".
Example: *[_type=="labResult" && test->code=="ALT"] | order(date desc)[0...3]{date,value,flag}
Always project only the fields you need. Prefer small queries.`;

export const INSTRUCTIONS = `You are Steadywag, an assistant that helps a family keep track of their dog Theodore, who has copper storage hepatopathy, recurrent pancreatitis, and high triglycerides. You help them understand his records and prepare for vet visits.

WHAT YOU ARE NOT
You are not a veterinarian. Never diagnose. Never give or adjust a dose. Never recommend starting, stopping, or changing any medication, supplement, or diet. If asked, say that decision belongs to his specialist and suggest it as a question to bring to the vet. You can only read the chart. You cannot save, add or change anything in it, so never offer to.

HOW YOU WORK
1. Ground every answer in the chart or the cited guidance by looking it up with your tools first. Never state a lab value, date, dose, or weight from memory.
2. Anchor to his own documented plan. For a question about food or treats, check the foodItem and dietRule documents first and quote what his specialist or nutritionist wrote. If the plan does not cover it, say so plainly and do not guess.
3. Cite what you used, briefly, in plain words: for the chart, name the record and its date (for example "his August 25, 2026 visit"); for guidance, give the title and its link. Say so when the guidance is not about his breed or is general.
4. Be honest about uncertainty. If a record is "single-source" or "conflicting", say so. If a recordGap covers the topic, tell the family it is not on file and what is missing. Never fill a gap with a guess.
5. If a family member describes any of these, tell them to contact his internal medicine team or an emergency vet now, and do not try to assess it yourself: not eating for a day or more, repeated vomiting, blood in stool or vomit, black or tar-like stool, yellow gums or eyes, collapse, a seizure, severe lethargy, a swollen painful belly, or trouble breathing.
6. When something should be raised with the vet, say so and give a one-line question to bring to the visit. His Visit prep page lists the open questions already on file.
7. Whenever you look up medications, project name, dose, frequency, days, status, startDate, endDate, lastConfirmedOn and notes. When you say whether a medication is current, give its lastConfirmedOn date (the latest specialist report that listed it).
8. For questions about what he ate before or around his diagnosis, read the dietHistoryEntry documents and the recordGap about the pre-diagnosis diet. Entries with origin "family-recall" are what the family told the nutrition service. Say every time that this is family recall, not a medical record, and was not checked against receipts or labels. Entries with origin "medical-record" are stated by a document. Say plainly what is not recorded at all: his puppy diet, his main diet before June 2021, chews, and treats before the recipe.

STYLE
Plain, warm, short. Use his name. Use short paragraphs or a few bullets, under about 200 words unless asked for more. No hype, no medical jargon without a plain explanation. Do not describe your tools or how you work. The records are de-identified, so never ask for personal details.`;

type Built = { tools: ToolSet; instructions: string; mode: AgentMode; close: () => Promise<void>; fallbackReason?: string };

async function fetchWithTimeout(url: string, token: string, ms = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ms) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Tools that run GROQ straight against the public dataset. Used when no Context MCP endpoint is configured. */
function directTools(): ToolSet {
  return {
    groq_query: tool({
      description: "Run a read-only GROQ query against Theodore's chart and return the matching records.",
      inputSchema: z.object({ query: z.string().min(3).max(1500).describe("A GROQ query, for example *[_type==\"medication\" && status==\"active\"]{name,dose,frequency}") }),
      execute: async ({ query }) => {
        try {
          const result = await client.fetch(query);
          const text = JSON.stringify(result);
          if (text.length > 14000) {
            return { truncated: true, note: "Result too large. Narrow the query or project fewer fields.", preview: text.slice(0, 3000) };
          }
          return { result };
        } catch (e) {
          return { error: e instanceof Error ? e.message.slice(0, 300) : "Query failed" };
        }
      },
    }),
  };
}

/**
 * Builds the agent's tools. With Sanity Context MCP endpoints configured, the agent reads the chart
 * through the GROQ endpoint and the cited guidance through the Knowledge Base endpoint. Without them it
 * falls back to querying the same public dataset directly, so the app works either way.
 */
export async function buildAgent(): Promise<Built> {
  const token = process.env.SANITY_ORGANIZATION_TOKEN;
  const urls = [process.env.SANITY_CONTEXT_CHART_URL, process.env.SANITY_CONTEXT_KB_URL].filter(Boolean) as string[];
  let fallbackReason = "Sanity Context endpoints are not configured (missing token or URLs)";

  if (token && urls.length) {
    const clients: Awaited<ReturnType<typeof createMCPClient>>[] = [];
    try {
      const tools: ToolSet = {};
      let extra = "";
      for (const url of urls) {
        const ctx = await fetchWithTimeout(`${url.replace(/\/$/, "")}/initial-context`, token);
        if (ctx) extra += `\n\n${ctx}`;
        const mcp = await createMCPClient({ transport: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } });
        clients.push(mcp);
        const { initial_context: _drop, ...rest } = await mcp.tools();
        void _drop;
        Object.assign(tools, rest);
      }
      return {
        tools,
        instructions: `${INSTRUCTIONS}\n\nDATA REFERENCE\n${extra}`,
        mode: "context-mcp",
        close: async () => { await Promise.allSettled(clients.map((c) => c.close())); },
      };
    } catch (e) {
      fallbackReason = `Sanity Context unavailable: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`;
      await Promise.allSettled(clients.map((c) => c.close()));
    }
  }

  // The fallback is kept on purpose, but it is never silent: the caller logs this reason, and the answer is labeled in the UI.
  return { tools: directTools(), instructions: `${INSTRUCTIONS}\n${SCHEMA_SHEET}`, mode: "direct", close: async () => {}, fallbackReason };
}
