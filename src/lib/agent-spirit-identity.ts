import type { AgentSpiritName } from "@/components/spirits/AgentSpirit";

type SpiritIdentity = {
  name?: string;
  sharedMemoryId?: string;
};

const BY_MEMORY_ID = new Map<string, AgentSpiritName>([
  ["wormhole", "wormhole"],
  ["coach", "sensei"],
  ["mailroom", "mailman"],
  ["ganga", "ganga"],
  ["signal", "signal"],
  ["forge", "forge"],
]);

const BY_NAME = new Map<string, AgentSpiritName>([
  ["wormhole", "wormhole"],
  ["the watcher", "wormhole"],
  ["sensei", "sensei"],
  ["mailman", "mailman"],
  ["ganga", "ganga"],
  ["signal", "signal"],
  ["forge", "forge"],
]);

/**
 * Stable memory identity wins over a visible name so a renamed agent keeps
 * its own body. Unknown/custom agents stay on the classic avatar until they
 * receive an intentional spirit design.
 */
export function agentSpiritForBot(bot: SpiritIdentity): AgentSpiritName | null {
  const memoryId = bot.sharedMemoryId?.trim().toLowerCase();
  if (memoryId) {
    const match = BY_MEMORY_ID.get(memoryId);
    if (match) return match;
  }
  const name = bot.name?.trim().toLowerCase();
  return name ? (BY_NAME.get(name) ?? null) : null;
}
