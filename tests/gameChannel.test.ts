// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunDto } from "@/api/contracts";
import type { SocketReply } from "@/api/realtime";
import { GameChannel } from "@/client/game/channel";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor(public url: URL) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  receive(message: SocketReply) {
    if (message.type === "ready") this.readyState = 1;
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}
function latestSocket() {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("Missing test socket");
  return socket;
}
function fixture(): RunDto {
  return {
    id: "12345678-1234-4234-8234-123456789012",
    version: 1,
    rulesetVersion: "deterministic-ore-v1",
    status: "playing",
    chestIndex: 1,
    openedChests: 0,
    oreNuggets: 20,
    lockpicks: 3,
    difficulty: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    reward: null,
    result: null,
    currentLock: {
      pins: [{ id: 0, position: 0, min: 0, max: 6, target: 4 }],
      invalidMovesOnCurrentPick: 0,
      maxInvalidMovesPerPick: 3,
      moveRules: [
        { sourcePinId: 0, direction: 1, effects: [{ pinId: 0, delta: 1 }] },
        { sourcePinId: 0, direction: -1, effects: [{ pinId: 0, delta: -1 }] },
      ],
    },
  };
}
const channels: GameChannel[] = [];
function connected(run = fixture()) {
  const changed = vi.fn(),
    failed = vi.fn();
  const channel = new GameChannel(run, changed, failed);
  channels.push(channel);
  channel.connect();
  const socket = latestSocket();
  socket.receive({ type: "ready", run });
  return { channel, socket, changed, failed };
}
beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => {
  for (const channel of channels.splice(0)) channel.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("WebSocket gameplay and visual prediction", () => {
  it("renders immediately and sends a rapid burst before any acknowledgements", () => {
    const { channel, socket } = connected();
    for (let index = 0; index < 20; index++) {
      const view = channel.move(0, index % 2 === 0 ? 1 : -1);
      expect(view?.currentLock.pins[0].position).toBe(index % 2 === 0 ? 1 : 0);
      expect(view?.oreNuggets).toBe(20);
    }
    expect(socket.sent).toHaveLength(20);
    expect(socket.sent.map((x) => JSON.parse(x).body.expectedVersion)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(channel.confirmed.version).toBe(1);
    const first = JSON.parse(socket.sent[0]);
    socket.receive({
      type: "result",
      actionId: first.body.actionId,
      response: {
        run: {
          ...fixture(),
          version: 2,
          currentLock: {
            ...fixture().currentLock,
            pins: [{ ...fixture().currentLock.pins[0], position: 1 }],
          },
        },
        outcome: "moved",
      },
    });
    expect(channel.view.run.currentLock.pins[0].position).toBe(0);
    expect(channel.pendingCount).toBe(19);
  });
  it("opens rewards only after server confirmation and never predicts ore", () => {
    const run = fixture();
    run.currentLock.pins[0].target = 1;
    const { channel, socket } = connected(run);
    const view = channel.move(0, 1);
    expect(view?.status).toBe("playing");
    expect(view?.reward).toBeNull();
    expect(view?.oreNuggets).toBe(20);
    expect(channel.move(0, -1)).toBeNull();
    const command = JSON.parse(socket.sent[0]);
    socket.receive({
      type: "result",
      actionId: command.body.actionId,
      response: {
        run: {
          ...run,
          version: 2,
          status: "chest_opened",
          reward: { oreNuggets: 10, lockpicks: 0 },
          result: null,
        },
        outcome: "chest_opened",
      },
    });
    expect(channel.confirmed.status).toBe("chest_opened");
    expect(channel.confirmed.reward?.oreNuggets).toBe(10);
  });
  it("replays the same action after disconnect without predicting it twice", () => {
    vi.useFakeTimers();
    const { channel, socket } = connected();
    channel.move(0, 1);
    const original = socket.sent[0];
    socket.close();
    vi.advanceTimersByTime(250);
    const reconnected = latestSocket();
    reconnected.receive({
      type: "ready",
      run: {
        ...fixture(),
        version: 2,
        currentLock: {
          ...fixture().currentLock,
          pins: [{ ...fixture().currentLock.pins[0], position: 1 }],
        },
      },
    });
    expect(reconnected.sent[0]).toBe(original);
    expect(channel.view.run.currentLock.pins[0].position).toBe(1);
    reconnected.receive({
      type: "result",
      actionId: JSON.parse(original).body.actionId,
      response: { run: channel.confirmed, outcome: "moved" },
    });
    expect(channel.pendingCount).toBe(0);
    expect(channel.confirmed.version).toBe(2);
  });
  it("discards queued predictions and restores the server snapshot after a conflict", async () => {
    const { channel, socket } = connected();
    channel.move(0, 1);
    channel.move(0, -1);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ run: { ...fixture(), version: 9 } })),
        ),
    );
    socket.receive({
      type: "error",
      actionId: JSON.parse(socket.sent[0]).body.actionId,
      status: 409,
      error: { code: "VERSION_CONFLICT", requestId: crypto.randomUUID() },
    });
    await vi.waitFor(() => expect(channel.confirmed.version).toBe(9));
    expect(channel.pendingCount).toBe(0);
    expect(channel.view.run.currentLock.pins[0].position).toBe(0);
  });
});
