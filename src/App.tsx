import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Coins, 
  Eye, 
  EyeOff, 
  LogOut, 
  Play, 
  User as UserIcon,
  ChevronRight,
  Hand
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

// Custom Asset URLs
const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png"
};

interface Card {
  suit: Suit;
  rank: Rank;
}

interface Player {
  id: string;
  name: string;
  chips: number;
  hand: Card[];
  isFolded: boolean;
  isBlind: boolean;
  currentBet: number;
}

interface GameState {
  players: Player[];
  pot: number;
  currentTurn: number;
  lastBet: number;
  gameStarted: boolean;
  winner: string | null;
  roundCount: number;
  turnStartTime?: number;
  turnDuration?: number;
  autoStartIn: number;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-slate-900',
  spades: 'text-slate-900'
};

const CardComponent = ({ card, hidden, index }: { card: Card, hidden: boolean, index: number }) => {
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180 }}
      animate={{ scale: 1, y: 0, rotate: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
      className={`relative w-12 h-16 md:w-20 md:h-28 rounded-lg shadow-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-zinc-50 border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-zinc-900 to-zinc-950 rounded-lg">
          <div className="w-10 h-14 border-2 border-red-600/20 rounded-md flex items-center justify-center rotate-45">
            <div className="text-red-600/40 font-black text-xl -rotate-45">L</div>
          </div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-sm md:text-lg leading-none ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
          <div className={`text-2xl md:text-4xl drop-shadow-sm ${SUIT_COLORS[card.suit]}`}>
            {SUIT_SYMBOLS[card.suit]}
          </div>
          <div className={`absolute bottom-1 right-1 font-black text-sm md:text-lg leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
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

  const isAdmin = useMemo(() => name.trim().toLowerCase() === 'admin', [name]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => { window.scrollTo(0, 0); };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 30000,
      autoConnect: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (name) newSocket.emit('joinRoom', { roomId, name });
    });
    
    newSocket.on('connect_error', () => setIsConnected(false));
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
      if (state.winner) confetti({ particleCount: 150, spread: 70 });
    });

    newSocket.on('adminStats', (stats: any[]) => setAdminStats(stats));
    newSocket.on('adminMessage', (msg: string) => {
      setAdminMessage(msg);
      setTimeout(() => setAdminMessage(''), 3000);
    });

    newSocket.on('sideShowPrompt', (data: { fromName: string }) => {
      setSideShowPrompt(data);
    });

    return () => { newSocket.close(); };
  }, [joined]);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const startGame = () => socket?.emit('startGame', roomId);
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });
  const handleSideShow = () => socket?.emit('sideShowRequest', roomId);
  const respondSideShow = (accepted: boolean) => { socket?.emit('sideShowResponse', { roomId, accepted }); setSideShowPrompt(null); };

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount:", "1000000");
    if (amount && !isNaN(parseInt(amount))) takeAction('raise', parseInt(amount));
  };

  const openAdminPanel = () => { setShowAdminPanel(true); socket?.emit('getAdminStats', name); };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

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

  if (showSplash) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40">
          <img src={ASSETS.SPLASH_BG} alt="Splash BG" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-48 h-48 bg-red-600 rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] border-4 border-red-500/30 overflow-hidden">
          <img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </motion.div>
        <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="relative z-10 mt-8 text-4xl font-black text-white tracking-tighter text-center">LUCIFER <span className="text-red-600">POKER</span></motion.h1>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white font-sans">
        <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
          <h1 className="text-4xl font-black mb-2">LUCIFER <span className="text-red-600">POKER</span></h1>
          <p className="text-white/40 text-sm mb-8">5 Crore Chips & Lucifer Bots Active!</p>
          <div className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none focus:border-red-600" />
            <input type="text" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Room ID" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none focus:border-red-600" />
            <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-4 rounded-xl font-bold text-lg hover:bg-red-500 transition-all active:scale-95">Enter Underworld</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
      <div className="portrait-warning fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-black mb-2">PLEASE ROTATE DEVICE</h2>
        <p className="text-white/60">Play in landscape mode for the best experience.</p>
      </div>

      <header className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <img src={ASSETS.LOGO} alt="Logo" className="w-8 h-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
          <h2 className="font-black text-sm text-white tracking-tighter">LUCIFER <span className="text-red-500">POKER</span></h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleFullscreen} className="p-2 bg-white/5 rounded-lg border border-white/10"><Play className="w-4 h-4 text-white/60 rotate-[-90deg]" /></button>
          {isAdmin && <button onClick={openAdminPanel} className="px-3 py-1 rounded-full border border-red-500/30 bg-red-600/10 text-red-400 text-xs font-bold">ADMIN</button>}
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/10 rounded-full"><LogOut className="w-5 h-5 text-white/60" /></button>
        </div>
      </header>

      <main className="absolute inset-0 z-0 flex items-center justify-center bg-[#050505]">
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img src={ASSETS.TABLE_BG} alt="Table BG" className="absolute inset-0 w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
            {!gameState?.gameStarted && !gameState?.winner && (
              <button onClick={startGame} className="mb-4 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-xl shadow-[0_0_40px_rgba(220,38,38,0.6)] animate-pulse active:scale-95 transition-transform">START GAME</button>
            )}
            
            <div className="bg-zinc-950/90 backdrop-blur-2xl border border-red-500/40 px-6 py-3 rounded-[30px] shadow-2xl flex flex-col items-center min-w-[160px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80 mb-1">Total Pot</span>
              <div className="flex items-center gap-2 text-3xl font-black text-white"><Coins className="w-6 h-6 text-yellow-500" />{gameState?.pot.toLocaleString() || 0}</div>
              <div className="mt-1 text-[10px] font-bold text-white/50 uppercase tracking-widest">Bet: {gameState?.lastBet.toLocaleString() || 0} • Round: {gameState?.roundCount || 0}/5</div>
              {gameState?.gameStarted && !gameState.winner && (
                <div className="mt-3 w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-red-600" initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 30, ease: "linear" }} key={gameState.currentTurn} /></div>
              )}
            </div>
            
            {gameState?.winner && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 bg-yellow-500 text-black px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl">🏆 {gameState.winner} Wins!</motion.div>}
            {!gameState?.gameStarted && gameState?.autoStartIn > 0 && <div className="mt-4 text-red-500 font-black text-lg animate-pulse">STARTING IN {gameState.autoStartIn}S...</div>}
          </div>

          {gameState?.players.map((player, idx) => {
            const angle = (idx / gameState.players.length) * 2 * Math.PI + Math.PI / 2;
            const radiusX = window.innerWidth < 768 ? 42 : 38;
            const radiusY = window.innerWidth < 768 ? 40 : 35;
            const x = Math.cos(angle) * radiusX;
            const y = Math.sin(angle) * radiusY;
            const isCurrent = gameState.currentTurn === idx;
            const isMe = player.id === socket?.id;

            return (
              <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30">
                <div className="flex -space-x-10 mb-1 scale-[0.6] md:scale-100 origin-bottom">
                  {player.hand.map((card, cIdx) => <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState.winner} index={cIdx} />)}
                </div>
                <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-40' : ''} scale-[0.8] md:scale-100`}>
                  <div className={`w-10 h-10 md:w-16 md:h-16 rounded-xl border-2 flex items-center justify-center transition-all duration-500 ${isCurrent ? 'border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] bg-red-500/20' : 'border-white/10 bg-black/60'}`}><UserIcon className={`w-6 h-6 md:w-8 md:h-8 ${isCurrent ? 'text-red-400' : 'text-white/40'}`} /></div>
                  <div className="mt-1 bg-black/90 px-3 py-1 rounded-full border border-white/10 flex flex-col items-center min-w-[80px] shadow-xl">
                    <span className="text-[10px] font-black truncate max-w-[80px] text-white/90">{player.name} {isMe && "(You)"}</span>
                    <div className="flex items-center gap-1 text-[10px] font-black text-yellow-500"><Coins className="w-3 h-3" />{player.chips === -1 ? "???" : player.chips.toLocaleString()}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent z-40">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/5">
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest text-white/30">Balance</span><div className="flex items-center gap-2"><Coins className="w-5 h-5 text-yellow-500" /><span className="text-xl font-black text-white">{currentPlayer?.chips.toLocaleString() || 0}</span></div></div>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest text-white/30">Bet</span><div className="flex items-center gap-2"><Hand className="w-5 h-5 text-red-500" /><span className="text-xl font-black text-white">{gameState?.lastBet.toLocaleString() || 0}</span></div></div>
          </div>

          <div className="flex items-center gap-2">
            {isMyTurn && gameState?.gameStarted && !gameState.winner && (
              <div className="flex items-center gap-2">
                <button onClick={() => takeAction('fold')} className="bg-zinc-900 border border-white/10 text-white/60 font-black px-4 py-3 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform">Fold</button>
                {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-zinc-900 border border-white/10 text-white/80 font-black px-4 py-3 rounded-xl flex items-center gap-2 text-xs uppercase tracking-widest active:scale-95 transition-transform"><Eye className="w-4 h-4 text-red-500" />See</button>}
                {canSideShow && <button onClick={handleSideShow} className="bg-zinc-900 border border-white/10 text-white/80 font-black px-4 py-3 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform">Side</button>}
                <div className="flex items-stretch gap-1">
                  <button onClick={() => takeAction('chaal')} className="bg-red-600 text-white font-black px-6 py-3 rounded-l-xl flex flex-col items-center uppercase tracking-widest min-w-[100px] active:scale-95 transition-transform"><span className="text-[10px] font-black text-white/60">CHAAL</span><span className="text-lg">{(currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)?.toLocaleString()}</span></button>
                  <button onClick={handleRaise} className="bg-red-700 text-white font-black px-4 rounded-r-xl border-l border-red-500/30 text-2xl active:scale-95 transition-transform">+</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-8 rounded-[2rem] text-center max-w-sm">
              <h3 className="text-2xl font-black mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-white/60 mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands.</p>
              <div className="flex gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 p-4 rounded-xl font-bold uppercase tracking-widest">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 p-4 rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-red-600/20">Accept</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdminPanel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3"><Trophy className="w-6 h-6 text-red-500" /><h2 className="text-xl font-black uppercase tracking-tighter">Lucifer Dashboard</h2></div>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-white/10 rounded-full"><LogOut className="w-5 h-5 text-white/40" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {adminStats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                    <span className="font-bold">{stat.name}</span>
                    <div className="flex items-center gap-4"><div className="flex items-center gap-2 text-yellow-500 font-black"><Coins className="w-4 h-4" />{stat.chips.toLocaleString()}</div></div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
