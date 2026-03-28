import { Game } from './game';
import { PeerConnection, type Role } from './net';

const lobby = document.getElementById('lobby')!;
const lobbyMenu = document.getElementById('lobby-menu')!;
const lobbyHost = document.getElementById('lobby-host')!;
const lobbyJoin = document.getElementById('lobby-join')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;

let peer: PeerConnection | null = null;

function startGame(role: Role, connection?: PeerConnection) {
  lobby.classList.add('hidden');
  canvas.classList.remove('hidden');
  const game = new Game(canvas, role, connection ?? null);
  game.start();
}

// ── Solo ──
(window as unknown as Record<string, unknown>).startSolo = () => {
  startGame('solo');
};

// ── Host ──
(window as unknown as Record<string, unknown>).showHost = async () => {
  lobbyMenu.classList.add('hidden');
  lobbyHost.classList.remove('hidden');
  lobbyHost.innerHTML = '<p class="status">Generating connection code...</p>';

  peer = new PeerConnection('host');

  try {
    const offer = await peer.createOffer();
    lobbyHost.innerHTML = `
      <p class="step">Step 1: Copy this code and send it to your co-op partner</p>
      <textarea id="host-offer" readonly>${offer}</textarea>
      <button class="btn-copy" onclick="navigator.clipboard.writeText(document.getElementById('host-offer').value)">Copy Code</button>
      <p class="step" style="margin-top:16px">Step 2: Paste your partner's response code</p>
      <textarea id="host-answer" placeholder="Paste response code here..."></textarea>
      <button class="btn-connect" onclick="hostConnect()">Connect</button>
      <br><button class="btn-back" onclick="backToMenu()">Back</button>
    `;
  } catch (err) {
    lobbyHost.innerHTML = `<p class="status">Error: ${err}</p><button class="btn-back" onclick="backToMenu()">Back</button>`;
  }
};

(window as unknown as Record<string, unknown>).hostConnect = async () => {
  if (!peer) return;
  const answerStr = (document.getElementById('host-answer') as HTMLTextAreaElement).value.trim();
  if (!answerStr) return;

  lobbyHost.innerHTML = '<p class="status">Connecting...</p>';
  try {
    await peer.acceptAnswer(answerStr);
    peer.onConnected = () => {
      startGame('host', peer!);
    };
    // If already connected by the time we set the handler
    if (peer.connected) startGame('host', peer);
  } catch (err) {
    lobbyHost.innerHTML = `<p class="status">Connection failed: ${err}</p><button class="btn-back" onclick="backToMenu()">Back</button>`;
  }
};

// ── Join ──
(window as unknown as Record<string, unknown>).showJoin = () => {
  lobbyMenu.classList.add('hidden');
  lobbyJoin.classList.remove('hidden');
  lobbyJoin.innerHTML = `
    <p class="step">Step 1: Paste the host's connection code</p>
    <textarea id="join-offer" placeholder="Paste host code here..."></textarea>
    <button class="btn-connect" onclick="joinConnect()">Generate Response</button>
    <br><button class="btn-back" onclick="backToMenu()">Back</button>
  `;
};

(window as unknown as Record<string, unknown>).joinConnect = async () => {
  const offerStr = (document.getElementById('join-offer') as HTMLTextAreaElement).value.trim();
  if (!offerStr) return;

  peer = new PeerConnection('guest');
  lobbyJoin.innerHTML = '<p class="status">Generating response code...</p>';

  try {
    const answer = await peer.acceptOffer(offerStr);
    peer.onConnected = () => {
      startGame('guest', peer!);
    };

    lobbyJoin.innerHTML = `
      <p class="step">Step 2: Copy this response code and send it back to the host</p>
      <textarea id="join-answer" readonly>${answer}</textarea>
      <button class="btn-copy" onclick="navigator.clipboard.writeText(document.getElementById('join-answer').value)">Copy Response</button>
      <p class="status">Waiting for connection...</p>
    `;

    // If already connected
    if (peer.connected) startGame('guest', peer);
  } catch (err) {
    lobbyJoin.innerHTML = `<p class="status">Error: ${err}</p><button class="btn-back" onclick="backToMenu()">Back</button>`;
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
