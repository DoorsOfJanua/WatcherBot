import { useState } from "react";
import { Check } from "lucide-react";

import { api, useStore, type ConfigStatus } from "@/state/store";
import { cn } from "@/lib/cn";
import { MausAvatar } from "./Avatar";
import { HoodSpirit } from "./spirits/HoodSpirit";
import { LivingHoodSpirit } from "./spirits/LivingHoodSpirit";
import type { AvatarStyle } from "./AvatarAppearance";

const OPTIONS: Array<{
  id: AvatarStyle;
  name: string;
  description: string;
}> = [
  { id: "spirits", name: "Agent Spirits", description: "The Watcher and the hooded team" },
  { id: "classic", name: "Classic", description: "Legacy animated mascots" },
];

function Preview({ style }: { style: AvatarStyle }) {
  if (style === "classic") {
    return (
      <div className="flex h-16 items-center justify-center gap-1.5" aria-hidden="true">
        <MausAvatar color="purple" state="idle" size={50} animated={false} />
        <MausAvatar color="green" state="happy" size={42} animated={false} />
      </div>
    );
  }
  return (
    <div className="flex h-16 items-center justify-center gap-1" aria-hidden="true">
      <LivingHoodSpirit spirit="watcher" state="idle" size={50} animated={false} />
      <HoodSpirit spirit="wormhole" state="thinking" size={42} animated={false} />
      <HoodSpirit spirit="sensei" state="idle" size={38} animated={false} />
    </div>
  );
}

export function AvatarStylePicker() {
  const { state, dispatch } = useStore();
  const active = state.config?.appearance?.avatarStyle ?? "spirits";
  const [saving, setSaving] = useState<AvatarStyle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const select = async (next: AvatarStyle) => {
    if (next === active || !state.config) return;
    const previous = state.config;
    setSaving(next);
    setError(null);
    // This is a reversible visual choice: make it instant, then reconcile
    // with the server so desktop and phone reopen on the same family.
    dispatch({
      type: "configStatus",
      config: { ...previous, appearance: { avatarStyle: next } },
    });
    try {
      const config: ConfigStatus = await api("/api/config", {
        method: "PATCH",
        body: JSON.stringify({ appearance: { avatarStyle: next } }),
      });
      dispatch({ type: "configStatus", config });
    } catch (saveError) {
      dispatch({ type: "configStatus", config: previous });
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = option.id === active;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={saving !== null}
              onClick={() => void select(option.id)}
              className={cn(
                "relative flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.985] disabled:opacity-60",
                selected
                  ? "border-accent-border bg-raised"
                  : "border-hairline/60 hover:border-hairline hover:bg-raised/50",
              )}
            >
              <Preview style={option.id} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{option.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-secondary">
                  {option.description}
                </span>
              </span>
              {selected && <Check size={14} className="shrink-0 text-accent-text" />}
            </button>
          );
        })}
      </div>
      <div className="text-[11.5px] leading-relaxed text-ink-secondary">
        Each agent remembers its chosen spirit. Uploaded images and Rive avatars still override this choice for that agent.
      </div>
      {error && <div role="alert" className="text-[12px] text-danger">Could not save: {error}</div>}
    </div>
  );
}
