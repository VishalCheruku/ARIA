import type { ChatMessage } from "../types";
import SourcesList from "./SourcesList";

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isNotice = message.role === "system_notice";

  if (isNotice) {
    return (
      <p className="text-center text-xs italic text-slate-400">{message.text}</p>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] space-y-1 sm:max-w-[75%]`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-md bg-copilot-600 text-white"
              : message.flaggedEmergency
                ? "rounded-bl-md border border-red-200 bg-red-50 font-medium text-red-900"
                : "rounded-bl-md bg-white text-slate-800"
          }`}
        >
          {message.text || (message.pending ? "…" : "")}
          {message.pending && (
            <span className="ml-1 inline-block animate-pulse" aria-hidden>
              ▍
            </span>
          )}
        </div>
        {!message.pending && message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}
        <p className={`text-[11px] text-slate-400 ${isUser ? "text-right" : "text-left"}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
