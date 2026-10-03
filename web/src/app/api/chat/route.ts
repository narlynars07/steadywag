import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { buildAgent } from "@/lib/agent";
import { checkLimits } from "@/lib/limits";

export const maxDuration = 60;

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The assistant isn't switched on yet. An Anthropic API key has not been added to this deployment." }, { status: 503 });
  }

  let messages: UIMessage[];
  try {
    ({ messages } = (await req.json()) as { messages: UIMessage[] });
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 24) {
    return Response.json({ error: "Conversation is empty or too long. Start a new question." }, { status: 400 });
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser || textOf(lastUser).length > 1500) {
    return Response.json({ error: "Please keep each question under about 1,500 characters." }, { status: 400 });
  }

  // Counted only after the request is valid, so malformed calls never use up anyone's daily allowance.
  const visitor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const allowed = await checkLimits(visitor);
  if (!allowed.ok) return Response.json({ error: allowed.error }, { status: allowed.status });

  const agent = await buildAgent();
  // Falling back to direct queries is allowed, but never silent: it is logged here and labeled on the answer in the UI.
  if (agent.mode === "direct") {
    console.warn(JSON.stringify({ event: "agent_fallback", mode: agent.mode, reason: agent.fallbackReason, at: new Date().toISOString() }));
  }
  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5"),
    instructions: agent.instructions,
    messages: await convertToModelMessages(messages),
    tools: agent.tools,
    stopWhen: isStepCount(8),
    maxOutputTokens: 1400,
    onFinish: () => { void agent.close(); },
    onError: () => { void agent.close(); },
  });

  // x-agent-mode tells you whether the chart was read through Sanity Context MCP or the direct fallback.
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // Sent with the answer itself, so the label belongs to this answer and not to whichever response arrived last.
      messageMetadata: ({ part }) => (part.type === "start" ? { agentMode: agent.mode } : undefined),
    }),
    headers: { "x-agent-mode": agent.mode },
  });
}
