import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { api } from "@/state/store";

type Policy = {
  profileId: string;
  agentId: string;
  approvalRequired: boolean;
  canPostAutomatically: boolean;
  unavailableReason: string;
};

export function ReplyApprovalToggle({
  profileId = "",
  agentId = "",
  compact = false,
}: {
  profileId?: string;
  agentId?: string;
  compact?: boolean;
}) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (profileId) query.set("profileId", profileId);
    if (agentId) query.set("agentId", agentId);
    try {
      setPolicy(await api(`/api/replyguy/approval-policy${query.size ? `?${query}` : ""}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [agentId, profileId]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async () => {
    if (!policy || saving) return;
    setSaving(true);
    setError("");
    try {
      setPolicy(await api("/api/replyguy/approval-policy", {
        method: "PUT",
        body: JSON.stringify({
          profileId: policy.profileId,
          agentId: policy.agentId,
          approvalRequired: !policy.approvalRequired,
        }),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  if (!policy && !error) {
    return <div className={cn("animate-pulse bg-raised/55", compact ? "h-11 border-b border-hairline/35" : "h-[82px] rounded-xl")} aria-label="Loading reply approval setting" />;
  }

  return (
    <div className={cn(compact ? "border-b border-hairline/35 px-4 py-3 sm:px-5" : "rounded-xl bg-card p-4")}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className={cn("font-medium text-ink", compact ? "text-[13px]" : "text-[15px]")}>Ask me first</div>
          <div className={cn("mt-0.5 leading-relaxed text-ink-secondary", compact ? "text-[11.5px]" : "text-[13px]") }>
            {policy?.approvalRequired === false
              ? "Off — Gemini can queue and post its own replies."
              : "On — Gemini shows you a reply deck before posting."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={policy?.approvalRequired ?? true}
          aria-label="Ask before posting X replies"
          disabled={!policy || saving || (policy.approvalRequired && !policy.canPostAutomatically)}
          onClick={() => void toggle()}
          title={policy?.approvalRequired && !policy.canPostAutomatically ? policy.unavailableReason : undefined}
          className={cn(
            "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
            policy?.approvalRequired ? "bg-accent" : "bg-raised",
          )}
        >
          <span className={cn(
            "absolute left-0 top-[3px] size-5 rounded-full bg-white transition-transform",
            policy?.approvalRequired ? "translate-x-[21px]" : "translate-x-[3px]",
          )} />
        </button>
      </div>
      {error && <div role="alert" className="mt-2 text-[11.5px] leading-relaxed text-danger">{error}</div>}
    </div>
  );
}
