export type Role = "user" | "assistant" | "system_notice";

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  flaggedEmergency?: boolean;
  sources?: SourceRef[];
  pending?: boolean;
}

export interface SourceRef {
  source_title: string;
  category: string;
  chunk_id?: string;
}

export interface SessionInfo {
  sessionId: string;
  patientFirstName: string;
  riskTier: string;
  greeting: string;
  degraded: boolean;
}

export type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "ready" };
