import { describe, expect, it } from "vitest";
import { checkNames, checkPaths } from "../../scripts/check-names.cjs";

describe("filename and mirrored test conventions", () => {
  it("checks the repository, including untracked new files", () => {
    expect(checkNames()).toEqual([]);
  });

  it("allows framework, tooling, generated and upstream names", () => {
    expect(
      checkPaths([
        "AGENTS.md",
        "README.md",
        ".env.example",
        "next.config.ts",
        "vitest.config.ts",
        "src/app/[lang]/page.tsx",
        "src/app/[id]/route.ts",
        "src/app/[...slug]/loading.tsx",
        "src/app/[[...slug]]/not-found.tsx",
        "src/app/(group)/@modal/default.tsx",
        "src/app/_private/error.tsx",
        "src/app/layout.tsx",
        "src/app/api/runs/[id]/route.ts",
        "tests/app/api/runs/[id]/route.test.ts",
        "src/types/example.d.ts",
        ".agents/skills/delivery/SKILL.md",
        ".github/workflows/ci.yml",
        "src/assets/images/T_TitleLine_Small.png",
        "drizzle/meta/0000_snapshot.json",
        "node_modules/Vendor/File.js",
        "public/Cursor.png",
        "src/game/create-lock.ts",
        "tests/game/create-lock.test.ts",
        "src/features/gameplay/view.tsx",
        "tests/features/gameplay/view.spec.tsx",
        "scripts/check-names.cjs",
        "tests/scripts/check-names.test.ts",
        "tests/integration/gameplay/dialogs.test.ts",
        "tests/fixtures/run.ts",
      ]),
    ).toEqual([]);
  });

  it.each([
    "src/game/createLock.ts",
    "src/features/GamePlay/view.tsx",
    "src/game/create_lock.ts",
    "tests/game/CreateLock.test.ts",
    "src/app/[BadParam]/page.tsx",
    "src/game/bad..ts",
    "src/game/good.bad.ts",
    "scripts/CheckNames.cjs",
    "src/drizzle/BadFile.ts",
  ])("rejects inconsistent names: %s", (file) => {
    expect(checkPaths([file]).join("\n")).toContain("kebab-case");
  });

  it("rejects colocated and mismatched tests", () => {
    expect(checkPaths(["src/game/movement.test.ts"]).join("\n")).toContain(
      "tests belong under tests/",
    );
    expect(
      checkPaths(["src/game/movement.ts", "tests/movement.test.ts"]).join("\n"),
    ).toContain("must mirror");
    expect(
      checkPaths(["src/game/movement.ts", "tests/game/movement.test.ts"]).join(
        "\n",
      ),
    ).toBe("");
  });
});
