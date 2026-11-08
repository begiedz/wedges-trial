import type { RunDto } from "@/api/contracts";
import type { SocketCommand, SocketReply } from "@/api/realtime";
import type { Direction } from "@/game/types";
import { GameApiClient, TransportError } from "./api";
import { CommandQueue } from "./command-queue";
import { SocketTransport } from "./transport";

export class GameChannel {
  private inputs: CommandQueue;
  get confirmed() {
    return this.inputs.confirmed;
  }
  private get queue() {
    return this.inputs.pending;
  }
  private transport: SocketTransport;
  private mode: "connecting" | "socket" | "http" = "connecting";
  private stopped = false;
  private paused = false;
  private httpBusy = false;
  private waiters: Array<() => void> = [];
  private generation = 0;
  private resyncing = false;
  constructor(
    run: RunDto,
    private changed: (view: RunDto, confirmed: RunDto) => void,
    private failed: (failed: boolean) => void,
    private api = new GameApiClient(),
  ) {
    this.inputs = new CommandQueue(run);
    this.transport = new SocketTransport(run.id, {
      reply: (message) => this.receive(message),
      fallback: () => {
        for (const item of this.queue) item.sent = false;
        this.mode = "http";
        this.paused = false;
        void this.flushHttp();
      },
      disconnected: () => {
        for (const item of this.queue) item.sent = false;
        this.mode = "connecting";
        this.pause();
      },
    });
  }
  get pendingCount() {
    return this.queue.length;
  }
  get view() {
    return this.inputs.view;
  }
  connect() {
    if (!this.stopped) this.transport.connect();
  }
  private receive(message: SocketReply) {
    switch (message.type) {
      case "ready":
        this.mode = "socket";
        this.paused = false;
        // Keep original commands for exact replay, but do not predict committed moves twice.
        this.acceptSnapshot(message.run);
        this.failed(false);
        this.flushSocket();
        break;
      case "result":
        this.acknowledge(message.actionId, message.response.run);
        break;
      case "error":
        if (message.status >= 500 || message.status === 429) {
          this.pause();
          for (const item of this.queue) item.sent = false;
          this.transport.reconnect();
        } else void this.resync();
        break;
    }
  }
  replaceSnapshot(run: RunDto) {
    if (run.id !== this.confirmed.id) return;
    this.acceptSnapshot(run);
  }
  private acceptSnapshot(run: RunDto) {
    if (this.inputs.accept(run)) this.emit();
  }
  private emit() {
    this.changed(this.inputs.view.run, this.confirmed);
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
    if (this.paused) return;
    for (const item of this.queue) {
      if (!item.sent) item.sent = this.transport.send(item.command);
    }
  }
  private acknowledge(actionId: string, run: RunDto) {
    if (this.inputs.acknowledge(actionId, run)) this.emit();
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
        const response = await this.api.request(
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
    this.inputs.clear();
    this.emit();
    this.transport.disconnect();
    try {
      const response = await this.api.request(`/api/runs/${this.confirmed.id}`);
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
      for (const item of this.queue) item.sent = false;
      this.transport.reconnect();
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
    this.transport.close();
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}
