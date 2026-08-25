import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  FileText,
  Files,
  Folder,
  Globe2,
  Loader2,
  Monitor,
  RefreshCw,
  X,
} from "lucide-react";
import { useStore, type Bot as BotType } from "@/state/store";
import { cn } from "@/lib/cn";
import { ComputerPanel } from "./ComputerPanel";

// The per-agent workbench: every tab here is real. Surfaces that still need
// their backing (inbox as the approvals/receipts feed, a generic desk) join
// as tabs when the data exists — no placeholder tabs, no instance-specific
// content. This panel must stay universal: nothing in it may name a
// particular user's bots, projects, or local services.
type WorkbenchTab = "computer" | "browser" | "files";

const tabs: Array<{ id: WorkbenchTab; label: string; icon: typeof Monitor }> = [
  { id: "computer", label: "Computer", icon: Monitor },
  { id: "browser", label: "Browser", icon: Globe2 },
  { id: "files", label: "Files", icon: Files },
];

async function api(path: string): Promise<any> {
  const res = await fetch(path, { headers: { "content-type": "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

// A deliberate non-iframe: embedding arbitrary sites in the app renderer
// would share its session and die on X-Frame-Options anyway. Navigation
// happens in the app's hardened viewer window (isolated session partition,
// denied permissions, confined navigation) — same mechanism as the live
// desktop.
function BrowserSurface({ bot }: { bot: BotType }) {
  const [url, setUrl] = useState("https://");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^https:\/\/[^\s]+\.[^\s]+/i.test(url.trim());
  const openSecureViewer = async () => {
    if (!valid || opening) return;
    setOpening(true);
    setError(null);
    try {
      const target = url.trim();
      if (window.ogb?.desktopViewer?.open) {
        const opened = await window.ogb.desktopViewer.open(target, `${bot.name} · browser`, `browser:${bot.id}`);
        if (!opened) throw new Error("The browser window could not be opened");
      } else if (window.ogb?.openExternal) {
        await window.ogb.openExternal(target);
      } else if (!window.open(target, "_blank", "noopener")) {
        throw new Error("Your browser blocked the window");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(false);
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-hairline/40 p-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void openSecureViewer();
          }}
        >
          <input
            aria-label="Web address"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-hairline/50 bg-inset px-3 py-2 text-[12px] text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!valid || opening}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {opening ? <Loader2 size={13} className="animate-spin" /> : <Globe2 size={13} />}
            Open
          </button>
        </form>
        {error && <div className="mt-2 text-[11.5px] text-danger">{error}</div>}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <Globe2 size={22} className="text-ink-secondary/60" />
        <div className="max-w-[340px] text-[12.5px] leading-relaxed text-ink-secondary">
          Pages open in the app’s secure browser window: isolated cookies, no shared session with the app.
          Watching {bot.name} browse live happens on the Computer tab.
        </div>
      </div>
    </div>
  );
}

type WorkspaceEntry = { path: string; kind: "file" | "dir"; bytes: number; mtime: number };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Read-only window into the bot's workspace — the folder its file tools and
// memory already live in. Writes stay with the bot; the user's editor is the
// filesystem itself (the path is shown for exactly that).
function FilesSurface({ bot }: { bot: BotType }) {
  const [entries, setEntries] = useState<WorkspaceEntry[] | null>(null);
  const [dir, setDir] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ path: string; text: string; truncated: boolean } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  // Responses land in click order, not send order: a slow fetch for file A
  // (or the previous bot) must never overwrite what a later click asked for.
  // Each request takes a token; only the newest token may write state.
  const listSeq = useRef(0);
  const previewSeq = useRef(0);

  const refresh = useCallback(() => {
    const seq = ++listSeq.current;
    setError(null);
    api(`/api/bots/${bot.id}/workspace/files`)
      .then((result) => {
        if (seq !== listSeq.current) return;
        setEntries(result.entries);
        setDir(result.dir);
        setTruncated(Boolean(result.truncated));
      })
      .catch((err) => {
        if (seq !== listSeq.current) return;
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [bot.id]);

  useEffect(() => {
    previewSeq.current += 1;
    setEntries(null);
    setSelected(null);
    setPreview(null);
    setPreviewError(null);
    refresh();
  }, [refresh]);

  const openFile = (path: string) => {
    const seq = ++previewSeq.current;
    setSelected(path);
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(true);
    api(`/api/bots/${bot.id}/workspace/file?path=${encodeURIComponent(path)}`)
      .then((result) => {
        if (seq !== previewSeq.current) return;
        setPreview({ path, text: result.text, truncated: Boolean(result.truncated) });
      })
      .catch((err) => {
        if (seq !== previewSeq.current) return;
        setPreviewError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (seq !== previewSeq.current) return;
        setLoadingPreview(false);
      });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-secondary" title={dir}>
          {dir || "Workspace"}
        </span>
        {truncated && <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning">Partial list</span>}
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh files"
          className="shrink-0 rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <RefreshCw size={13} />
        </button>
      </div>
      {error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[12.5px] text-danger">{error}</div>
      ) : entries === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={18} className="animate-spin text-ink-secondary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Folder size={22} className="text-ink-secondary/60" />
          <div className="max-w-[320px] text-[12.5px] leading-relaxed text-ink-secondary">
            Nothing here yet. This folder fills as {bot.name} works — outputs, drafts, and memory land here.
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={cn("min-h-0 overflow-y-auto", selected ? "max-h-[38%] border-b border-hairline/40" : "flex-1")}>
            {entries.map((entry) => {
              const depth = entry.path.split("/").length - 1;
              const name = entry.path.split("/").at(-1) ?? entry.path;
              return (
                <button
                  key={entry.path}
                  type="button"
                  disabled={entry.kind === "dir"}
                  onClick={() => entry.kind === "file" && openFile(entry.path)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px]",
                    entry.kind === "dir" ? "cursor-default text-ink-secondary" : "text-ink hover:bg-raised/60",
                    selected === entry.path && "bg-raised",
                  )}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  {entry.kind === "dir" ? (
                    <Folder size={13} className="shrink-0 text-ink-secondary" />
                  ) : (
                    <FileText size={13} className="shrink-0 text-accent/80" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {entry.kind === "file" && (
                    <span className="shrink-0 text-[10.5px] tabular-nums text-ink-secondary">{formatBytes(entry.bytes)}</span>
                  )}
                </button>
              );
            })}
          </div>
          {selected && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-ink-secondary">
                <ChevronRight size={11} />
                <span className="min-w-0 flex-1 truncate">{selected}</span>
                {preview?.truncated && <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning">Preview cut</span>}
                <button
                  type="button"
                  onClick={() => {
                    previewSeq.current += 1;
                    setSelected(null);
                    setPreview(null);
                    setPreviewError(null);
                    setLoadingPreview(false);
                  }}
                  aria-label="Close preview"
                  className="shrink-0 rounded-md p-0.5 hover:bg-raised hover:text-ink"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
                {loadingPreview ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-ink-secondary" />
                  </div>
                ) : previewError ? (
                  <div className="text-[12px] text-ink-secondary">{previewError}</div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-inset/60 p-3 font-mono text-[11.5px] leading-relaxed text-ink">
                    {preview?.text || "(empty file)"}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkbenchPanel({ bot }: { bot: BotType }) {
  const { dispatch } = useStore();
  const [tab, setTab] = useState<WorkbenchTab>("computer");
  const tabLabel = useMemo(() => tabs.find((item) => item.id === tab)?.label ?? "Workbench", [tab]);
  return (
    <aside
      aria-label={`${bot.name} workbench`}
      className="animate-panel-in flex h-full w-[min(520px,46vw)] min-w-[360px] shrink-0 flex-col border-l border-hairline/40 bg-panel"
    >
      <header className="border-b border-hairline/40 px-3 pt-3">
        <div className="flex items-center gap-2 px-1 pb-2">
          <Bot size={15} className="text-accent" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
            {bot.name} · {tabLabel}
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "toggleComputer", open: false })}
            aria-label="Close workbench"
            className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <nav aria-label="Workbench surfaces" className="flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-lg px-2.5 py-2 text-[11.5px]",
                tab === id ? "bg-raised font-medium text-ink" : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "computer" && <ComputerPanel bot={bot} embedded />}
        {tab === "browser" && <BrowserSurface bot={bot} />}
        {tab === "files" && <FilesSurface bot={bot} />}
      </div>
    </aside>
  );
}
