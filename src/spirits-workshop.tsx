// Agent Spirits Workshop — the review bench for the six-spirit family.
// Dev-only preview surface (like mascot-preview): compares every spirit at
// 24/44/112 px, in all eight semantic states, animated or frozen, on dark and
// light surfaces, plus a realistic sidebar rehearsal. Production avatars are
// untouched until Janua promotes a direction from this bench.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AGENT_SPIRIT_META,
  AGENT_SPIRIT_NAMES,
  AgentSpirit,
  type AgentSpiritName,
  type AgentSpiritState,
} from "@/components/spirits/AgentSpirit";
import { HOOD_MOODS, HoodSpirit, type HoodHeading } from "@/components/spirits/HoodSpirit";
import { AlienSpirit } from "@/components/spirits/AlienSpirit";
import { BOT_AVATAR_STATES } from "../shared/bot-avatar";
import "./spirits-workshop.css";

const STATE_NOTES = {
  idle: "alive but quiet",
  listening: "attends the conversation",
  thinking: "agent-specific reasoning",
  working: "meaningful labor",
  waiting: "paused for Janua",
  success: "one joyful beat",
  failure: "recoverable snag",
  sleeping: "peaceful economy",
} satisfies Record<AgentSpiritState, string>;

type Direction = "hood" | "alien" | "folded";

const DIRECTION_LABEL = {
  hood: "hooded",
  alien: "alien",
  folded: "folded ink",
} satisfies Record<Direction, string>;

const NEXT_DIRECTION = {
  hood: "alien",
  alien: "folded",
  folded: "hood",
} satisfies Record<Direction, Direction>;

/** What marks each agent apart in the alien direction, at a glance. */
const ALIEN_MATERIAL = {
  wormhole: "Tall violet dome · ring stalk",
  sensei: "Slim jade skull · balanced diamond",
  mailman: "Round rose head · mail pennant",
  ganga: "Teal visitor · single drop",
  signal: "Blue scout · twin antennae",
  forge: "Broad amber jaw · flat horns",
} satisfies Record<AgentSpiritName, string>;

/** What marks each agent apart in the hood direction, at a glance. */
const HOOD_MATERIAL = {
  wormhole: "Violet cowl · Flower of Life",
  sensei: "Jade cowl · Merkaba",
  mailman: "Rose cowl · Vesica Piscis",
  ganga: "Teal cowl · Golden spiral",
  signal: "Blue cowl · Seed of Life",
  forge: "Amber cowl · Metatron's Cube",
} satisfies Record<AgentSpiritName, string>;

/** Sidebar rehearsal cast — a believable mid-afternoon in the room. */
const SIDEBAR_CAST: { spirit: AgentSpiritName; state: AgentSpiritState; status: string }[] = [
  { spirit: "wormhole", state: "thinking", status: "Sequencing the week" },
  { spirit: "mailman", state: "working", status: "Clearing the inbox" },
  { spirit: "signal", state: "listening", status: "On your last message" },
  { spirit: "ganga", state: "waiting", status: "Draft ready for you" },
  { spirit: "forge", state: "failure", status: "Build hit a snag" },
  { spirit: "sensei", state: "sleeping", status: "Until tomorrow, 7:00" },
];

function SurfaceChip({
  tone,
  direction,
  spirit,
  state,
  animated,
  sizes,
}: {
  tone: "dark" | "light";
  direction: Direction;
  spirit: AgentSpiritName;
  state: AgentSpiritState;
  animated: boolean;
  sizes: number[];
}) {
  const Spirit = direction === "hood" ? HoodSpirit : direction === "alien" ? AlienSpirit : AgentSpirit;
  return (
    <span className={`chip chip--${tone}`}>
      {sizes.map((size) => (
        <Spirit key={size} spirit={spirit} state={state} size={size} animated={animated} />
      ))}
    </span>
  );
}

function Workshop() {
  const [direction, setDirection] = useState<Direction>("hood");
  const [animated, setAnimated] = useState(true);
  const [surface, setSurface] = useState<"dark" | "light">("dark");
  const [pose, setPose] = useState<AgentSpiritState>("idle");
  const [stageSpirit, setStageSpirit] = useState<AgentSpiritName>("wormhole");
  const [stageState, setStageState] = useState<AgentSpiritState>("working");
  const [heading, setHeading] = useState<HoodHeading>("center");
  const [replay, setReplay] = useState(0);

  const focus = (spirit: AgentSpiritName, state: AgentSpiritState) => {
    setStageSpirit(spirit);
    setStageState(state);
    setReplay((n) => n + 1);
  };

  const Spirit = direction === "hood" ? HoodSpirit : direction === "alien" ? AlienSpirit : AgentSpirit;

  return (
    <main className={`bench bench--${direction}`}>
      <header className="bench-head">
        <div className="bench-title">
          <p className="bench-eyebrow">MyAgentRoom · original character family · review bench</p>
          <h1>Agent Spirits</h1>
          <p className="bench-lede">
            {direction === "hood"
              ? "Direction B, after Janua's reference: gradient cowls, luminous eyes, sacred-geometry halos. The eyes carry the state; the halo carries the labor and identity."
              : direction === "alien"
                ? "Direction C, the Visitors: classic alien heads with huge slanted eyes. The pupils are the soul — they drift, attend, wander and scan; skull shape and one accessory carry each personality."
                : "Direction A, folded ink: bold silhouette, warm inked outline, one luminous aperture, restrained two-tone material. Same family, six bodies, six ways of moving."}{" "}
            Nothing here replaces production avatars yet.
          </p>
        </div>
        <div className="bench-controls" role="group" aria-label="Workshop controls">
          <button
            type="button"
            className="control on"
            onClick={() => setDirection((d) => NEXT_DIRECTION[d])}
          >
            Direction: {DIRECTION_LABEL[direction]}
          </button>
          <button
            type="button"
            className={animated ? "control on" : "control"}
            aria-pressed={animated}
            onClick={() => setAnimated((v) => !v)}
          >
            Motion {animated ? "on" : "off"}
          </button>
          <button
            type="button"
            className="control"
            onClick={() => setSurface((s) => (s === "dark" ? "light" : "dark"))}
          >
            Matrix surface: {surface}
          </button>
        </div>
      </header>

      <section className="family" aria-labelledby="family-heading">
        <div className="section-title">
          <h2 id="family-heading">The family</h2>
          <div className="pose-row" role="group" aria-label="Pose every spirit">
            {BOT_AVATAR_STATES.map((state) => (
              <button
                key={state}
                type="button"
                className={pose === state ? "pose on" : "pose"}
                aria-pressed={pose === state}
                onClick={() => setPose(state)}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
        <div className="family-row">
          {AGENT_SPIRIT_NAMES.map((name) => {
            const meta = AGENT_SPIRIT_META[name];
            return (
              <article className="plate" key={name}>
                <div className="plate-stage">
                  <Spirit spirit={name} state={pose} size={112} animated={animated} />
                </div>
                <h3>{meta.title}</h3>
                <p className="plate-role" style={{ color: meta.accent }}>
                  {meta.role}
                </p>
                <p className="plate-material">
                  {direction === "hood"
                    ? HOOD_MATERIAL[name]
                    : direction === "alien"
                      ? ALIEN_MATERIAL[name]
                      : meta.material}
                </p>
                <div className="plate-chips">
                  <SurfaceChip tone="dark" direction={direction} spirit={name} state={pose} animated={animated} sizes={[44, 24]} />
                  <SurfaceChip tone="light" direction={direction} spirit={name} state={pose} animated={animated} sizes={[44, 24]} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="matrix-section" aria-labelledby="matrix-heading">
        <div className="section-title">
          <h2 id="matrix-heading">Every spirit, every state</h2>
          <p className="section-hint">44 px, the sidebar working size. Click any cell to put it on the stage.</p>
        </div>
        <div className={`matrix matrix--${surface}`} role="grid" aria-label="Spirit and state matrix">
          <div className="matrix-corner" role="columnheader" aria-label="Spirit" />
          {BOT_AVATAR_STATES.map((state) => (
            <div className="matrix-colhead" role="columnheader" key={state}>
              <strong>{state}</strong>
              <span>{STATE_NOTES[state]}</span>
            </div>
          ))}
          {AGENT_SPIRIT_NAMES.map((name) => (
            <div className="matrix-row" role="row" key={name}>
              <div className="matrix-rowhead" role="rowheader">
                <strong>{AGENT_SPIRIT_META[name].title}</strong>
                <span>{AGENT_SPIRIT_META[name].role}</span>
              </div>
              {BOT_AVATAR_STATES.map((state) => (
                <button
                  type="button"
                  role="gridcell"
                  className={
                    stageSpirit === name && stageState === state ? "matrix-cell on" : "matrix-cell"
                  }
                  key={state}
                  onClick={() => focus(name, state)}
                  aria-label={`Stage ${AGENT_SPIRIT_META[name].title} ${state}`}
                >
                  <Spirit spirit={name} state={state} size={44} animated={animated} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="stage-section" aria-labelledby="stage-heading">
        <div className="section-title">
          <h2 id="stage-heading">On the stage</h2>
          <p className="section-hint">
            {AGENT_SPIRIT_META[stageSpirit].title} · {stageState} · {STATE_NOTES[stageState]}
          </p>
        </div>
        <div className="stage">
          <div className="stage-pair">
            {(["dark", "light"] as const).map((tone) => (
              <div className={`stage-well stage-well--${tone}`} key={`${tone}-${replay}`}>
                {direction === "folded" ? (
                  <>
                    <AgentSpirit spirit={stageSpirit} state={stageState} size={112} animated={animated} />
                    <AgentSpirit spirit={stageSpirit} state={stageState} size={24} animated={animated} />
                  </>
                ) : direction === "alien" ? (
                  <>
                    <AlienSpirit spirit={stageSpirit} state={stageState} heading={heading} size={112} animated={animated} />
                    <AlienSpirit spirit={stageSpirit} state={stageState} heading={heading} size={24} animated={animated} />
                  </>
                ) : (
                  <>
                    <HoodSpirit spirit={stageSpirit} state={stageState} heading={heading} size={112} animated={animated} />
                    <HoodSpirit spirit={stageSpirit} state={stageState} heading={heading} size={24} animated={animated} />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="stage-side">
            <div className="stage-picker" role="group" aria-label="Choose spirit">
              {AGENT_SPIRIT_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={stageSpirit === name ? "pose on" : "pose"}
                  aria-pressed={stageSpirit === name}
                  onClick={() => focus(name, stageState)}
                >
                  {AGENT_SPIRIT_META[name].title}
                </button>
              ))}
            </div>
            <div className="stage-picker" role="group" aria-label="Choose state">
              {BOT_AVATAR_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  className={stageState === state ? "pose on" : "pose"}
                  aria-pressed={stageState === state}
                  onClick={() => focus(stageSpirit, state)}
                >
                  {state}
                </button>
              ))}
            </div>
            {direction !== "folded" && (
              <div className="headpad" role="group" aria-label="Turn the head">
                <button type="button" className={heading === "up" ? "pose on" : "pose"} style={{ gridArea: "up" }} onClick={() => setHeading("up")}>↑</button>
                <button type="button" className={heading === "left" ? "pose on" : "pose"} style={{ gridArea: "left" }} onClick={() => setHeading("left")}>←</button>
                <button type="button" className={heading === "center" ? "pose on" : "pose"} style={{ gridArea: "mid" }} onClick={() => setHeading("center")}>·</button>
                <button type="button" className={heading === "right" ? "pose on" : "pose"} style={{ gridArea: "right" }} onClick={() => setHeading("right")}>→</button>
                <button type="button" className={heading === "down" ? "pose on" : "pose"} style={{ gridArea: "down" }} onClick={() => setHeading("down")}>↓</button>
                <span className="headpad-label">head</span>
              </div>
            )}
            <button type="button" className="control" onClick={() => setReplay((n) => n + 1)}>
              Replay beat
            </button>
          </div>
        </div>
      </section>

      {direction !== "folded" && (
        <section className="moods-section" aria-labelledby="moods-heading">
          <div className="section-title">
            <h2 id="moods-heading">Expression library</h2>
            <p className="section-hint">
              Every emotion {AGENT_SPIRIT_META[stageSpirit].title} can wear. States pick from these;
              any can become a bot&rsquo;s resting face.
            </p>
          </div>
          <div className="moods-row">
            {HOOD_MOODS.map((mood) => (
              <figure className="mood-card" key={mood}>
                {direction === "hood" ? (
                  <HoodSpirit spirit={stageSpirit} state="idle" mood={mood} size={76} animated={animated} />
                ) : (
                  <AlienSpirit spirit={stageSpirit} state="idle" mood={mood} size={76} animated={animated} />
                )}
                <figcaption>{mood}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="sidebar-section" aria-labelledby="sidebar-heading">
        <div className="section-title">
          <h2 id="sidebar-heading">Sidebar rehearsal</h2>
          <p className="section-hint">
            The real test: 24 px rows plus one 40 px active row, glanced at mid-afternoon.
          </p>
        </div>
        <div className="sidebars">
          {(["dark", "light"] as const).map((tone) => (
            <div className={`sidebar sidebar--${tone}`} key={tone}>
              <div className="sidebar-label">The room</div>
              <div className="sidebar-active">
                <Spirit
                  spirit={SIDEBAR_CAST[0].spirit}
                  state={SIDEBAR_CAST[0].state}
                  size={40}
                  animated={animated}
                />
                <span className="sidebar-active-text">
                  <strong>{AGENT_SPIRIT_META[SIDEBAR_CAST[0].spirit].title}</strong>
                  <em>{SIDEBAR_CAST[0].status}</em>
                </span>
              </div>
              {SIDEBAR_CAST.slice(1).map(({ spirit, state, status }) => (
                <div className="sidebar-row" key={spirit}>
                  <Spirit spirit={spirit} state={state} size={24} animated={animated} />
                  <span className="sidebar-row-text">
                    <strong>{AGENT_SPIRIT_META[spirit].title}</strong>
                    <em>{status}</em>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Workshop />
  </StrictMode>,
);
