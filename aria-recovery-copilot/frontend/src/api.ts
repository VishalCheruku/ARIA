import type { SessionInfo, SourceRef } from "./types";

// API base follows the Vite base path, so one build setting controls both:
//   EMBEDDED (default, base /copilot/): API calls go to /copilot/api/... and
//     ride the main app's same-origin proxy.
//   STANDALONE (base /): API calls hit the backend's own origin.
// VITE_API_BASE, when set, overrides both.
const rawBase = import.meta.env.VITE_API_BASE ?? (import.meta.env.BASE_URL || "/");
const API_BASE = rawBase === "/" ? "" : rawBase.replace(/\/$/, "");
const EMERGENCY_NUMBER = import.meta.env.VITE_EMERGENCY_NUMBER || "108";

export { EMERGENCY_NUMBER };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function url(path: string): string {
  return `${API_BASE}${path}`;
}

/** POST /api/session/start (spec §8.1). */
export async function startSession(token: string, signal?: AbortSignal): Promise<SessionInfo> {
  let response: Response;
  try {
    response = await fetch(url("/api/session/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal,
    });
  } catch {
    throw new ApiError("Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.detail || "This link is invalid or has expired. Please return to your ARIA dashboard and open Ask ARIA again.", response.status);
  }
  return {
    sessionId: data.session_id,
    patientFirstName: data.patient_first_name || "",
    riskTier: data.risk_tier || "",
    greeting: data.greeting || "",
    degraded: Boolean(data.degraded),
  };
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onFlagged: (flagged: boolean, messageId: string) => void;
  onDone: (payload: { text: string; sources: SourceRef[]; flaggedEmergency: boolean }) => void;
  onError: (message: string) => void;
}

/**
 * POST /api/chat — reads the Server-Sent Events stream from a chunked fetch.
 * Events: meta, delta, done, error (see app/routes/chat.py).
 */
export async function streamChat(
  sessionId: string,
  message: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
      signal,
    });
  } catch {
    handlers.onError("Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.");
    return;
  }
  if (!response.ok || !response.body) {
    handlers.onError("Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (eventName: string, raw: string) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return;
    }
    switch (eventName) {
      case "meta":
        handlers.onFlagged(Boolean(payload.flagged_emergency), String(payload.message_id || ""));
        break;
      case "delta":
        handlers.onDelta(String(payload.text || ""));
        break;
      case "done":
        handlers.onDone({
          text: String(payload.text || ""),
          sources: Array.isArray(payload.sources) ? (payload.sources as SourceRef[]) : [],
          flaggedEmergency: Boolean(payload.flagged_emergency),
        });
        break;
      case "error":
        handlers.onError(String(payload.text || "Copilot is temporarily unavailable."));
        break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        let eventName = "";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (eventName) handleEvent(eventName, data);
      }
    }
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      handlers.onError("Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.");
    }
  }
}

/** POST /api/session/{id}/escalation-shown — logs that the red banner rendered (spec §6.2). */
export async function ackEscalationShown(sessionId: string): Promise<void> {
  try {
    await fetch(url(`/api/session/${encodeURIComponent(sessionId)}/escalation-shown`), { method: "POST" });
  } catch {
    // best-effort only; never block the UI on the acknowledgement
  }
}
