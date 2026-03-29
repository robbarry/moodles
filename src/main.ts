import { Game } from './game';
import { PeerConnection, type Role } from './net';

const lobby = document.getElementById('lobby')!;
const lobbyMenu = document.getElementById('lobby-menu')!;
const lobbyHost = document.getElementById('lobby-host')!;
const lobbyJoin = document.getElementById('lobby-join')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;

let peer: PeerConnection | null = null;

function startGame(role: Role, connection?: PeerConnection, battleMode = false) {
  lobby.classList.add('hidden');
  canvas.classList.remove('hidden');
  const game = new Game(canvas, role, connection ?? null, battleMode);
  game.start();
}

// ── Solo ──
(window as unknown as Record<string, unknown>).startSolo = () => {
  startGame('solo');
};

// ── Host Co-op ──
(window as unknown as Record<string, unknown>).showHost = async () => {
  lobbyMenu.classList.add('hidden');
  lobbyHost.classList.remove('hidden');
  lobbyHost.innerHTML = '<p class="status">Creating room...</p>';

  peer = new PeerConnection('host');

  try {
    const code = await peer.host();
    lobbyHost.innerHTML = `
      <p class="step">Share this room code with your co-op partner:</p>
      <div style="font-size:32px;color:#ffeb3b;margin:16px 0;letter-spacing:4px;user-select:all">${code}</div>
      <button class="btn-copy" onclick="navigator.clipboard.writeText('${code}')">Copy Code</button>
      <p class="status">Waiting for partner to join...</p>
      <br><button class="btn-back" onclick="backToMenu()">Cancel</button>
    `;

    peer.onConnected = () => {
      startGame('host', peer!);
    };
  } catch (err) {
    lobbyHost.innerHTML = `<p class="status">Error: ${err}</p><button class="btn-back" onclick="backToMenu()">Back</button>`;
  }
};

// ── Host Battle ──
(window as unknown as Record<string, unknown>).showHostBattle = async () => {
  lobbyMenu.classList.add('hidden');
  lobbyHost.classList.remove('hidden');
  lobbyHost.innerHTML = '<p class="status">Creating battle room...</p>';

  peer = new PeerConnection('host');

  try {
    const code = await peer.host();
    lobbyHost.innerHTML = `
      <p class="step">Share this code with your opponent:</p>
      <div style="font-size:32px;color:#ff5722;margin:16px 0;letter-spacing:4px;user-select:all">${code}</div>
      <button class="btn-copy" onclick="navigator.clipboard.writeText('${code}')">Copy Code</button>
      <p class="status" style="color:#ff5722">BATTLE MODE — Waiting for opponent...</p>
      <br><button class="btn-back" onclick="backToMenu()">Cancel</button>
    `;

    peer.onConnected = () => {
      // Tell guest this is battle mode
      peer!.send({ type: 'mode', mode: 'battle' });
      startGame('host', peer!, true);
    };
  } catch (err) {
    lobbyHost.innerHTML = `<p class="status">Error: ${err}</p><button class="btn-back" onclick="backToMenu()">Back</button>`;
  }
};

// ── Join ──
(window as unknown as Record<string, unknown>).showJoin = () => {
  lobbyMenu.classList.add('hidden');
  lobbyJoin.classList.remove('hidden');
  lobbyJoin.innerHTML = `
    <p class="step">Enter the host's room code:</p>
    <input id="join-code" type="text" placeholder="MOODLE-XXXX"
      style="font-family:monospace;font-size:24px;text-align:center;width:260px;padding:10px;
      background:#16213e;color:#ffeb3b;border:2px solid #444;border-radius:4px;
      letter-spacing:3px;text-transform:uppercase;margin:12px 0" />
    <br>
    <button class="btn-connect" onclick="joinGame()">Join</button>
    <br><button class="btn-back" onclick="backToMenu()">Back</button>
  `;
  setTimeout(() => (document.getElementById('join-code') as HTMLInputElement)?.focus(), 100);
};

(window as unknown as Record<string, unknown>).joinGame = async () => {
  const code = (document.getElementById('join-code') as HTMLInputElement)?.value;
  if (!code) return;

  lobbyJoin.innerHTML = '<p class="status">Connecting...</p>';

  peer = new PeerConnection('guest');

  try {
    await peer.join(code);

    // Wait for mode message from host to determine battle vs co-op
    let battleMode = false;
    const originalOnMessage = peer.onMessage;

    peer.onMessage = (msg) => {
      if (msg.type === 'mode' && msg.mode === 'battle') {
        battleMode = true;
      }
      // Forward to original handler once game starts
      originalOnMessage?.(msg);
    };

    peer.onConnected = () => {
      // Small delay to receive mode message before starting
      setTimeout(() => {
        startGame('guest', peer!, battleMode);
      }, 100);
    };

    // May already be connected
    if (peer.connected) {
      setTimeout(() => {
        startGame('guest', peer!, battleMode);
      }, 100);
    }
  } catch (err) {
    lobbyJoin.innerHTML = `
      <p class="status">Failed: ${err}</p>
      <button class="btn-back" onclick="showJoin()">Try Again</button>
      <button class="btn-back" onclick="backToMenu()">Back</button>
    `;
  }
};

// ── Back ──
(window as unknown as Record<string, unknown>).backToMenu = () => {
  peer?.close();
  peer = null;
  lobbyHost.classList.add('hidden');
  lobbyJoin.classList.add('hidden');
  lobbyMenu.classList.remove('hidden');
};

// Allow Enter key to submit join code
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const joinCode = document.getElementById('join-code') as HTMLInputElement | null;
    if (joinCode && document.activeElement === joinCode) {
      (window as unknown as Record<string, (() => void) | undefined>).joinGame?.();
    }
  }
});
