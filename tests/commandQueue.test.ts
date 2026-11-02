import { describe, expect, it } from "vitest";
import { CommandQueue } from "@/client/game/commandQueue";
import { moveCommand, runDto } from "./fixtures/run";

describe("command reconciliation", () => {
  it("keeps replay identity while excluding already committed moves from prediction", () => {
    const queue = new CommandQueue(runDto());
    const first = moveCommand(1),
      second = moveCommand(2);
    queue.pending.push(
      { command: first, sent: true },
      { command: second, sent: true },
    );
    const newer = runDto();
    newer.version = 3;
    newer.currentLock.pins[0].position = 2;
    queue.accept(newer);
    expect(queue.view.run.currentLock.pins[0].position).toBe(2);
    expect(queue.pending.map((item) => item.command)).toEqual([first, second]);
    expect(queue.acknowledge(second.body.actionId, newer)).toBe(false);
    expect(
      queue.acknowledge(first.body.actionId, { ...newer, version: 2 }),
    ).toBe(true);
    expect(queue.confirmed.version).toBe(3);
    expect(queue.acknowledge(second.body.actionId, newer)).toBe(true);
    expect(queue.pending).toHaveLength(0);
  });
  it("rejects foreign or older snapshots and clears speculative intents on resync", () => {
    const queue = new CommandQueue(runDto());
    queue.pending.push({ command: moveCommand(), sent: false });
    expect(queue.accept({ ...runDto(), id: "other" })).toBe(false);
    expect(queue.accept({ ...runDto(), version: 0 })).toBe(false);
    expect(
      queue.acknowledge(queue.pending[0].command.body.actionId, {
        ...runDto(),
        id: "other",
      }),
    ).toBe(false);
    queue.clear();
    expect(queue.view.run).toEqual(runDto());
  });
});
