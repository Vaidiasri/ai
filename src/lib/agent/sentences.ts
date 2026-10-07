// Spec 0004: splits a streaming reply into sentences so voice mode can speak
// each one as soon as it is complete. A sentence ends at . ! ? or the danda
// (।) followed by whitespace, or at a newline. "Dr." and similar titles do not
// end a sentence. Whatever is left waits for more text, or for the stream end.
const END = /([.!?।]+)(\s+)|\n+/g;
const TITLE = /\b(Dr|Mr|Mrs|Ms|St)\.$/;

export function takeSentences(text: string) {
  const sentences: string[] = [];
  let start = 0;
  for (const m of text.matchAll(END)) {
    const cut = m.index + (m[1] ? m[1].length : 0);
    const sentence = text.slice(start, cut).trim();
    if (m[1] && TITLE.test(sentence)) continue;
    if (sentence) sentences.push(sentence);
    start = m.index + m[0].length;
  }
  return { sentences, rest: text.slice(start) };
}
