import { useEffect, useRef, useState } from "react";
import { FileUp, ImagePlus, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  fileAttachmentFromFile,
  imageAttachmentFromFile,
  isImageFile,
  type Attachment,
} from "@/lib/composer-attachments";

function pathForFile(file: File): string {
  return window.ogb?.getPathForFile?.(file) ?? "";
}

function currentDeviceLabel(): string {
  if (window.ogb) return "Browse this computer";
  const phone = window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;
  return phone ? "Browse this phone" : "Browse this computer";
}

export function ComposerAddMenu({
  allowImages,
  disabled = false,
  onAdd,
  onError,
}: {
  allowImages: boolean;
  disabled?: boolean;
  onAdd: (attachments: Attachment[]) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const acceptFiles = async (files: FileList | null, photosOnly: boolean) => {
    if (!files?.length) return;
    setOpen(false);
    setUploading(true);
    const attachments: Attachment[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        if (isImageFile(file)) {
          if (!allowImages) throw new Error("The selected agent cannot inspect images with its current model.");
          const image = await imageAttachmentFromFile(file);
          if (image) attachments.push(image);
        } else if (photosOnly) {
          errors.push(`${file.name}: unsupported image format`);
        } else {
          attachments.push(await fileAttachmentFromFile(file, pathForFile));
        }
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      }
    }
    if (attachments.length) onAdd(attachments);
    if (errors.length) onError(errors.join("\n"));
    setUploading(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled || uploading}
        aria-label="Add photos or files"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Add photos or files"
        className={cn(
          "flex size-11 items-center justify-center rounded-full text-ink-secondary transition-colors",
          "hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          "disabled:cursor-not-allowed disabled:opacity-45 md:size-8",
          open && "bg-raised text-ink",
        )}
      >
        {uploading ? <Loader2 size={18} className="animate-spin md:size-4" /> : <Plus size={20} className="md:size-[18px]" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close attachment menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default bg-transparent"
          />
          <div
            role="menu"
            aria-label="Add to message"
            className="absolute bottom-full left-0 z-30 mb-3 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-hairline/50 bg-panel p-1.5 shadow-2xl"
          >
            <button
              type="button"
              role="menuitem"
              disabled={!allowImages}
              onClick={() => photoInput.current?.click()}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ImagePlus size={18} className="shrink-0 text-ink-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Photo or camera</span>
                {!allowImages && <span className="block text-[11px] text-ink-secondary">Current model cannot inspect images</span>}
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => fileInput.current?.click()}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-medium text-ink transition-colors hover:bg-raised"
            >
              <FileUp size={18} className="shrink-0 text-ink-secondary" />
              {currentDeviceLabel()}
            </button>
          </div>
        </>
      )}

      <input
        ref={photoInput}
        type="file"
        aria-label="Select photos"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          void acceptFiles(event.currentTarget.files, true);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        aria-label="Select files from this device"
        multiple
        className="sr-only"
        onChange={(event) => {
          void acceptFiles(event.currentTarget.files, false);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
