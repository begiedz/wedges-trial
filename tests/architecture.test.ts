import { describe, expect, it } from "vitest";
import {
  checkArchitecture,
  checkSources,
} from "../scripts/check-boundaries.cjs";

describe("architecture boundaries", () => {
  it("checks the repository including runtime and type dependency cycles", () => {
    expect(checkArchitecture()).toEqual([]);
  });

  it.each([
    [
      "src/features/other/view.tsx",
      'import { GameClient } from "@/features/gameplay/components/game/GameClient";',
    ],
    ["src/features/other/view.tsx", 'export * from "@/features/gameplay";'],
    ["src/components/ui/button.tsx", 'import "@/features/gameplay";'],
    ["src/components/general/nav.tsx", 'import "@/client/game/session";'],
    [
      "src/app/page.tsx",
      'export * from "@/features/gameplay/components/game/GameClient";',
    ],
    ["src/features/gameplay/view.tsx", 'import "@/server/game/service";'],
    ["src/features/gameplay/view.tsx", 'import "../../server/game/service";'],
    ["src/features/gameplay/view.tsx", 'import "@/app/page";'],
    ["src/game/bad.ts", 'import "react";'],
    ["src/game/bad.ts", 'import "@/client/game/session";'],
    ["src/game/bad.ts", 'fetch("/api");'],
    ["src/game/bad.ts", 'window.localStorage.getItem("game");'],
    ["src/client/game/bad.ts", 'import "react";'],
    ["src/client/game/bad.ts", 'import "next/navigation";'],
    ["src/client/game/bad.ts", 'import "@/features/gameplay";'],
    ["src/api/bad.ts", 'type Bad = import("@/server/game/types").Bad;'],
    ["src/api/bad.ts", 'import "node:crypto";'],
    ["src/server/game/bad.ts", 'import "@/client/game/session";'],
    [
      "src/features/gameplay/view.tsx",
      'const service = import("@/server/game/service");',
    ],
    [
      "src/features/gameplay/view.tsx",
      'const service = require("@/server/game/service");',
    ],
  ])("rejects forbidden dependency in %s: %s", (file, code) => {
    const errors = checkSources({ [file]: code });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain(`${file}:1:`);
  });

  it("allows route composition, private imports within a feature and independent client/domain layers", () => {
    expect(
      checkSources({
        "src/app/page.tsx": 'import "@/features/gameplay";',
        "src/features/gameplay/index.ts": 'export * from "./view";',
        "src/features/gameplay/view.tsx":
          'import "@/client/game/session"; import "@/components/ui/button";',
        "src/components/ui/button.tsx": 'import "react";',
        "src/client/game/session.ts": 'import "@/api/contracts";',
        "src/api/contracts.ts": 'import type { Pin } from "@/game/types";',
        "src/game/types.ts": "export type Pin = number;",
      }),
    ).toEqual([]);
  });

  it("detects server-only dependencies hidden behind shared helpers", () => {
    expect(
      checkSources({
        "src/features/gameplay/view.tsx": 'import "@/lib/helper";',
        "src/lib/helper.ts": 'import "./private";',
        "src/lib/private.ts": 'import "server-only";',
      }).join("\n"),
    ).toContain("src/lib/helper.ts -> src/lib/private.ts");
  });

  it.each(["pg", "node:fs", "fs", "drizzle-orm/node-postgres"])(
    "rejects server runtime %s in client code",
    (dependency) => {
      expect(
        checkSources({
          "src/features/gameplay/view.tsx": `import "${dependency}";`,
        }).join("\n"),
      ).toContain("server-only dependency");
    },
  );

  it("normalizes alias traversal and resolves JavaScript extensions to TypeScript", () => {
    expect(
      checkSources({
        "src/game/bad.ts": 'import "@/game/../server/game/service";',
      }).join("\n"),
    ).toContain("Domain may depend only");
    expect(
      checkSources({
        "src/features/gameplay/view.tsx": 'import "@/lib/helper.js";',
        "src/lib/helper.ts": 'import "node:fs";',
      }).join("\n"),
    ).toContain("src/lib/helper.ts");
  });

  it("detects cycles through re-exports, relative paths and aliases", () => {
    expect(
      checkSources({
        "src/features/gameplay/index.ts": 'export * from "./view";',
        "src/features/gameplay/view.tsx": 'import "@/features/gameplay";',
      }).join("\n"),
    ).toContain("Circular dependency");
  });
});
