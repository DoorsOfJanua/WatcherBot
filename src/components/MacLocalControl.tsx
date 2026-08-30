import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Shield } from "lucide-react";
import { useDesktopCapabilities } from "./DesktopCapabilities";

export function MacLocalControl() {
  const { capabilities } = useDesktopCapabilities();
  const [pending, setPending] = useState(false);
  const [awaitingGrant, setAwaitingGrant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setPending(true);
    setError(null);
    try {
      await window.ogb?.localControl?.retry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  };

  const openSettings = async (pane: "accessibility" | "screen") => {
    setError(null);
    setAwaitingGrant(true);
    try {
      if (pane === "accessibility") {
        const result = await window.ogb?.localControl.requestAccessibility();
        if (result?.granted) {
          setAwaitingGrant(false);
          await retry();
        }
      } else {
        await window.ogb?.permOpenSettings?.(pane);
      }
    } catch (reason) {
      setAwaitingGrant(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  useEffect(() => {
    if (!awaitingGrant) return;
    let used = false;
    const onFocus = () => {
      if (used) return;
      if (document.visibilityState !== "visible") return;
      used = true;
      setAwaitingGrant(false);
      void retry();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [awaitingGrant]);

  if (capabilities.host.platform !== "darwin") return null;
  if (capabilities.localComputer.available) return null;

  const missingPermissions = capabilities.localComputer.missingPermissions ?? [];
  const permissionLabels = missingPermissions.map((permission) =>
    permission === "screen" ? "Screen Recording" : "Accessibility",
  );
  const permissionMessage =
    permissionLabels.length > 0
      ? `WatcherBotRoom still needs ${permissionLabels.join(" and ")}. Enable ${permissionLabels.length === 1 ? "it" : "them"} in System Settings, then return here — WatcherBotRoom checks again automatically.`
      : capabilities.localComputer.message ??
        "WatcherBotRoom could not start control of this Mac. Check its permissions, then retry.";

  return (
    <section className="mt-4 rounded-xl border border-warning/25 bg-warning/10 p-4">
      <div className="flex items-start gap-3">
        <Shield size={16} className="mt-0.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink">
            {permissionLabels.length > 0
              ? `Enable ${permissionLabels.join(" and ")}`
              : "Local computer control is unavailable"}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
            {permissionMessage}
          </p>
          {error && (
            <div className="mt-2 flex gap-1.5 text-[12px] text-danger">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {missingPermissions.map((permission) => (
              <button
                key={permission}
                type="button"
                onClick={() => void openSettings(permission)}
                disabled={pending || awaitingGrant}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                {permission === "screen" ? "Open Screen Recording" : "Allow Accessibility"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void retry()}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline/50 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-raised disabled:opacity-50"
            >
              {pending && <Loader2 size={13} className="animate-spin" />}
              Retry
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
