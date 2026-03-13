import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Coins, 
  Eye, 
  LogOut, 
  User,
  Hash,
  Minimize2,
  Maximize2
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

const CardComponent = ({ card, hidden, index }: { card: Card; hidden: boolean; index: number }) => {
  const tilt = (index - 1) * 8;
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }}
      className={`relative w-8 h-12 md:w-24 md:h-32 rounded-lg md:rounded-xl shadow-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-red-950 rounded-lg md:rounded-xl border border-red-500/30 overflow-hidden relative">
          <div className="text-red-500 font-black text-lg rotate-45">L</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-[10px] md:text-2xl ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-xl md:text-6xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-1 right-1 font-black text-[10px] md:text-2xl rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
        </>
      )}
    </motion.div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('main-table');
  const [joined, setJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowSplash(false), 3000);
    const newSocket = io({ transports: ['polling', 'websocket'] });
    setSocket(newSocket);
    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
      if (state.winner) confetti({ particleCount: 150, spread: 70 });
    });
    newSocket.on('adminStats', (stats: any[]) => setAdminStats(stats));
    newSocket.on('sideShowPrompt', (data: { fromName: string }) => setSideShowPrompt(data));
    return () => { newSocket.close(); };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    setIsFullscreen(!isFullscreen);
  };

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });
  const handleSideShow = () => socket?.emit('sideShowRequest', roomId);
  const respondSideShow = (accepted: boolean) => { socket?.emit('sideShowResponse', { roomId, accepted }); setSideShowPrompt(null); };

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

  if (showSplash) return <div className="h-screen bg-black flex items-center justify-center text-white font-black text-4xl">LUCIFER POKER</div>;

  if (!joined) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-3xl border border-white/10 text-center">
        <h1 className="text-4xl font-black mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-xl mb-4 outline-none border border-white/10" />
        <button onClick={joinRoom} className="w-full bg-red-600 p-4 rounded-xl font-black text-lg">ENTER UNDERWORLD</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      <header className="p-2 flex items-center justify-between border-b border-white/10 bg-black/60 backdrop-blur-xl z-50">
        <div className="font-black text-sm">LUCIFER POKER</div>
        <div className="flex gap-2">
          <button onClick={toggleFullscreen} className="p-1 bg-white/10 rounded-lg">{isFullscreen ? <Minimize2 /> : <Maximize2 />}</button>
          {name.toLowerCase() === 'admin' && <button onClick={() => { setShowAdminPanel(true); socket?.emit('getAdminStats', name); }} className="text-xs font-bold bg-red-600 px-2 py-1 rounded">ADMIN</button>}
        </div>
      </header>

      <main className="flex-1 relative bg-emerald-950 overflow-hidden">
        <img src={ASSETS.TABLE_BG} className="absolute inset-0 w-full h-full object-cover opacity-30" />
        
        {/* Pot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-20">
          <div className="bg-black/60 p-4 rounded-3xl border border-red-600/40">
            <div className="text-xs text-red-500 font-bold uppercase">Pot</div>
            <div className="text-3xl font-black">{gameState?.pot.toLocaleString() || 0}</div>
          </div>
          {gameState?.winner && <div className="mt-2 text-yellow-500 font-black uppercase">🏆 {gameState.winner} Wins!</div>}
        </div>

        {/* Players */}
        {rotatedPlayers.map((player, idx) => {
          const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
          const x = Math.cos(angle) * 40;
          const y = Math.sin(angle) * 35;
          const isMe = player.id === socket?.id;
          return (
            <div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
              <div className="flex -space-x-4">
                {player.hand.map((card, cIdx) => <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />)}
              </div>
              <div className={`p-2 rounded-xl border ${gameState?.players[gameState.currentTurn]?.id === player.id ? 'border-red-500 bg-red-500/20' : 'border-white/10 bg-black/80'}`}>
                <div className="text-[10px] font-bold">{player.name}</div>
                <div className="text-xs font-black text-yellow-500">{player.chips === -1 ? "???" : player.chips.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </main>

      <footer className="p-4 bg-black/90 border-t border-white/10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="text-sm font-black text-yellow-500">Chips: {currentPlayer?.chips.toLocaleString() || 0}</div>
          {isMyTurn && gameState?.gameStarted && !gameState.winner && (
            <div className="flex gap-2">
              <button onClick={() => takeAction('fold')} className="bg-zinc-800 px-4 py-2 rounded-xl text-xs font-bold">FOLD</button>
              {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold">SEE</button>}
              {!currentPlayer?.isBlind && <button onClick={handleSideShow} className="bg-purple-600 px-4 py-2 rounded-xl text-xs font-bold">SIDE</button>}
              <button onClick={() => takeAction('chaal')} className="bg-red-600 px-6 py-2 rounded-xl text-xs font-black">CHAAL</button>
            </div>
          )}
        </div>
      </footer>

      {sideShowPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 p-8 rounded-3xl text-center border border-white/10">
            <h2 className="text-xl font-black mb-4">SIDE SHOW FROM {sideShowPrompt.fromName}</h2>
            <div className="flex gap-4">
              <button onClick={() => respondSideShow(false)} className="flex-1 bg-zinc-800 py-3 rounded-xl">DENY</button>
              <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 py-3 rounded-xl">ACCEPT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
