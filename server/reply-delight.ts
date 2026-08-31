/** Add one restrained delight marker when the latest human message clearly
 * celebrates the result. Kept outside the model prompt so every provider has
 * the same behavior and an already-expressive reply is never decorated twice. */
export function addDelightEmoticon(text: string, latestUser: string): string {
  if (
    !latestUser ||
    /```|\p{Extended_Pictographic}|(?:^|\s)(?::[-^']?[)D]|[;][-^']?[)])(?=\s|$)/u.test(text)
  ) {
    return text;
  }
  if (
    !/(?:\b(?:love|like|great|good|nice|cool|awesome|amazing|perfect|brilliant|beautiful|fun|exactly|works|thank(?:s| you)?)\b|!{2,}|\bwoo+\b)/i.test(
      latestUser,
    )
  ) {
    return text;
  }
  const emoticon = /\b(?:love|awesome|amazing|perfect|brilliant|beautiful)\b/i.test(latestUser)
    ? " ✨"
    : /\b(?:fun|haha|lol)\b/i.test(latestUser)
      ? " :D"
      : " :)";
  return `${text.trimEnd()}${emoticon}`;
}
