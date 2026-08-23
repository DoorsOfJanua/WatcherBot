// Agent Spirits — Janua's original animated agent family.
//
// Six compact beings that share one visual grammar (bold silhouette, warm
// hand-inked outline, one luminous aperture, restrained two-tone fills) but
// carry different bodies and movement personalities. Modeled on the technical
// virtues of MailmanSpirit: state-driven CSS animation over static SVG, no
// per-frame React work, reduced-motion safe.
//
// These are workshop candidates — the production avatar path still renders
// the original MailmanSpirit until Janua promotes this family.
import type { ComponentType } from "react";
import { WormholeSpirit } from "./WormholeSpirit";
import { SenseiSpirit } from "./SenseiSpirit";
import { MailmanSpiritII } from "./MailmanSpiritII";
import { GangaSpirit } from "./GangaSpirit";
import { SignalSpirit } from "./SignalSpirit";
import { ForgeSpirit } from "./ForgeSpirit";
import type { BotAvatarState } from "../../../shared/bot-avatar";

/** The eight semantic states every spirit animates — the app's avatar contract. */
export type AgentSpiritState = BotAvatarState;

export const AGENT_SPIRIT_NAMES = [
  "wormhole",
  "sensei",
  "mailman",
  "ganga",
  "signal",
  "forge",
] as const;
export type AgentSpiritName = (typeof AGENT_SPIRIT_NAMES)[number];

export interface AgentSpiritProps {
  state?: AgentSpiritState;
  size?: number;
  animated?: boolean;
  label?: string;
}

export const AGENT_SPIRIT_META = {
  wormhole: {
    title: "The Watcher",
    role: "Chief of Staff",
    material: "Folded violet ribbon looping through its own portal",
    accent: "#8a5fd0",
  },
  sensei: {
    title: "Sensei",
    role: "Coach",
    material: "Jade folds balanced on a single point",
    accent: "#2f9e6e",
  },
  mailman: {
    title: "Mailman",
    role: "Operations & email",
    material: "Sprinting envelope with a red satchel",
    accent: "#c9524a",
  },
  ganga: {
    title: "Ganga",
    role: "Editorial & creative",
    material: "Turquoise river-flame carrying a page",
    accent: "#1fa89f",
  },
  signal: {
    title: "Signal",
    role: "Research",
    material: "Cyan radar moth with ribbon antennae",
    accent: "#1a95c4",
  },
  forge: {
    title: "Forge",
    role: "Builder",
    material: "Amber anvil-block with an ember heart",
    accent: "#d88a2c",
  },
} satisfies Record<
  AgentSpiritName,
  { title: string; role: string; material: string; accent: string }
>;

const SPIRIT_COMPONENT = {
  wormhole: WormholeSpirit,
  sensei: SenseiSpirit,
  mailman: MailmanSpiritII,
  ganga: GangaSpirit,
  signal: SignalSpirit,
  forge: ForgeSpirit,
} satisfies Record<AgentSpiritName, ComponentType<AgentSpiritProps>>;

export function AgentSpirit({
  spirit,
  ...props
}: AgentSpiritProps & { spirit: AgentSpiritName }) {
  const Component = SPIRIT_COMPONENT[spirit];
  return <Component {...props} />;
}

export {
  WormholeSpirit,
  SenseiSpirit,
  MailmanSpiritII,
  GangaSpirit,
  SignalSpirit,
  ForgeSpirit,
};
