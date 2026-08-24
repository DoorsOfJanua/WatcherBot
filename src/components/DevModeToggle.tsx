// The plain-words / real-code switch. It sits directly on the cards it
// changes so the mode is discoverable exactly where someone wonders "but
// what is it actually going to run?" — and it is global, so one flip
// changes every card and chip at once.
import { Code2 } from "lucide-react";
import { setDevMode, useDevMode } from "@/lib/display-mode";
import { cn } from "@/lib/cn";

export function DevModeToggle({ className }: { className?: string }) {
  const dev = useDevMode();
  return (
    <button
      type="button"
      aria-pressed={dev}
      title={dev ? "Back to plain words" : "Show the exact code"}
      onClick={() => setDevMode(!dev)}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
        dev
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-hairline/50 text-ink-secondary hover:bg-raised hover:text-ink",
        className,
      )}
    >
      <Code2 size={12} /> Code
    </button>
  );
}
