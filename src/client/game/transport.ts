import type { SocketCommand, SocketReply } from "@/api/realtime";

type Events = {
  reply: (reply: SocketReply) => void;
  disconnected: () => void;
  fallback: () => void;
};
/** Connection lifecycle only. The channel owns commands, replay and reconciliation. */
export class SocketTransport {
  private socket: WebSocket | null = null;
  private stopped = false;
  private connectedOnce = false;
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private handshake: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private runId: string,
    private events: Events,
  ) {}
  connect() {
    if (this.stopped || this.socket) return;
    if (typeof WebSocket === "undefined") {
      this.events.fallback();
      return;
    }
    const url = new URL("/api/game/socket", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("run", this.runId);
    const socket = new WebSocket(url);
    this.socket = socket;
    let ready = false;
    const handshake = setTimeout(() => socket.close(), 5000);
    this.handshake = handshake;
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
        clearTimeout(handshake);
        ready = true;
        this.connectedOnce = true;
        this.retries = 0;
      }
      this.events.reply(message);
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearTimeout(handshake);
      if (this.stopped || socket !== this.socket) return;
      this.socket = null;
      if (!ready && !this.connectedOnce) {
        this.events.fallback();
        return;
      }
      this.events.disconnected();
      if (this.retries < 4)
        this.timer = setTimeout(
          () => this.connect(),
          Math.min(250 * 2 ** this.retries++, 4000),
        );
    };
  }
  send(command: SocketCommand): boolean {
    if (this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify(command));
    return true;
  }
  disconnect() {
    clearTimeout(this.timer);
    clearTimeout(this.handshake);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
  reconnect() {
    this.disconnect();
    this.connect();
  }
  close() {
    this.stopped = true;
    this.disconnect();
  }
}
