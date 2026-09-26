/**
 * Loading skeleton (spec §6.2: capped at 5s, then friendly timeout with
 * retry) and the error / invalid-link states. Kept visually calm on purpose:
 * the patient should never see stack traces or broken layouts.
 */
export default function StatusScreen({
  state,
  message,
  retryable,
  onRetry,
}: {
  state: "loading" | "error";
  message?: string;
  retryable?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-copilot-50 to-slate-100 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-copilot-600 text-2xl font-bold text-white shadow-md">
        A
      </div>
      <h1 className="mt-4 text-lg font-semibold text-copilot-900">ARIA Recovery Copilot</h1>

      {state === "loading" ? (
        <div className="mt-6 w-full max-w-sm space-y-3" aria-busy="true" aria-live="polite">
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-copilot-100" />
          <div className="h-4 w-full animate-pulse rounded-full bg-copilot-100" />
          <div className="h-4 w-5/6 animate-pulse rounded-full bg-copilot-100" />
          <p className="pt-2 text-sm text-slate-500">Preparing your recovery assistant…</p>
        </div>
      ) : (
        <div className="mt-4 w-full max-w-sm space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">{message}</p>
          {retryable && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-copilot-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-copilot-700"
            >
              Try again
            </button>
          )}
          <p className="text-xs text-slate-400">
            Your dashboard and care plan are unaffected. You can also call your care team directly.
          </p>
        </div>
      )}
    </div>
  );
}
