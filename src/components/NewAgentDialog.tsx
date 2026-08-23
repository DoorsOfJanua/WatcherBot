import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import {
  BOT_SPIRIT_GEOMETRIES,
  BOT_SPIRIT_GEOMETRY_LABELS as GEOMETRY_LABELS,
  BOT_SPIRIT_PALETTES,
  BOT_SPIRIT_PALETTE_LABELS as PALETTE_LABELS,
  BOT_SPIRIT_TEMPERAMENTS,
  BOT_SPIRIT_TEMPERAMENT_META as TEMPERAMENT_META,
  BOT_SPIRITS,
  type BotSpirit,
  type BotSpiritGeometry,
  type BotSpiritPalette,
  type BotSpiritTemperament,
} from "../../shared/bot-avatar";
import type { MausColor } from "@/lib/mascot";
import { cn } from "@/lib/cn";
import { api, useStore } from "@/state/store";
import { AGENT_SPIRIT_META } from "./spirits/AgentSpirit";
import { LivingHoodSpirit } from "./spirits/LivingHoodSpirit";
import { SPIRIT_PALETTE_SWATCHES } from "./spirits/HoodSpirit";

const FIELD =
  "w-full rounded-xl border border-hairline/50 bg-inset px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-secondary/70 focus:border-accent-border";

function firstAvailableSpirit(used: Array<BotSpirit | null | undefined>): BotSpirit {
  return BOT_SPIRITS.find((spirit) => !used.includes(spirit)) ?? BOT_SPIRITS[used.length % BOT_SPIRITS.length];
}

const PALETTE_ACCENT = {
  native: "purple", violet: "purple", jade: "green", rose: "pink",
  aqua: "teal", azure: "blue", ember: "orange", ivory: "yellow",
  ultraviolet: "purple", solar: "orange", acid: "green", lunar: "blue",
  oilchrome: "cyan",
} satisfies Record<BotSpiritPalette, MausColor>;

export function NewAgentDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spirit, setSpirit] = useState<BotSpirit>(() =>
    firstAvailableSpirit(state.bots.map((bot) => bot.spirit)),
  );
  const [palette, setPalette] = useState<BotSpiritPalette>("native");
  const [geometry, setGeometry] = useState<BotSpiritGeometry>("native");
  const [temperament, setTemperament] = useState<BotSpiritTemperament>("native");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // SAFETY: document.activeElement is either null or a DOM Element; only
    // HTMLElement exposes the focus method we restore during cleanup.
    const previousFocus = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [creating, onClose]);

  const create = async () => {
    const chosenName = name.trim();
    if (!chosenName || creating) return;
    setCreating(true);
    setError("");
    try {
      const { bot } = await api("/api/bots", {
        method: "POST",
        body: JSON.stringify({
          name: chosenName,
          title: title.trim(),
          description: description.trim(),
          spirit,
          spiritPalette: palette,
          spiritGeometry: geometry,
          spiritTemperament: temperament,
          color: PALETTE_ACCENT[palette],
        }),
      });
      dispatch({ type: "botAdded", bot });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && !creating && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-agent-title"
        className="animate-pop-in grid max-h-[calc(100dvh-1.5rem)] w-full max-w-[840px] overflow-y-auto rounded-[24px] border border-hairline/50 bg-panel shadow-2xl shadow-black/50 md:h-[calc(100dvh-3rem)] md:max-h-[760px] md:grid-cols-[minmax(0,0.9fr)_minmax(340px,1.1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden"
      >
        <form
          className="min-h-0 p-5 sm:p-7 md:overflow-y-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">New agent</div>
              <h2 id="new-agent-title" className="mt-1 text-[24px] font-semibold tracking-[-0.025em] text-ink">
                Give them an identity
              </h2>
              <p className="mt-1 max-w-[38ch] text-[13px] leading-relaxed text-ink-secondary">
                Name the teammate you want to return to—not a disposable chat.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              aria-label="Close new agent"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40 md:hidden"
            >
              <X size={19} />
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-ink">Name</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Farmada, Scout, Archivist…"
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-ink">Role</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="What does this agent own?"
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-ink">Working brief</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="How should they work, and where should their authority stop?"
                className={cn(FIELD, "resize-none leading-relaxed")}
              />
            </label>
          </div>

          {error && <div role="alert" className="mt-4 text-[12px] text-danger">{error}</div>}
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-xl px-4 py-2.5 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || creating}
              className="flex min-w-[132px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              {creating ? "Creating…" : "Create agent"}
            </button>
          </div>
        </form>

        <section className="min-h-0 border-t border-hairline/40 bg-inset/45 p-5 sm:p-7 md:overflow-y-auto md:border-l md:border-t-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-medium text-ink">Choose a spirit</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
                Six original silhouettes, each with its own movement and sacred geometry.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              aria-label="Close new agent"
              className="hidden size-10 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40 md:flex"
            >
              <X size={19} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2">
            {BOT_SPIRITS.map((candidate, index) => {
              const selected = candidate === spirit;
              const meta = AGENT_SPIRIT_META[candidate];
              return (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSpirit(candidate)}
                  style={{ animationDelay: `${index * 45}ms` }}
                  className={cn(
                    "animate-panel-in flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.98]",
                    selected
                      ? "border-accent-border bg-raised"
                      : "border-hairline/45 bg-card/35 hover:border-hairline hover:bg-raised/60",
                  )}
                >
                  <LivingHoodSpirit spirit={candidate} palette={palette} geometry={geometry} temperament={temperament} state={selected ? "listening" : "idle"} size={52} animated={selected} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{meta.title}</span>
                    <span className="block truncate text-[10.5px] text-ink-secondary">{meta.material}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 text-[12px] font-medium text-ink">Spirit color</div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Spirit color">
            {BOT_SPIRIT_PALETTES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-label={PALETTE_LABELS[candidate]}
                aria-pressed={candidate === palette}
                onClick={() => setPalette(candidate)}
                className={cn(
                  "flex min-w-[58px] flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[9.5px] text-ink-secondary transition-colors",
                  candidate === palette ? "bg-raised text-ink ring-2 ring-accent-border" : "hover:bg-raised/60 hover:text-ink",
                )}
              >
                <span className="h-5 w-8 rounded-full border border-white/15" style={{ background: SPIRIT_PALETTE_SWATCHES[candidate] }} />
                {PALETTE_LABELS[candidate]}
              </button>
            ))}
          </div>

          <div className="mt-5 text-[12px] font-medium text-ink">Background geometry</div>
          <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label="Background geometry">
            {BOT_SPIRIT_GEOMETRIES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-label={GEOMETRY_LABELS[candidate]}
                aria-pressed={candidate === geometry}
                onClick={() => setGeometry(candidate)}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] text-ink-secondary hover:bg-raised hover:text-ink",
                  candidate === geometry && "bg-raised text-ink ring-2 ring-accent-border",
                )}
              >
                <LivingHoodSpirit spirit={spirit} palette={palette} geometry={candidate} temperament={temperament} size={34} animated={false} />
                <span className="max-w-full truncate">{GEOMETRY_LABELS[candidate]}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 text-[12px] font-medium text-ink">Emotional range</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-2" role="group" aria-label="Emotional range">
            {BOT_SPIRIT_TEMPERAMENTS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={candidate === temperament}
                onClick={() => setTemperament(candidate)}
                className={cn(
                  "rounded-lg border border-hairline/40 px-2.5 py-2 text-left hover:bg-raised",
                  candidate === temperament && "border-accent-border bg-raised ring-1 ring-accent-border",
                )}
              >
                <span className="block text-[11px] font-medium text-ink">{TEMPERAMENT_META[candidate].label}</span>
                <span className="mt-0.5 block text-[9.5px] text-ink-secondary">{TEMPERAMENT_META[candidate].note}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
