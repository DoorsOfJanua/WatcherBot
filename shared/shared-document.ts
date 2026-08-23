// Bot replies sometimes link the real file they just created, for example
// `/Users/janua/Projects/FARMADA/STATE.md`. In a browser that leading slash
// looks like an app route, so the SPA opens itself instead of the document.
// Keep the recognition rule shared by renderer and server: the renderer
// rewrites only plausible local documents, and the server independently
// verifies that a bot actually shared the exact path before serving it.

const DOCUMENT_EXTENSION =
  /\.(?:md|markdown|txt|pdf|csv|tsv|json|ya?ml|docx?|xlsx?|pptx?|rtf|odt|ods|odp|png|jpe?g|gif|webp)$/i;

export function isLocalDocumentPath(value: string | undefined): value is string {
  if (
    !value ||
    value.startsWith("/api/") ||
    value.length > 4_096 ||
    value.includes("\0") ||
    /[\r\n]/.test(value) ||
    !DOCUMENT_EXTENSION.test(value)
  ) return false;
  return /^\/(?!\/)/.test(value) || /^[A-Za-z]:[\\/]/.test(value);
}

export function sharedDocumentHref(value: string | undefined): string | undefined {
  return isLocalDocumentPath(value)
    ? `/api/shared-documents?path=${encodeURIComponent(value)}`
    : value;
}

/** Exact markdown authorization. User-authored links do not count: the
 * caller must run this only against a stored bot message. Angle brackets are
 * also valid CommonMark destinations for paths containing spaces. */
export function botMessageSharesDocument(text: string | undefined, filePath: string): boolean {
  if (!text || !isLocalDocumentPath(filePath)) return false;
  return text.includes(`](${filePath})`) || text.includes(`](<${filePath}>)`);
}
