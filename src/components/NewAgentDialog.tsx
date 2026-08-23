import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BookOpen, Loader2, RotateCcw, Search, X } from "lucide-react";

import {
  AGENT_ROLE_TEMPLATES,
  type AgentRoleTemplate,
} from "../../shared/agent-role-templates";
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

const ROLE_CATEGORY_LABELS = {
  coordination: "Coordination",
  communication: "Communication",
  research: "Research",
  creative: "Creative",
  operations: "Operations",
  personal: "Personal",
} satisfies Record<AgentRoleTemplate["category"], string>;

export function NewAgentDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const creatingRef = useRef(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleLibraryOpen, setRoleLibraryOpen] = useState(false);
  const [roleQuery, setRoleQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [spirit, setSpirit] = useState<BotSpirit>(() =>
    firstAvailableSpirit(state.bots.map((bot) => bot.spirit)),
  );
  const [palette, setPalette] = useState<BotSpiritPalette>("native");
  const [geometry, setGeometry] = useState<BotSpiritGeometry>("native");
  const [temperament, setTemperament] = useState<BotSpiritTemperament>("native");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = AGENT_ROLE_TEMPLATES.find((template) => template.id === selectedRoleId) ?? null;
  const roleWasEdited = selectedRole !== null &&
    (title !== selectedRole.title || description !== selectedRole.description);
  const normalizedRoleQuery = roleQuery.trim().toLowerCase();
  const visibleRoles = normalizedRoleQuery
    ? AGENT_ROLE_TEMPLATES.filter((template) =>
        [template.name, template.title, template.summary, template.category]
          .some((value) => value.toLowerCase().includes(normalizedRoleQuery)),
      )
    : AGENT_ROLE_TEMPLATES;

  const chooseRole = (template: AgentRoleTemplate) => {
    setTitle(template.title);
    setDescription(template.description);
    setSelectedRoleId(template.id);
    setRoleLibraryOpen(false);
    setRoleQuery("");
  };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  useEffect(() => {
    // SAFETY: document.activeElement is either null or a DOM Element; only
    // HTMLElement exposes the focus method we restore during cleanup.
    const previousFocus = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creatingRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, []);

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

          {roleLibraryOpen ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setRoleLibraryOpen(false)}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[12px] font-medium text-ink-secondary hover:bg-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ArrowLeft size={15} />
                Back to identity
              </button>
              <div className="mt-3">
                <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">Choose a proven role</h3>
                <p className="mt-1 max-w-[54ch] text-[12px] leading-relaxed text-ink-secondary">
                  A role seeds an editable charter. It does not grant tools, accounts, or permission to act.
                </p>
              </div>
              <label className="relative mt-4 block">
                <span className="sr-only">Search roles</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" size={15} />
                <input
                  value={roleQuery}
                  onChange={(event) => setRoleQuery(event.target.value)}
                  placeholder="Search roles"
                  className={cn(FIELD, "min-h-11 pl-9")}
                />
              </label>
              <div className="mt-3 flex flex-col gap-2" aria-live="polite">
                {visibleRoles.map((template) => {
                  const selected = template.id === selectedRoleId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseRole(template)}
                      className={cn(
                        "min-h-16 rounded-2xl border px-3.5 py-3 text-left transition-[border-color,background-color,transform] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        selected
                          ? "border-accent-border bg-raised"
                          : "border-hairline/45 bg-card/35 hover:border-hairline hover:bg-raised/60",
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-ink">{template.name}</span>
                          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-secondary">{template.summary}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-inset px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                          {ROLE_CATEGORY_LABELS[template.category]}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {visibleRoles.length === 0 && (
                  <div className="rounded-2xl border border-hairline/45 px-4 py-6 text-center">
                    <div className="text-[13px] font-medium text-ink">No role matches that search</div>
                    <button
                      type="button"
                      onClick={() => setRoleQuery("")}
                      className="mt-2 min-h-11 px-3 text-[12px] font-medium text-accent-text hover:text-ink"
                    >
                      Show every role
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setRoleLibraryOpen(true)}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-hairline/50 bg-card/35 px-3.5 py-3 text-left transition-[border-color,background-color,transform] hover:border-accent-border hover:bg-raised/60 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-text">
                <BookOpen size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-ink">
                  {selectedRole ? selectedRole.name : "Start with a proven role"}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-ink-secondary">
                  {selectedRole ? selectedRole.summary : `${AGENT_ROLE_TEMPLATES.length} editable operating charters, or keep this agent custom.`}
                </span>
              </span>
              {roleWasEdited && (
                <span className="shrink-0 rounded-full bg-inset px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                  Edited
                </span>
              )}
            </button>
            {selectedRole && (
              <div className="mt-1.5 flex min-h-11 items-center justify-end gap-1">
                {roleWasEdited && (
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(selectedRole.title);
                      setDescription(selectedRole.description);
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[10.5px] font-medium text-ink-secondary hover:bg-raised hover:text-ink"
                  >
                    <RotateCcw size={12} />
                    Restore charter
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRoleId(null)}
                  className="min-h-11 rounded-lg px-2.5 text-[10.5px] font-medium text-ink-secondary hover:bg-raised hover:text-ink"
                >
                  Keep as custom
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-4">
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
          </>
          )}
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

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2" role="group" aria-label="Agent spirit">
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
