/**
 * Full-width red escalation banner (spec §6.2, §9.3): shown immediately when
 * the backend flags an emergency, with a tappable phone-style call CTA, and
 * it persists at the top of the conversation from that point on.
 */
export default function EscalationBanner({ emergencyNumber }: { emergencyNumber: string }) {
  return (
    <div role="alert" className="bg-red-600 px-4 py-3 text-white shadow">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold leading-snug">
          This may be urgent. Please contact your care team or emergency services now.
        </p>
        <a
          href={`tel:${emergencyNumber}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50 sm:animate-pulse"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path
              fillRule="evenodd"
              d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
              clipRule="evenodd"
            />
          </svg>
          Call {emergencyNumber}
        </a>
      </div>
    </div>
  );
}
