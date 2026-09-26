/** Persistent top disclaimer (spec §6.2) — never removable by the user. */
export default function DisclaimerBanner({ patientName }: { patientName: string }) {
  return (
    <header className="border-b border-copilot-100 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-copilot-600 font-semibold text-white">
          A
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-copilot-900">
            ARIA Recovery Copilot{patientName ? ` — for ${patientName}` : ""}
          </p>
          <p className="text-xs leading-snug text-slate-500">
            ARIA Copilot can make mistakes. For emergencies, call your local emergency number or your
            care team immediately.
          </p>
        </div>
      </div>
    </header>
  );
}
