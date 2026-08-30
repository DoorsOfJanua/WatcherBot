import { ChevronDown, Code2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** One universal escape hatch for backend evidence. Closed by default so
 * commands, JSON, ids and provider vocabulary never compete with the result. */
export function TechnicalDetails({
  detail,
  meta,
  label = "Details",
  className,
}: {
  detail?: string;
  meta?: string;
  label?: string;
  className?: string;
}) {
  if (!detail?.trim() && !meta?.trim()) return null;
  return (
    <details className={cn("group/details text-[12px] text-ink-secondary", className)}>
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md pr-2 font-medium hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <Code2 size={13} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown size={12} aria-hidden="true" className="transition-transform group-open/details:rotate-180" />
      </summary>
      <div className="max-w-[72ch] border-t border-hairline/35 pt-2">
        {meta?.trim() && <div className="mb-1 text-[11px] font-medium text-ink-secondary">{meta}</div>}
        {detail?.trim() && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-secondary/85">
            {detail}
          </pre>
        )}
      </div>
    </details>
  );
}
