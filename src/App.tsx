import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Coins, Eye, EyeOff, LogOut, Play, User as UserIcon, ChevronRight, Hand } from 'lucide-react';
import confetti from 'canvas-confetti';

// Custom Asset URLs
const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png" // New dealer image
};

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card { suit: Suit; rank: Rank; }
interface Player { id: string; name: string; chips: number; hand: Card[]; isFolded: boolean; isBlind: boolean; currentBet: number; }
interface GameState { players: Player[]; pot: number; currentTurn: number; lastBet: number; gameStarted: boolean; winner: string | null; roundCount: number; autoStartIn: number; }

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS: Record<Suit, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-900', spades: 'text-slate-900' };

const CardComponent = ({ card, hidden, index }: { card: Card, hidden: boolean, index: number }) => {
  const tilt = (index - 1) * 5;
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180 }}
      animate={{ scale: 1, y: 0, rotate: tilt }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
      className={`relative w-12 h-18 md:w-20 md:h-28 rounded-lg shadow-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-zinc-50 border-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-800 via-red-950 to-black rounded-lg border border-red-500/30 overflow-hidden relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '10px 10px' }}></div>
          <div className="w-10 h-14 border-2 border-red-500/40 rounded-md flex items-center justify-center rotate-45 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <div className="text-red-500/60 font-black text-2xl -rotate-45 tracking-tighter">L</div>
          </div>
        </div>
      ) : (
        <>
          <div className={`absolute top-0.5 left-1 font-black text-sm md:text-lg leading-none ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-2xl md:text-4xl drop-shadow-sm ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-0.5 right-1 font-black text-sm md:text-lg leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
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
  const [adminMessage, setAdminMessage] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const newSocket = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      autoConnect: true
    });
    setSocket(newSocket);
    newSocket.on('connect', () => { setIsConnected(true); if (name) newSocket.emit('joinRoom', { roomId, name }); });
    newSocket.on('connect_error', () => setIsConnected(false));
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('gameState', (state: GameState) => { setGameState(state); if (state.winner) confetti({ particleCount: 150, spread: 70 }); });
    newSocket.on('adminStats', (stats: any[]) => setAdminStats(stats));
    newSocket.on('adminMessage', (msg: string) => { setAdminMessage(msg); setTimeout(() => setAdminMessage(''), 3000); });
    newSocket.on('sideShowPrompt', (data: { fromName: string }) => setSideShowPrompt(data));
    return () => { newSocket.close(); };
  }, []);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const startGame = () => socket?.emit('startGame', roomId);
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

  if (showSplash) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40"><img src={ASSETS.SPLASH_BG} alt="Splash BG" className="w-full h-full object-cover" /></div>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-48 h-48 bg-red-600 rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] border-4 border-red-500/30 overflow-hidden"><img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" /></motion.div>
      <h1 className="relative z-10 mt-8 text-4xl font-black text-white tracking-tighter text-center">LUCIFER <span className="text-red-600">POKER</span></h1>
    </div>
  );

  if (!joined) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white font-sans">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
        <h1 className="text-4xl font-black mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
        <div className="space-y-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none" />
          <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-4 rounded-xl font-bold text-lg hover:bg-red-500 transition-all text-white">Enter Underworld</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
      <header className="absolute top-0 left-0 right-0 p-1 md:p-2 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-2"><div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center"><img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" /></div><h2 className="font-black text-xs">TEEN PATTI <span className="text-red-500">LUCIFER</span></h2></div>
        <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} /><span className="text-[10px] font-bold opacity-40">{isConnected ? 'Online' : 'Reconnecting...'}</span><button onClick={() => window.location.reload()} className="p-1 hover:bg-white/10 rounded-full"><LogOut className="w-4 h-4 text-white/60" /></button></div>
      </header>

      <main className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
        <div className="relative w-full h-full bg-emerald-950 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0"><img src={ASSETS.TABLE_BG} alt="Table BG" className="w-full h-full object-cover opacity-40" /></div>
          
          {/* Dealer (Updated Position) */}
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
            <div className="w-20 h-20 md:w-32 md:h-32 relative"><img src={ASSETS.DEALER} alt="Dealer" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" /></div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 -mt-2"><span className="text-[8px] md:text-xs font-black text-white/80 uppercase tracking-widest">Dealer</span></div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 w-full max-w-[90vw]">
            {!gameState?.gameStarted && !gameState?.winner && (<button onClick={startGame} className="mb-4 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-black shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse">START GAME</button>)}
            <div className="bg-zinc-950/90 backdrop-blur-2xl border border-red-500/40 px-6 py-3 rounded-[32px] shadow-[0_0_40px_rgba(0,0,0,0.8)] flex flex-col items-center min-w-[150px]">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-red-500/80 mb-1">Total Pot</span>
              <div className="flex items-center gap-2 text-2xl font-black text-white"><Coins className="w-6 h-6 text-yellow-500" />{gameState?.pot.toLocaleString() || 0}</div>
            </div>
            {gameState?.winner && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 bg-yellow-500 text-black px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(234,179,8,0.4)]">🏆 {gameState.winner} Wins!</motion.div>)}
          </div>

          {rotatedPlayers.map((player, idx) => {
            const originalIdx = gameState?.players.findIndex(p => p.id === player.id);
            const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
            const isMobile = window.innerWidth < 768;
            const radiusX = isMobile ? 42 : 38;
            const radiusY = isMobile ? 30 : 32;
            const x = Math.cos(angle) * radiusX;
            const y = Math.sin(angle) * radiusY;
            const isCurrent = gameState?.currentTurn === originalIdx;
            const isMe = player.id === socket?.id;
            const isTopHalf = y < -5; 

            return (
              <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-30">
                {!isTopHalf && (<div className="flex -space-x-6 mb-1 scale-[0.8] md:scale-100 origin-bottom">{player.hand.map((card, cIdx) => (<CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />))}</div>)}
                <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-40' : ''} scale-[0.8] md:scale-100`}>
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-500 relative ${isCurrent ? 'border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] bg-red-500/30' : 'border-white/10 bg-black/60'}`}><UserIcon className={`w-6 h-6 ${isCurrent ? 'text-red-400' : 'text-white/40'}`} />{isMe && (<div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-black px-1 rounded-sm">VIP</div>)}</div>
                  <div className="mt-1 bg-black/90 px-3 py-1 rounded-full border border-white/10 flex flex-col items-center min-w-[80px] shadow-2xl"><span className="text-[8px] font-black truncate max-w-[60px] text-white/90">{player.name}</span><div className="flex items-center gap-1 text-[8px] font-black text-yellow-500"><Coins className="w-2 h-2" />{player.chips === -1 ? "???" : player.chips.toLocaleString()}</div></div>
                </div>
                {isTopHalf && (<div className="flex -space-x-6 mt-1 scale-[0.8] md:scale-100 origin-top">{player.hand.map((card, cIdx) => (<CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />))}</div>)}
              </motion.div>
            );
          })}
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black via-black/80 to-transparent z-40 shrink-0">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl p-2 rounded-xl border border-white/5">
            <div className="flex flex-col"><span className="text-[8px] font-black uppercase text-white/30">Balance</span><div className="flex items-center gap-1"><Coins className="w-4 h-4 text-yellow-500" /><span className="text-sm md:text-xl font-black text-white">{currentPlayer?.chips.toLocaleString() || 0}</span></div></div>
            <div className="flex flex-col"><span className="text-[8px] font-black uppercase text-white/30">Current Bet</span><div className="flex items-center gap-1"><Hand className="w-4 h-4 text-red-500" /><span className="text-sm md:text-xl font-black text-white">{gameState?.lastBet.toLocaleString() || 0}</span></div></div>
          </div>
          <div className="flex items-center gap-2">
            {isMyTurn && gameState?.gameStarted && !gameState.winner && (
              <div className="flex items-center gap-2">
                <button onClick={() => takeAction('fold')} className="bg-zinc-900 border border-white/10 text-white/60 font-black px-4 py-2 rounded-xl text-xs uppercase hover:bg-zinc-800">Fold</button>
                {currentPlayer?.isBlind && (<button onClick={() => takeAction('see')} className="bg-zinc-900 border border-white/10 text-white/80 font-black px-4 py-2 rounded-xl flex items-center gap-2 text-xs uppercase hover:bg-zinc-800"><Eye className="w-4 h-4 text-red-500" />See</button>)}
                <button onClick={() => takeAction('chaal')} className="bg-red-600 text-white font-black px-6 py-2 rounded-xl shadow-lg flex flex-col items-center uppercase min-w-[100px] hover:bg-red-500"><span className="text-[8px] font-black text-white/60">CHAAL</span><span className="text-sm md:text-lg">{(currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)?.toLocaleString()}</span></button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
