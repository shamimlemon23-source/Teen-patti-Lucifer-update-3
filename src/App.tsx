import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Coins, 
  Eye, 
  LogOut, 
  User,
  Hash,
  Minimize2,
  Maximize2,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
};

interface Card { suit: Suit; rank: Rank; }
interface Player { id: string; name: string; chips: number; hand: Card[]; isFolded: boolean; isBlind: boolean; currentBet: number; }
interface GameState { players: Player[]; pot: number; currentTurn: number; lastBet: number; gameStarted: boolean; winner: string | null; roundCount: number; }

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS: Record<Suit, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-900', spades: 'text-slate-900' };

const CardComponent = ({ card, hidden, index }: { card: Card, hidden: boolean, index: number }) => {
  const tilt = useMemo(() => (index - 1) * 8, [index]);
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 120, damping: 12 }}
      className={`relative w-12 h-18 md:w-24 md:h-32 rounded-lg md:rounded-xl shadow-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.15)]'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-800 via-red-950 to-black rounded-lg md:rounded-xl border border-red-500/30 overflow-hidden relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '10px 10px' }}></div>
          <div className="w-8 h-12 border-2 border-red-500/40 rounded-md flex items-center justify-center rotate-45 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            <div className="text-red-500 font-black text-lg -rotate-45 tracking-tighter drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">L</div>
          </div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-[10px] md:text-2xl leading-none ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-xl md:text-6xl drop-shadow-md ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-1 right-1 font-black text-[10px] md:text-2xl leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
        </>
      )}
    </motion.div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('table-1');
  const [joined, setJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'players' | 'manual'>('players');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('50000000');
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isAdmin = useMemo(() => name.trim() === 'LUCIFER_DEV_777', [name]);

  useEffect(() => { setTimeout(() => setShowSplash(false), 3000); }, []);

  useEffect(() => {
    const newSocket = io({ transports: ['polling', 'websocket'], reconnectionAttempts: 100 });
    setSocket(newSocket);
    newSocket.on('connect', () => { setIsConnected(true); if (name) newSocket.emit('joinRoom', { roomId, name }); });
    newSocket.on('connect_error', () => setIsConnected(false));
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('gameState', (state: GameState) => { setGameState(state); if (state.winner) confetti({ particleCount: 150, spread: 70 }); });
    newSocket.on('adminStats', (stats: any[]) => setAdminStats(stats));
    newSocket.on('sideShowPrompt', (data: { fromName: string }) => setSideShowPrompt(data));
    return () => { newSocket.close(); };
  }, []);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const startGame = () => socket?.emit('startGame', roomId);
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });
  const handleSideShow = () => socket?.emit('sideShowRequest', roomId);
  const respondSideShow = (accepted: boolean) => { socket?.emit('sideShowResponse', { roomId, accepted }); setSideShowPrompt(null); };

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount:", "1000000");
    if (amount && !isNaN(parseInt(amount))) takeAction('raise', parseInt(amount));
  };

  const openAdminPanel = () => {
    const pass = adminPassword || prompt("Enter Admin Password:");
    if (pass === "LUCIFER_PASS_999") { setAdminPassword(pass); setShowAdminPanel(true); socket?.emit('getAdminStats', { adminName: name, adminPassword: pass }); }
    else alert("Incorrect Password!");
  };

  const rotatedPlayers = useMemo(() => {
    if (!gameState) return [];
    const players = [...gameState.players];
    const myIndex = players.findIndex(p => p.id === socket?.id);
    if (myIndex === -1) return players;
    const rotated = [];
    for (let i = 0; i < players.length; i++) rotated.push(players[(myIndex + i) % players.length]);
    return rotated;
  }, [gameState, socket]);

  const currentPlayer = useMemo(() => gameState?.players.find(p => p.id === socket?.id), [gameState, socket]);
  const isMyTurn = useMemo(() => gameState?.players[gameState.currentTurn]?.id === socket?.id, [gameState, socket]);

  const canSideShow = useMemo(() => {
    if (!gameState || !isMyTurn || !currentPlayer || currentPlayer.isBlind) return false;
    let prevIdx = (gameState.currentTurn - 1 + gameState.players.length) % gameState.players.length;
    let count = 0;
    while (gameState.players[prevIdx].isFolded && count < gameState.players.length) {
      prevIdx = (prevIdx - 1 + gameState.players.length) % gameState.players.length;
      count++;
    }
    return !gameState.players[prevIdx].isBlind;
  }, [gameState, isMyTurn, currentPlayer]);

  if (showSplash) return <div className="h-screen bg-black flex flex-col items-center justify-center text-white">Loading...</div>;

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
      <header className="relative z-50 p-2 md:p-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <img src={ASSETS.LOGO} alt="Logo" className="w-8 h-8 md:w-12 md:h-12 rounded-xl" />
          <h2 className="font-black text-xs md:text-xl">TEEN PATTI <span className="text-red-500">LUCIFER</span></h2>
        </div>
        <div className="flex items-center gap-2">
          {joined && isAdmin && <button onClick={openAdminPanel} className="p-2 bg-red-600 rounded-xl text-xs font-bold">Admin</button>}
          <button onClick={() => window.location.reload()} className="p-2 bg-red-600/10 rounded-xl"><LogOut className="w-4 h-4 text-red-500" /></button>
        </div>
      </header>

      {!joined ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-black/60 p-8 rounded-[2.5rem] border border-white/10 text-center">
            <h1 className="text-4xl font-black mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
            <div className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none" />
              <div className="relative">
                <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none appearance-none text-white font-bold">
                  {[...Array(10)].map((_, i) => <option key={i} value={`table-${i + 1}`} className="bg-zinc-900">Table {i + 1}</option>)}
                </select>
              </div>
              <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl">ENTER UNDERWORLD</button>
              <button onClick={() => { setRoomId('table-1'); joinRoom(); }} className="text-emerald-500 text-xs font-bold uppercase mt-4">Quick Join: Table 1</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <main className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30">
              {!gameState?.gameStarted && !gameState?.winner && <button onClick={startGame} className="bg-red-600 px-12 py-6 rounded-[2rem] font-black text-2xl animate-bounce">START GAME</button>}
              <div className="bg-zinc-950/90 border-2 border-red-600/40 px-6 py-3 rounded-[2rem] flex flex-col items-center">
                <span className="text-[10px] font-black uppercase text-red-500">Pot Value</span>
                <div className="text-2xl md:text-4xl font-black">{gameState?.pot.toLocaleString() || 0}</div>
              </div>
              {gameState?.winner && <div className="mt-4 bg-yellow-500 text-black px-6 py-2 rounded-full font-black">🏆 {gameState.winner} Wins!</div>}
            </div>

            {rotatedPlayers.map((player, idx) => {
              const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
              const x = Math.cos(angle) * 40;
              const y = Math.sin(angle) * 35;
              const isMe = player.id === socket?.id;
              return (
                <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                  <div className="flex -space-x-6 scale-75">
                    {player.hand.map((card, cIdx) => <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />)}
                  </div>
                  <div className={`p-2 rounded-xl border-2 ${gameState?.currentTurn === gameState?.players.findIndex(p => p.id === player.id) ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/80'}`}>
                    <div className="text-[10px] font-bold">{player.name}</div>
                    <div className="text-yellow-500 font-black text-xs">{player.chips === -1 ? "???" : player.chips.toLocaleString()}</div>
                  </div>
                </motion.div>
              );
            })}
          </main>

          <footer className="p-4 bg-black/80 border-t border-white/10">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex flex-col"><span className="text-[10px] text-white/40 uppercase">Balance</span><div className="text-xl font-black">{currentPlayer?.chips.toLocaleString() || 0}</div></div>
              {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                <div className="flex gap-2">
                  <button onClick={() => takeAction('fold')} className="bg-zinc-800 px-4 py-2 rounded-xl font-bold">Fold</button>
                  {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-zinc-800 px-4 py-2 rounded-xl font-bold">See</button>}
                  {canSideShow && <button onClick={handleSideShow} className="bg-zinc-800 px-4 py-2 rounded-xl font-bold">Side</button>}
                  <button onClick={() => takeAction('chaal')} className="bg-red-600 px-6 py-2 rounded-xl font-black">Chaal</button>
                  <button onClick={handleRaise} className="bg-red-800 px-4 py-2 rounded-xl font-black">+</button>
                </div>
              )}
            </div>
          </footer>
        </>
      )}

      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 p-8 rounded-[2rem] text-center border border-white/10">
              <h3 className="text-xl font-black mb-4">SIDE SHOW REQUEST</h3>
              <p className="mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands.</p>
              <div className="flex gap-4"><button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 p-4 rounded-xl font-bold">Deny</button><button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 p-4 rounded-xl font-bold">Accept</button></div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-2xl bg-zinc-900 rounded-[2rem] overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h2 className="font-black uppercase">Admin Panel</h2>
                <button onClick={() => setShowAdminPanel(false)}><LogOut className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {adminStats.map((stat, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                    <span className="font-bold">{stat.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-yellow-500 font-black">{Number(stat.chips).toLocaleString()}</span>
                      <button onClick={() => socket?.emit('addPlayerChips', { adminName: name, adminPassword, targetName: stat.name, amount: 50000000 })} className="bg-green-600 px-3 py-1 rounded-lg text-[10px] font-bold">Add</button>
                      <button onClick={() => socket?.emit('resetPlayerChips', { adminName: name, adminPassword, targetName: stat.name })} className="bg-red-600 px-3 py-1 rounded-lg text-[10px] font-bold">Reset</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
