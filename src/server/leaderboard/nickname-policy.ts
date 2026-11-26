import { Filter } from "glin-profanity";

const filter = new Filter({
  languages: ["english", "polish", "german", "russian"],
  wordBoundaries: false,
  normalizeUnicode: false,
  detectLeetspeak: true,
  leetspeakLevel: "moderate",
  obfuscation: "off",
});

export function isBlockedNickname(nickname: string): boolean {
  const comparison = nickname
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ß/g, "ss");
  return (
    filter.checkProfanity(comparison).containsProfanity ||
    // Glin stores German words with ß; retain the existing ss equivalence.
    (comparison.includes("ss") &&
      filter.checkProfanity(comparison.replace(/ss/g, "ß")).containsProfanity)
  );
}
