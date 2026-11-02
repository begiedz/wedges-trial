import type { RunDto } from "@/api/contracts";
import type { Direction } from "@/game/types";
import {
  GameApiClient,
  type GameReply,
  type PendingCommand,
  TransportError,
} from "./api";
import { GameChannel } from "./channel";

export type SessionView = {
  run: RunDto | null;
  loading: boolean;
  error: boolean;
};
type SessionLocation = { restoredRunId: () => string | null };
/** Application lifecycle and intent orchestration. No React or dialog state. */
export class GameSession {
  private state: SessionView = { run: null, loading: true, error: false };
  private listeners = new Set<() => void>();
  private channel: GameChannel | null = null;
  private snapshot: RunDto | null = null;
  private busy = false;
  private pending: PendingCommand | null = null;
  private restarting = false;
  private stopped = false;
  constructor(
    private api = new GameApiClient(),
    private location: SessionLocation = { restoredRunId: () => null },
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** The channel owns confirmed state while attached; displayed pins may be predicted. */
  private get confirmed() {
    return this.channel?.confirmed ?? this.snapshot;
  }
  private update(patch: Partial<SessionView>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private publish(next: RunDto | null) {
    if (this.stopped) return;
    const current = this.confirmed;
    if (next && current?.id === next.id && current.version > next.version)
      return;
    this.snapshot = next;
    if (next && this.channel?.confirmed.id === next.id) {
      this.channel.replaceSnapshot(next);
      return;
    }
    this.channel?.close();
    this.channel = next
      ? new GameChannel(
          next,
          (view) => this.update({ run: view }),
          (error) => this.update({ error }),
          this.api,
        )
      : null;
    this.update({ run: next });
    this.channel?.connect();
  }
  private async submit(command: PendingCommand): Promise<GameReply> {
    this.pending = command;
    const result = await this.api.request(command.path, command.body);
    this.pending = null;
    this.publish(result.run);
    return result;
  }
  private async restore() {
    const result = await this.api.current();
    if (result.run) {
      this.publish(result.run);
      return;
    }
    const id = this.location.restoredRunId();
    if (id && !this.restarting) {
      try {
        this.publish((await this.api.read(id)).run);
        return;
      } catch (error) {
        if (!(error instanceof TransportError) || error.status !== 404)
          throw error;
      }
    }
    await this.submit({
      path: "/api/runs",
      body: { actionId: crypto.randomUUID() },
    });
  }
  private async recover(error: unknown) {
    if (
      error instanceof TransportError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429
    ) {
      this.pending = null;
      if (error.status === 409 || error.status === 404) {
        const id = this.confirmed?.id;
        if (id) this.publish((await this.api.read(id)).run);
        else await this.restore();
        return;
      }
    }
    throw error;
  }
  private async exclusive<T>(work: () => Promise<T>) {
    if (this.busy || this.stopped) return null;
    this.busy = true;
    this.update({ loading: true, error: false });
    try {
      return await work();
    } catch (error) {
      try {
        await this.recover(error);
      } catch {
        this.update({ error: true });
      }
      return null;
    } finally {
      this.busy = false;
      this.update({ loading: false });
    }
  }
  start = () => {
    this.stopped = false;
    if (this.snapshot) {
      this.publish(this.snapshot);
      return;
    }
    void this.exclusive(async () => {
      await this.api.bootstrap();
      await this.restore();
    });
  };
  close = () => {
    this.snapshot = this.confirmed;
    this.stopped = true;
    this.channel?.close();
    this.channel = null;
  };
  private async restart() {
    this.restarting = true;
    await this.channel?.idle();
    const active = this.confirmed;
    if (
      active &&
      (active.status === "playing" || active.status === "chest_opened")
    ) {
      await this.submit({
        path: `/api/runs/${active.id}/abandon`,
        body: {
          actionId: crypto.randomUUID(),
          expectedVersion: active.version,
        },
      });
    }
    await this.submit({
      path: "/api/runs",
      body: { actionId: crypto.randomUUID() },
    });
    this.restarting = false;
  }
  retry = () => {
    const failed = this.state.error;
    return this.exclusive(async () => {
      if (
        !this.pending &&
        this.channel &&
        (failed || this.channel.pendingCount)
      ) {
        this.channel.retry();
        return;
      }
      if (this.pending) {
        const command = this.pending;
        await this.submit(command);
        if (this.restarting && command.path === "/api/runs") {
          this.restarting = false;
          return;
        }
      }
      if (this.restarting) {
        await this.restart();
        return;
      }
      if (!this.confirmed) {
        await this.api.bootstrap();
        await this.restore();
      } else this.publish((await this.api.read(this.confirmed.id)).run);
    });
  };
  private action(name: "reset" | "continue") {
    return this.exclusive(async () => {
      await this.channel?.idle();
      const active = this.confirmed;
      if (!active || this.pending || this.state.error) return;
      return this.submit({
        path: `/api/runs/${active.id}/${name}`,
        body: {
          actionId: crypto.randomUUID(),
          expectedVersion: active.version,
        },
      });
    });
  }
  move = async (
    pinId: number,
    direction: Direction,
  ): Promise<GameReply | null> => {
    if (this.stopped || this.state.error || this.busy) return null;
    const view = this.channel?.move(pinId, direction);
    return view ? { run: view } : null;
  };
  resetLock = () => this.action("reset");
  continueToNextChest = () => this.action("continue");
  startNewRun = () => {
    if (this.pending || this.state.error) return Promise.resolve(null);
    return this.exclusive(() => this.restart());
  };
  get canRequestNewRun() {
    return !this.busy && !this.state.error;
  }
}
