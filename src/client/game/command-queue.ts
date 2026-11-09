import type { RunDto } from "@/api/contracts";
import type { SocketCommand } from "@/api/realtime";
import { predictRun } from "./prediction";

export type QueuedInput = { command: SocketCommand; sent: boolean };
/** Confirmed state and ordered unacknowledged intents, independent of transport/React. */
export class CommandQueue {
  pending: QueuedInput[] = [];
  constructor(public confirmed: RunDto) {}
  get view() {
    // Retain original retry versions without predicting already committed inputs twice.
    return predictRun(
      this.confirmed,
      this.pending
        .filter(
          (item) => item.command.body.expectedVersion >= this.confirmed.version,
        )
        .map((item) => item.command),
    );
  }
  accept(run: RunDto) {
    if (run.id !== this.confirmed.id || run.version < this.confirmed.version)
      return false;
    this.confirmed = run;
    return true;
  }
  acknowledge(actionId: string, run: RunDto) {
    if (
      this.pending[0]?.command.body.actionId !== actionId ||
      run.id !== this.confirmed.id
    )
      return false;
    this.pending.shift();
    // Legacy replay responses may still arrive after a newer reconnect snapshot.
    this.accept(run);
    return true;
  }
  clear() {
    this.pending = [];
  }
}
