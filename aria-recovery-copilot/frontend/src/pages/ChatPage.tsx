import { useEffect, useRef, useState } from "react";
import { ackEscalationShown, startSession, streamChat, EMERGENCY_NUMBER } from "../api";
import type { ChatMessage, PageState, SessionInfo, SourceRef } from "../types";
import DisclaimerBanner from "../components/DisclaimerBanner";
import EscalationBanner from "../components/EscalationBanner";
import MessageBubble from "../components/MessageBubble";
import Composer from "../components/Composer";
import StatusScreen from "../components/StatusScreen";

/**
 * /chat — the Copilot's only real page (spec §6.2).
 *
 * Token arrives via the URL query (`/chat?token=...`, signed, 5-minute TTL —
 * spec §6.1). On load we validate it through POST /api/session/start with a
 * hard 5-second cap, after which a friendly timeout screen with a retry
 * button appears. The disclaimer banner is persistent; the red escalation
 * banner, once triggered, persists for the rest of the conversation.
 */
export default function ChatPage() {
  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [escalated, setEscalated] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [backendNotice, setBackendNotice] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const escalationAckedRef = useRef(false);

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const beginSession = async () => {
    setPageState({ kind: "loading" });
    setBackendNotice("");
    if (!token) {
      setPageState({
        kind: "error",
        message:
          "This page was opened without a valid link. Please return to your ARIA dashboard and tap Ask ARIA.",
        retryable: false,
      });
      return;
    }
    const controller = new AbortController();
    // Spec §6.2: loading state capped at 5 seconds, then friendly retry.
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const info = await startSession(token, controller.signal);
      setSession(info);
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          text: info.greeting,
          timestamp: new Date(),
        },
      ]);
      if (info.degraded) {
        setBackendNotice(
          "Your care-team connection is a little slow, so answers may be more general than usual.",
        );
      }
      setPageState({ kind: "ready" });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.";
      const retryable = !(error instanceof Error) || !/expired|invalid/i.test(error.message);
      setPageState({ kind: "error", message, retryable });
    } finally {
      window.clearTimeout(timeout);
    }
  };

  useEffect(() => {
    void beginSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!session || streaming || !text.trim()) return;
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    };
    const placeholderId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: placeholderId, role: "assistant", text: "", timestamp: new Date(), pending: true },
    ]);
    setStreaming(true);
    setBackendNotice("");

    await streamChat(session.sessionId, userMessage.text, {
      onFlagged: (flagged) => {
        if (flagged) {
          // Spec §6.2: the red banner appears immediately, before any model
          // text streams, and persists for the rest of the conversation.
          setEscalated(true);
          if (!escalationAckedRef.current) {
            escalationAckedRef.current = true;
            void ackEscalationShown(session.sessionId);
          }
        }
      },
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, text: m.text + delta } : m)),
        );
      },
      onDone: ({ sources }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, pending: false, sources: sources as SourceRef[] } : m,
          ),
        );
      },
      onError: (message) => {
        setBackendNotice(message);
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      },
    });
    setStreaming(false);
  };

  if (pageState.kind !== "ready") {
    return (
      <StatusScreen
        state={pageState.kind === "loading" ? "loading" : "error"}
        message={pageState.kind === "error" ? pageState.message : undefined}
        retryable={pageState.kind === "error" ? pageState.retryable : false}
        onRetry={beginSession}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-copilot-50 via-slate-100 to-slate-100">
      <DisclaimerBanner patientName={session?.patientFirstName || ""} />

      {escalated && <EscalationBanner emergencyNumber={EMERGENCY_NUMBER} />}

      {backendNotice && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          {backendNotice}
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </main>

      <Composer disabled={streaming} onSend={handleSend} />
    </div>
  );
}
