import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { AgentMode } from "@/components/SourcesPanel";
import type { Task } from "./tasks";

// The server tags each answer with how it read the chart: through Sanity Context, or by the direct-query fallback.
export type ChatMessage = UIMessage<{ agentMode?: AgentMode }>;

/**
 * One conversation for the whole visit, shared by the Ask page and the floating window, so it follows you between pages.
 * It lives only in this browser tab's memory: closing the tab ends it, and nothing is saved anywhere.
 * Earlier answers are sent back as text only (no lookup results), which keeps follow-up questions fast and cheap.
 */
let sharedChat: Chat<ChatMessage> | null = null;
export function getChat(): Chat<ChatMessage> {
  sharedChat ??= new Chat<ChatMessage>({
    transport: new DefaultChatTransport<ChatMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          ...body,
          messages: messages.map((m) => (m.role === "assistant" ? { ...m, parts: m.parts.filter((p) => p.type === "text") } : m)),
        },
      }),
    }),
  });
  return sharedChat;
}

/** What the current conversation started with (its task and any check-ins it sends). Shared like the chat itself. */
export const session: { task: Task | null; checkins: unknown[] | undefined; usedCheckIns: boolean } = { task: null, checkins: undefined, usedCheckIns: false };
export function setSession(next: Partial<typeof session>) { Object.assign(session, next); }

/** Ends the conversation and tells any open Ask screen to go back to its start. Used by the logo and the Ask tab. */
export function resetConversation() {
  if (sharedChat) {
    void sharedChat.stop();
    sharedChat.messages = [];
    sharedChat.clearError();
  }
  setSession({ task: null, checkins: undefined, usedCheckIns: false });
  if (typeof window !== "undefined") window.dispatchEvent(new Event("steadywag:home"));
}
