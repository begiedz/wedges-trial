import { describe, expect, it } from "vitest";
import { isBlockedNickname } from "@/server/leaderboard/nickname-policy";

const fixtures = {
  en: ["fuck", "shit", "asshole"],
  pl: ["kurwa", "chuj", "dupa"],
  de: ["arschloch", "fick", "scheiße"],
  ru: ["хуй", "мудак", "блядь"],
};

describe("Glin nickname moderation", () => {
  it.each(Object.entries(fixtures))(
    "blocks %s words regardless of UI language",
    (_language, words) => {
      for (const word of words) {
        expect(isBlockedNickname(`player${word}99`), word).toBe(true);
        expect(isBlockedNickname(word.toUpperCase()), word).toBe(true);
      }
    },
  );
  it("normalizes compatibility characters", () => {
    expect(isBlockedNickname("ＦＵＣＫ")).toBe(true);
  });
  it.each(["scheiße", "SCHEISSE", "SCHEIẞE"])(
    "folds German sharp s in %s",
    (name) => {
      expect(isBlockedNickname(name)).toBe(true);
    },
  );
  it.each([
    "Wedge",
    "Żółw",
    "Łukasz",
    "Jürgen",
    "Weiß",
    "Клин",
    "Михаил",
    "😀",
  ])("allows %s", (name) => {
    expect(isBlockedNickname(name)).toBe(false);
  });
  it("uses Glin detection including approximate matches", () => {
    expect(isBlockedNickname("f.u.c.k")).toBe(true);
  });
  it("blocks substitutions explicitly present in the package vocabulary", () => {
    expect(isBlockedNickname("sh1t")).toBe(true);
  });
});
