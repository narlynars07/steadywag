# Context setup sheet

Do this in the Sanity dashboard for the Steadywag organization. Open **Context** from the left menu. Context must
already be enabled under Labs.

Order matters: create the Knowledge Base first, build it, then the two endpoints. Replace `<org-id>` with your
organization ID and `<project-id>` with `yahsq70q`.

---

## 0. Whenever the schema or the content changes

- **Schema change** (a new type or field in `studio/`): run `npm run deploy` in `studio/`. The Context endpoints read
  the schema from the **hosted Studio**, so a schema deploy alone is not enough.
- **New document type:** add it to the chart endpoint's `groqFilter` (section 2). Documents of a type that is not in
  the filter are invisible to the agent, even though the website can read them.
- **Changed `guidance` or `dietRule` documents:** rebuild the Knowledge Base (section 1).

---

## 1. The Knowledge Base

Click **New knowledge base**.

**Title**

```
Steadywag veterinary guidance and diet plan
```

**Purpose** (paste exactly)

```
Cited veterinary guidance and one dog's documented diet plan, for a family caring for a dog with copper-associated hepatitis, recurrent pancreatitis, and high triglycerides. It helps them understand monitoring, treatment, and nutrition questions and prepare questions for the vet. It is not for diagnosing or for dosing. Every claim should be attributed to its source, and entries should say plainly when the evidence is not about this dog's breed.
```

**Add source** → **Dataset**

- Project: `Steadywag` (`<project-id>`), dataset: `production`
- GROQ query (paste exactly):

```groq
*[_type == "guidance" || _type == "dietRule"]{
  _type,
  title,
  topic,
  "summary": coalesce(summary, rule),
  keyPoints,
  applicability,
  rationale,
  kind,
  sourceTitle,
  sourceUrl,
  publisher,
  year,
  evidenceType,
  reviewStatus
}
```

This reads the 9 cited guidance entries and the 16 diet rules, 25 documents in all (the limit is 5,000, and Knowledge
Bases index up to 150 documents). The Knowledge Base then synthesizes them into a small number of entries.

Click **Build entries**. When it finishes, open the **Issues** view. If it raises conflicts, that is the feature
working. Resolve each by choosing which source is the ground truth.

**Add this Instruction** (it stops the Knowledge Base from inventing reference bands that no source gives):

```
Do not add reference ranges, thresholds or labels that are not stated in a cited source. For liver copper, state only what the sources say: the practice article gives normal as under 400 mg per kg dry weight and abnormal as over 600; the ACVIM consensus statement describes 600 to 1000 as a gray zone and above about 1000 as typical. No source gives a "borderline" band between 400 and 600, so do not create one. Every statement in an entry must carry a citation to a source document.
```

Then note the Knowledge Base id. It starts with `kb`.

---

## 2. Endpoint for the chart (GROQ mode)

Click **New MCP** (endpoint).

- **Title:** `Steadywag chart`
- **Name:** `steadywag-chart` (this cannot be changed later)
- **Source:** dataset `<project-id>.production`
- **groqFilter** (all 21 document types, including `dietHistoryEntry`, `careRoutine`, `familyNote`, `recordUpdate` and the three `history*` types):

```groq
_type in ["dog","condition","medication","labTest","labResult","weightEntry","vetVisit","imagingStudy","flareEpisode","dietRule","foodItem","guidance","vetQuestion","recordGap","dietHistoryEntry","careRoutine","historySummary","historyChapter","historyPattern","familyNote","recordUpdate"]
```

- **Instructions:**

```
You are reading one dog's de-identified health chart. Answer only from what these documents say. Quote dates. Every fact has a source.confidence of confirmed, single-source, or conflicting: say so when it is not confirmed. recordGap documents list what is NOT on file, so mention a gap rather than guessing. dietHistoryEntry documents hold what he ate before and around diagnosis: check their origin, and say when an entry is family recall and not a medical record. careRoutine documents are the family's own daily routine: use them for times only where a medication's writtenInstruction or timingNote gives none, and label them family routine. familyNote documents are what his family has noticed: call them Family observations, never present them as advice or instructions. historySummary, historyChapter and historyPattern are written from his records and point at the visits, labs and medications they rest on: cite them, and say "Timing only. The records don't show cause." where timingOnly is true. When you read medication documents, always include lastConfirmedOn and writtenInstruction. Never diagnose, give or change a dose, or advise starting or stopping any medication or diet.
```

An endpoint with a dataset source needs a deployed Studio (`npm run deploy` in `studio/`).

---

## 3. Endpoint for the Knowledge Base

Click **New MCP** again.

- **Title:** `Steadywag knowledge`
- **Name:** `steadywag-knowledge`
- **Source:** the Knowledge Base from step 1 (do **not** add a dataset source, because a dataset source would override it)
- **Instructions:**

```
Use these entries for cited veterinary guidance and the dog's documented diet plan. Attribute each claim to its source and link it. Say clearly when the evidence is about other breeds or a general population. Do not give doses or diagnose. Do not state a reference range or threshold unless a cited source gives it.
```

---

## 4. Put the endpoint URLs in the environment

The URL format is:

```
https://api.sanity.io/v1/context/organizations/<org-id>/mcp/steadywag-chart
https://api.sanity.io/v1/context/organizations/<org-id>/mcp/steadywag-knowledge
```

These go in `.env.local` (and on the deployment) as:

```
SANITY_CONTEXT_CHART_URL=https://api.sanity.io/v1/context/organizations/<org-id>/mcp/steadywag-chart
SANITY_CONTEXT_KB_URL=https://api.sanity.io/v1/context/organizations/<org-id>/mcp/steadywag-knowledge
SANITY_ORGANIZATION_TOKEN=<a Context Viewer (read-only) token>
```

If these are missing or the endpoints are unreachable, the agent falls back to direct dataset queries. That is logged on
the server (`agent_fallback`) and shown on the answer as "Direct query, not Sanity Context".

---

## 5. Check that it works

Through the endpoint, this query must return the three diet history entries (it returns nothing if the type is missing
from the `groqFilter`):

```groq
*[_type == "dietHistoryEntry"]{order, origin}
```
