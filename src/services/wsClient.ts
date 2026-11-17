type Listener = (payload: any) => void;

class XludoWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionToken: string | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private reconnectTimer: number | null = null;
  private manuallyClosed = false;
  public connected = false;

  connect(sessionToken: string) {
    this.sessionToken = sessionToken;
    this.manuallyClosed = false;
    this.openSocket();
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.emitLocal('connection:status', { connected: false });
  }

  private openSocket() {
    if (typeof window === 'undefined' || !this.sessionToken) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onopen = () => {
      this.connected = true;
      this.emitLocal('connection:status', { connected: true });
      this.send('auth', { sessionToken: this.sessionToken });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type) {
          this.emitLocal(msg.type, msg.payload);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    socket.onclose = () => {
      this.connected = false;
      this.emitLocal('connection:status', { connected: false });
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // onclose handles reconnect cleanly
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed && this.sessionToken) {
        this.openSocket();
      }
    }, 2000);
  }

  send(type: string, payload: Record<string, unknown> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }

  on(type: string, handler: Listener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  private emitLocal(type: string, payload: unknown) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }
}

export const wsClient = new XludoWebSocketClient();
