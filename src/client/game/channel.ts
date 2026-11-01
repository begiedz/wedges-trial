import type { RunDto } from "@/api/contracts";
import type { SocketCommand, SocketReply } from "@/api/realtime";
import { applyMoveToLock } from "@/game/applyMove";
import type { Direction, LockState } from "@/game/types";

export class TransportError extends Error {
  constructor(public status: number) {
    super("REQUEST_FAILED");
  }
}
export async function gameRequest(
  path: string,
  body?: Record<string, unknown>,
): Promise<{ run: RunDto | null; outcome?: string }> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) throw new TransportError(response.status);
  const value = await response.json();
  if (path === "/api/players/session") return { run: null };
  if (
    !value ||
    !("run" in value) ||
    (value.run !== null &&
      (!Number.isSafeInteger(value.run.version) ||
        typeof value.run.id !== "string" ||
        !Array.isArray(value.run.currentLock?.pins)))
  )
    throw new TypeError("INVALID_RESPONSE");
  return value;
}
type QueuedInput = { command: SocketCommand; sent: boolean };
export type Prediction = { run: RunDto; terminal: boolean };
/** Rendering-only prediction. Confirmed resources/status/rewards always come from the server. */
export function predictRun(
  confirmed: RunDto,
  inputs: SocketCommand[],
): Prediction {
  if (confirmed.status !== "playing" || !confirmed.currentLock.moveRules)
    return { run: confirmed, terminal: confirmed.status !== "playing" };
  let lock: LockState = {
    ...confirmed.currentLock,
    pins: confirmed.currentLock.pins.map((pin) => ({ ...pin })),
    rules: confirmed.currentLock.moveRules,
    isSolved: false,
    isFailed: false,
  };
  let picks = confirmed.lockpicks;
  for (const input of inputs) {
    if (input.action !== "move" || lock.isSolved || lock.isFailed) break;
    const { pinId, direction } = input.body;
    if (pinId === undefined || direction === undefined) break;
    const moved = applyMoveToLock(lock, pinId, direction);
    if (moved.kind === "valid") lock = moved.lock;
    else if (moved.kind === "invalid") {
      const damage = lock.invalidMovesOnCurrentPick + 1;
      if (damage === 3) picks--;
      lock = {
        ...lock,
        invalidMovesOnCurrentPick: damage % 3,
        isFailed: picks <= 0,
      };
    }
  }
  return {
    run: {
      ...confirmed,
      currentLock: {
        ...confirmed.currentLock,
        pins: lock.pins,
        invalidMovesOnCurrentPick: lock.invalidMovesOnCurrentPick,
      },
    },
    terminal: lock.isSolved || lock.isFailed,
  };
}
export class GameChannel {
  confirmed: RunDto;
  private queue: QueuedInput[] = [];
  private socket: WebSocket | null = null;
  private mode: "connecting" | "socket" | "http" = "connecting";
  private stopped = false;
  private paused = false;
  private httpBusy = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private connectedOnce = false;
  private waiters: Array<() => void> = [];
  private generation = 0;
  private resyncing = false;
  constructor(
    run: RunDto,
    private changed: (view: RunDto, confirmed: RunDto) => void,
    private failed: (failed: boolean) => void,
  ) {
    this.confirmed = run;
  }
  get pendingCount() {
    return this.queue.length;
  }
  get view() {
    return predictRun(
      this.confirmed,
      this.queue
        .filter(
          (item) => item.command.body.expectedVersion >= this.confirmed.version,
        )
        .map((item) => item.command),
    );
  }
  connect() {
    if (this.stopped || this.socket) return;
    if (typeof WebSocket === "undefined") {
      this.mode = "http";
      void this.flushHttp();
      return;
    }
    const url = new URL("/api/game/socket", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("run", this.confirmed.id);
    const socket = new WebSocket(url);
    this.socket = socket;
    let ready = false;
    const handshakeTimeout = setTimeout(() => socket.close(), 5000);
    this.timeout = handshakeTimeout;
    socket.onmessage = (event) => {
      if (this.stopped || socket !== this.socket) return;
      let message: SocketReply;
      try {
        message = JSON.parse(event.data);
      } catch {
        socket.close(1002, "Invalid response");
        return;
      }
      if (message.type === "ping") {
        socket.send('{"type":"pong"}');
        return;
      }
      if (message.type === "ready") {
        clearTimeout(handshakeTimeout);
        ready = true;
        this.connectedOnce = true;
        this.retries = 0;
        this.mode = "socket";
        this.paused = false;
        // A reconnect snapshot may already include unacknowledged actions. Replay their
        // original IDs/versions first; do not predict those committed moves a second time.
        this.acceptSnapshot(message.run);
        this.failed(false);
        this.flushSocket();
        return;
      }
      if (message.type === "result") {
        this.acknowledge(message.actionId, message.response.run);
        return;
      }
      if (message.type === "error") {
        if (message.status >= 500 || message.status === 429) {
          this.pause();
          socket.close();
        } else void this.resync();
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearTimeout(handshakeTimeout);
      if (this.stopped || socket !== this.socket) return;
      this.socket = null;
      for (const item of this.queue) item.sent = false;
      if (!ready && !this.connectedOnce) {
        // Plain next dev lacks Vercel's upgrade bridge. Preserve fast prediction and
        // server validation over HTTPS; native WebSocket development uses vc dev.
        this.mode = "http";
        this.paused = false;
        void this.flushHttp();
        return;
      }
      this.mode = "connecting";
      this.pause();
      if (this.retries < 4)
        this.timer = setTimeout(
          () => this.connect(),
          Math.min(250 * 2 ** this.retries++, 4000),
        );
    };
  }
  replaceSnapshot(run: RunDto) {
    if (run.id !== this.confirmed.id) return;
    this.acceptSnapshot(run);
  }
  private acceptSnapshot(run: RunDto) {
    if (run.id !== this.confirmed.id || run.version < this.confirmed.version)
      return;
    this.confirmed = run;
    this.emit();
  }
  private emit() {
    // Inputs whose expected version is behind confirmed state have already committed
    // or conflict with another tab; they remain queued for idempotent replay only.
    const speculative = this.queue
      .filter(
        (item) => item.command.body.expectedVersion >= this.confirmed.version,
      )
      .map((item) => item.command);
    this.changed(predictRun(this.confirmed, speculative).run, this.confirmed);
    if (!this.queue.length) {
      for (const resolve of this.waiters.splice(0)) resolve();
    }
  }
  move(pinId: number, direction: Direction): RunDto | null {
    if (
      this.stopped ||
      this.paused ||
      this.queue.length >= 64 ||
      this.view.terminal
    )
      return null;
    const expectedVersion = this.queue.at(-1)?.command.body.expectedVersion;
    const command: SocketCommand = {
      type: "action",
      runId: this.confirmed.id,
      action: "move",
      body: {
        actionId: crypto.randomUUID(),
        expectedVersion:
          expectedVersion === undefined
            ? this.confirmed.version
            : expectedVersion + 1,
        pinId,
        direction,
      },
    };
    this.queue.push({ command, sent: false });
    const view = this.view.run;
    this.emit();
    if (this.mode === "socket") this.flushSocket();
    else if (this.mode === "http") void this.flushHttp();
    return view;
  }
  private flushSocket() {
    if (this.paused || this.socket?.readyState !== 1) return;
    for (const item of this.queue) {
      if (!item.sent) {
        this.socket.send(JSON.stringify(item.command));
        item.sent = true;
      }
    }
  }
  private acknowledge(actionId: string, run: RunDto) {
    if (this.queue[0]?.command.body.actionId !== actionId) return;
    this.queue.shift();
    this.acceptSnapshot(run);
  }
  private async flushHttp() {
    if (this.httpBusy || this.paused || this.stopped) return;
    this.httpBusy = true;
    const generation = this.generation;
    try {
      while (
        this.queue.length &&
        !this.stopped &&
        !this.paused &&
        generation === this.generation
      ) {
        const item = this.queue[0];
        const command = item.command;
        const response = await gameRequest(
          `/api/runs/${command.runId}/${command.action}`,
          command.body,
        );
        if (this.stopped || generation !== this.generation) return;
        if (!response.run) throw new TypeError("INVALID_RESPONSE");
        this.acknowledge(command.body.actionId, response.run);
      }
    } catch (error) {
      if (this.stopped || generation !== this.generation) return;
      if (
        error instanceof TransportError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      )
        await this.resync();
      else {
        this.pause();
      }
    } finally {
      this.httpBusy = false;
    }
  }
  private pause() {
    this.paused = true;
    this.failed(true);
    for (const resolve of this.waiters.splice(0)) resolve();
  }
  private async resync() {
    if (this.resyncing || this.stopped) return;
    this.resyncing = true;
    this.paused = true;
    this.generation++;
    this.queue = [];
    this.emit();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    try {
      const response = await gameRequest(`/api/runs/${this.confirmed.id}`);
      if (this.stopped || !response.run) return;
      this.acceptSnapshot(response.run);
      this.paused = false;
      this.failed(false);
      if (this.mode !== "http") {
        this.mode = "connecting";
        this.connect();
      }
    } catch {
      this.failed(true);
    } finally {
      this.resyncing = false;
    }
  }
  retry() {
    this.failed(false);
    this.paused = false;
    if (this.mode === "http") void this.flushHttp();
    else {
      clearTimeout(this.timer);
      this.socket?.close();
      this.socket = null;
      this.connect();
    }
  }
  async idle() {
    if (this.paused) throw new Error("CHANNEL_PAUSED");
    if (!this.queue.length) return;
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    if (this.paused) throw new Error("CHANNEL_PAUSED");
  }
  close() {
    this.stopped = true;
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.timeout);
    this.socket?.close();
    this.socket = null;
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}
