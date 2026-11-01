import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunDto } from "@/api/contracts";
import { executeMoveBatch } from "@/server/game/moveBatch";
import { readRun } from "@/server/game/service";
import { bindGameSocket, parseSocketCommand } from "@/server/game/socket";

vi.mock("@/server/game/service", () => ({
  execute: vi.fn(),
  readRun: vi.fn(),
}));
vi.mock("@/server/game/moveBatch", () => ({ executeMoveBatch: vi.fn() }));
class FakeSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.emit("close");
  }
}
const sockets: FakeSocket[] = [];
const runId = "12345678-1234-4234-8234-123456789012";
const run = { id: runId, version: 1, status: "playing" } as RunDto;
const command = () => ({
  type: "action",
  runId,
  action: "move",
  body: {
    actionId: crypto.randomUUID(),
    expectedVersion: 1,
    pinId: 0,
    direction: 1,
  },
});
beforeEach(() => {
  vi.mocked(readRun).mockResolvedValue(run);
  vi.mocked(executeMoveBatch).mockReset();
});
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
});
async function socket() {
  const s = new FakeSocket();
  sockets.push(s);
  await bindGameSocket(s, "owner", runId, new Date(Date.now() + 60000));
  return s;
}
describe("WebSocket intent protocol", () => {
  it("rejects forged state, unknown fields, invalid versions and foreign run IDs", () => {
    expect(() =>
      parseSocketCommand({ ...command(), score: 999 }, runId),
    ).toThrow();
    const forged = command();
    Object.assign(forged.body, { oreNuggets: 999 });
    expect(() => parseSocketCommand(forged, runId)).toThrow();
    expect(() =>
      parseSocketCommand({ ...command(), runId: crypto.randomUUID() }, runId),
    ).toThrow();
    const stale = command();
    stale.body.expectedVersion = 0;
    expect(() => parseSocketCommand(stale, runId)).toThrow();
  });
  it("coalesces rapid moves and sends only committed responses", async () => {
    const s = await socket();
    let commit!: () => void;
    vi.mocked(executeMoveBatch).mockImplementationOnce(
      async (_owner, _id, commands) => {
        await new Promise<void>((resolve) => {
          commit = resolve;
        });
        return commands.map((input, index) => ({
          actionId: input.actionId,
          response: { run: { ...run, version: index + 2 }, outcome: "moved" },
        }));
      },
    );
    const first = command(),
      second = command();
    second.body.expectedVersion = 2;
    s.emit("message", Buffer.from(JSON.stringify(first)), false);
    s.emit("message", Buffer.from(JSON.stringify(second)), false);
    await vi.waitFor(() => expect(executeMoveBatch).toHaveBeenCalledOnce());
    expect(s.sent).toHaveLength(1);
    commit();
    await vi.waitFor(() => expect(s.sent).toHaveLength(3));
    expect(JSON.parse(s.sent[1]).actionId).toBe(first.body.actionId);
    expect(JSON.parse(s.sent[2]).response.run.version).toBe(3);
  });
  it("bounds malformed and oversized frames", async () => {
    const s = await socket();
    s.emit("message", Buffer.from("not-json"), false);
    expect(JSON.parse(s.sent[1]).error.code).toBe("INVALID_REQUEST");
    s.emit("message", Buffer.alloc(2049), false);
    expect(s.readyState).toBe(3);
  });
  it("revalidates expired sessions before processing input", async () => {
    const s = new FakeSocket();
    sockets.push(s);
    await bindGameSocket(s, "owner", runId, new Date(Date.now() - 1));
    s.emit("message", Buffer.from(JSON.stringify(command())), false);
    await vi.waitFor(() => expect(s.sent).toHaveLength(2));
    expect(JSON.parse(s.sent[1]).error.code).toBe("SESSION_REQUIRED");
    expect(executeMoveBatch).not.toHaveBeenCalled();
  });
});
