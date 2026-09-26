import type { SourceRef } from "../types";

/**
 * Sources shown under an assistant message — every clinical claim is
 * traceable to a retrieved knowledge-base chunk (spec §13).
 */
export default function SourcesList({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source, index) => (
        <span
          key={source.chunk_id || index}
          title={source.source_title}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-copilot-100 bg-copilot-50 px-2 py-0.5 text-[11px] text-copilot-700"
        >
          <span aria-hidden>📎</span>
          <span className="truncate">{source.source_title}</span>
          <span className="rounded-full bg-copilot-100 px-1.5 py-px text-[10px] uppercase tracking-wide">
            {source.category}
          </span>
        </span>
      ))}
    </div>
  );
}
