// ── PeerJS networking for co-op multiplayer ──

import Peer, { type DataConnection } from 'peerjs';

export type Role = 'host' | 'guest' | 'solo';

export interface NetMessage {
  type: string;
  [key: string]: unknown;
}

// Room code: MOODLE-XXXX where X is random alphanumeric
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/1/O/0
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
  onMessage: ((msg: NetMessage) => void) | null = null;
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onError: ((err: string) => void) | null = null;

  constructor(role: Role) {
    this.role = role;
  }

  /** Host: create a room and wait for a guest to join */
  async host(): Promise<string> {
    this.roomCode = generateRoomCode();

    return new Promise((resolve, reject) => {
      // Use the room code as the peer ID so the guest can find us
      this.peer = new Peer(this.roomCode);

      this.peer.on('open', () => {
        resolve(this.roomCode);
      });

      this.peer.on('error', (err) => {
        // If the ID is taken, try again with a new code
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

  /** Guest: join a room by code */
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

      // Timeout
      setTimeout(() => {
        if (!this.connected) {
          reject('Connection timed out — check the room code');
        }
      }, 10000);
    });
  }

  send(msg: NetMessage): void {
    if (this.conn?.open) {
      this.conn.send(JSON.stringify(msg));
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
      try {
        const msg = JSON.parse(data as string) as NetMessage;
        this.onMessage?.(msg);
      } catch { /* ignore bad messages */ }
    });

    conn.on('error', (err) => {
      this.onError?.(err.message ?? 'Connection error');
    });
  }
}
