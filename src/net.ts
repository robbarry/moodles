// ── WebRTC peer-to-peer networking for co-op multiplayer ──

export type Role = 'host' | 'guest' | 'solo';

export interface NetMessage {
  type: string;
  [key: string]: unknown;
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export class PeerConnection {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null = null;
  role: Role;
  connected = false;
  onMessage: ((msg: NetMessage) => void) | null = null;
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;

  constructor(role: Role) {
    this.role = role;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'disconnected' || this.pc.iceConnectionState === 'failed') {
        this.connected = false;
        this.onDisconnected?.();
      }
    };
  }

  /** Host: create offer and return it as a compact string */
  async createOffer(): Promise<string> {
    this.dc = this.pc.createDataChannel('game');
    this.setupDataChannel(this.dc);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await this.waitForIce();
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  /** Guest: accept an offer string and return an answer string */
  async acceptOffer(offerStr: string): Promise<string> {
    // Listen for incoming data channel
    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.setupDataChannel(this.dc);
    };

    const offer = JSON.parse(atob(offerStr)) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.waitForIce();
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  /** Host: accept the answer string from the guest */
  async acceptAnswer(answerStr: string): Promise<void> {
    const answer = JSON.parse(atob(answerStr)) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answer);
  }

  send(msg: NetMessage): void {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.dc?.close();
    this.pc.close();
    this.connected = false;
  }

  private setupDataChannel(dc: RTCDataChannel): void {
    dc.onopen = () => {
      this.connected = true;
      this.onConnected?.();
    };
    dc.onclose = () => {
      this.connected = false;
      this.onDisconnected?.();
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as NetMessage;
        this.onMessage?.(msg);
      } catch { /* ignore bad messages */ }
    };
  }

  private waitForIce(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
      // Fallback timeout — ICE gathering shouldn't take more than 5s on LAN
      setTimeout(resolve, 5000);
    });
  }
}
