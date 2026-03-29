// ── PeerJS networking for co-op multiplayer ──

import Peer, { type DataConnection } from 'peerjs';

export type Role = 'host' | 'guest' | 'solo';

export interface NetMessage {
  type: string;
  [key: string]: unknown;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MOODLE-${code}`;
}

export class PeerConnection {
  role: Role;
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  connected = false;
  roomCode = '';
  private _onMessage: ((msg: NetMessage) => void) | null = null;
  private _messageBuffer: NetMessage[] = [];
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onError: ((err: string) => void) | null = null;

  /** Setting onMessage flushes any messages that arrived before the handler was installed */
  get onMessage(): ((msg: NetMessage) => void) | null { return this._onMessage; }
  set onMessage(handler: ((msg: NetMessage) => void) | null) {
    this._onMessage = handler;
    if (handler && this._messageBuffer.length > 0) {
      const buffered = this._messageBuffer;
      this._messageBuffer = [];
      for (const msg of buffered) handler(msg);
    }
  }

  constructor(role: Role) {
    this.role = role;
  }

  async host(): Promise<string> {
    this.roomCode = generateRoomCode();

    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.roomCode);

      this.peer.on('open', () => {
        resolve(this.roomCode);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          this.roomCode = generateRoomCode();
          this.peer?.destroy();
          this.peer = new Peer(this.roomCode);
          this.peer.on('open', () => resolve(this.roomCode));
          this.peer.on('error', (e) => reject(e.message));
          this.peer.on('connection', (conn) => this.setupConnection(conn));
        } else {
          reject(err.message);
        }
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });
    });
  }

  async join(roomCode: string): Promise<void> {
    this.roomCode = roomCode.toUpperCase().trim();

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        const conn = this.peer!.connect(this.roomCode, { reliable: true });
        this.setupConnection(conn);

        conn.on('open', () => {
          resolve();
        });

        conn.on('error', (err) => {
          reject(err.message ?? 'Connection failed');
        });
      });

      this.peer.on('error', (err) => {
        reject(err.message);
      });

      setTimeout(() => {
        if (!this.connected) {
          reject('Connection timed out — check the room code');
        }
      }, 10000);
    });
  }

  /** Send a message — PeerJS handles JSON serialization */
  send(msg: NetMessage): void {
    if (this.conn?.open) {
      this.conn.send(msg);
    }
  }

  close(): void {
    this.conn?.close();
    this.peer?.destroy();
    this.connected = false;
  }

  private setupConnection(conn: DataConnection): void {
    this.conn = conn;

    conn.on('open', () => {
      this.connected = true;
      this.onConnected?.();
    });

    conn.on('close', () => {
      this.connected = false;
      this.onDisconnected?.();
    });

    conn.on('data', (data) => {
      // PeerJS JSON serialization delivers objects directly
      const msg = data as NetMessage;
      if (msg && typeof msg.type === 'string') {
        if (this._onMessage) {
          this._onMessage(msg);
        } else {
          // Buffer messages until a handler is installed
          this._messageBuffer.push(msg);
        }
      }
    });

    conn.on('error', (err) => {
      this.onError?.(err.message ?? 'Connection error');
    });
  }
}
