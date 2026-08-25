import { cn } from "@/lib/cn";

export type MailProvider = "gmail" | "proton-bridge";

export function mailProviderFromDetail(detail: string): MailProvider | undefined {
  const from = detail.match(/^From:\s*([^\n]+)/im)?.[1]?.toLowerCase() ?? "";
  if (from.includes("proton") || from.includes("@pm.me")) return "proton-bridge";
  if (from.includes("gmail") || from.includes("google")) return "gmail";
  return undefined;
}

/** Small, local provider marks keep long conversations scannable without
 * loading remote brand assets or leaking mailbox details to an image host. */
export function ProviderMark({ provider, className }: { provider: MailProvider; className?: string }) {
  const proton = provider === "proton-bridge";
  return (
    <span
      aria-label={proton ? "Proton Mail" : "Gmail"}
      title={proton ? "Proton Mail" : "Gmail"}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] border text-[14px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        proton ? "border-[#8d6cff]/30 bg-[#8d6cff]/12 text-[#aa91ff]" : "border-[#ea4335]/25 bg-[#fff7f6] text-[#d93025]",
        className,
      )}
    >
      {proton ? "P" : "G"}
    </span>
  );
}
