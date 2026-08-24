/**
 * Keep an in-progress speech transcript monotonic without freezing Apple's
 * legitimate revisions. SFSpeechRecognizer normally sends the whole current
 * hypothesis, but after a pause it can restart with only the newest phrase.
 * Treating every callback as the whole message makes everything spoken before
 * that pause disappear from the composer.
 */
export function mergeDictationTranscript(previous: string, incoming: string): string {
  const before = clean(previous);
  const next = clean(incoming);
  if (!next) return before;
  if (!before || equalFolded(before, next)) return next || before;

  const beforeFolded = before.toLocaleLowerCase();
  const nextFolded = next.toLocaleLowerCase();

  // The ordinary case: the recognizer grows (or briefly shrinks) one running
  // hypothesis. A shrink is never allowed to destroy already visible speech.
  if (nextFolded.startsWith(beforeFolded)) return next;
  if (beforeFolded.startsWith(nextFolded)) return before;

  const oldWords = words(before);
  const newWords = words(next);
  const sharedPrefix = commonPrefix(oldWords, newWords);

  // Apple revises words inside the current phrase. A meaningful shared start
  // identifies that as a correction, not a new phrase after a pause.
  if (sharedPrefix >= 2 || (sharedPrefix === 1 && Math.min(oldWords.length, newWords.length) <= 3)) {
    return next;
  }

  // A pause makes the recognizer restart and re-send a phrase it already
  // delivered. The stitching overlap below only looks a few words back, so
  // without this a repeat longer than that window lands in the composer twice.
  if (endsWithPhrase(oldWords, newWords)) return before;

  // A restarted phrase sometimes repeats the final word or two. Remove that
  // overlap before appending so "the door" + "door is open" stays natural.
  const overlap = suffixPrefixOverlap(oldWords, newWords);
  const addition = newWords.slice(overlap).join(" ");
  return addition ? `${before} ${addition}` : before;
}

export function joinDictation(base: string, spoken: string): string {
  const left = clean(base);
  const right = clean(spoken);
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function equalFolded(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function foldedWord(value: string): string {
  return value.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function commonPrefix(a: string[], b: string[]): number {
  let count = 0;
  while (count < a.length && count < b.length && foldedWord(a[count]) === foldedWord(b[count])) count += 1;
  return count;
}

/** Whether every word of `b` is already sitting at the end of `a`. */
function endsWithPhrase(a: string[], b: string[]): boolean {
  if (b.length === 0 || b.length > a.length) return false;
  return a.slice(-b.length).every((word, index) => {
    const left = foldedWord(word);
    return Boolean(left) && left === foldedWord(b[index]);
  });
}

function suffixPrefixOverlap(a: string[], b: string[]): number {
  const maximum = Math.min(a.length, b.length, 6);
  for (let size = maximum; size > 0; size -= 1) {
    const left = a.slice(-size).map(foldedWord);
    const right = b.slice(0, size).map(foldedWord);
    if (left.every((word, index) => word && word === right[index])) return size;
  }
  return 0;
}
