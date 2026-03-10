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

// --- Components ---

interface CardComponentProps {
  card: Card;
  hidden: boolean;
  index: number;
  key?: string | number;
}

const CardComponent = ({ card, hidden, index }: CardComponentProps) => {
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180 }}
      animate={{ scale: 1, y: 0, rotate: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
      className={`relative w-10 h-14 md:w-16 md:h-24 rounded-lg shadow-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-zinc-50 border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-zinc-900 to-zinc-950 rounded-lg">
          <div className="w-8 h-12 border-2 border-red-600/20 rounded-md flex items-center justify-center rotate-45">
            <div className="text-red-600/40 font-black text-lg -rotate-45">L</div>
          </div>
        </div>
      ) : (
        <>
          <div className={`absolute top-0.5 left-0.5 font-black text-xs md:text-base leading-none ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
          <div className={`text-xl md:text-3xl drop-shadow-sm ${SUIT_COLORS[card.suit]}`}>
            {SUIT_SYMBOLS[card.suit]}
          </div>
          <div className={`absolute bottom-0.5 right-0.5 font-black text-xs md:text-base leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>
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
    const handleResize = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 30000,
      autoConnect: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
      if (name) {
        newSocket.emit('joinRoom', { roomId, name });
      }
    });
    
    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

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
  }, []);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const startGame = () => socket?.emit('startGame', roomId);
  
  const takeAction = (action: string, amount?: number) => {
    socket?.emit('action', { roomId, action, amount });
  };

  const handleSideShow = () => {
    socket?.emit('sideShowRequest', roomId);
  };

  const respondSideShow = (accepted: boolean) => {
    socket?.emit('sideShowResponse', { roomId, accepted });
    setSideShowPrompt(null);
  };

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount (Unlimited):", "1000000");
    if (amount && !isNaN(parseInt(amount))) {
      takeAction('raise', parseInt(amount));
    }
  };

  const openAdminPanel = () => {
    setShowAdminPanel(true);
    socket?.emit('getAdminStats', name);
  };

  const refreshAdminStats = () => socket?.emit('getAdminStats', name);
  const resetAllChips = () => { if (confirm("Reset ALL players?")) socket?.emit('resetAllChips', name); };
  const resetPlayerChips = (targetName: string) => socket?.emit('resetPlayerChips', { adminName: name, targetName });
  const addPlayerChips = (targetName: string, amount: string = "50000000") => {
    const customAmount = prompt(`Enter amount to add for ${targetName}:`, amount);
    if (customAmount && !isNaN(parseInt(customAmount))) {
      socket?.emit('addPlayerChips', { adminName: name, targetName, amount: customAmount });
    }
  };

  const rotatedPlayers = useMemo(() => {
    if (!gameState) return [];
    const players = [...gameState.players];
    const myIndex = players.findIndex(p => p.id === socket?.id);
    if (myIndex === -1) return players;
    
    const rotated = [];
    for (let i = 0; i < players.length; i++) {
      rotated.push(players[(myIndex + i) % players.length]);
    }
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (showSplash) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40">
          <img src={ASSETS.SPLASH_BG} alt="Splash BG" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
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
        <p className="text-white/60">For the best experience, please play in landscape mode.</p>
      </div>

      <header className="absolute top-0 left-0 right-0 p-1 md:p-2 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-red-600 rounded-lg flex items-center justify-center overflow-hidden border border-red-500/30">
            <img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="hidden xs:block">
            <h2 className="font-black text-[10px] md:text-sm leading-tight text-white tracking-tighter">TEEN PATTI <span className="text-red-500">LUCIFER</span></h2>
            <p className="text-[6px] md:text-[8px] text-white/40 font-bold uppercase tracking-widest">Table: {roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 md:gap-1.5">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[7px] md:text-[9px] font-bold text-white/30 uppercase tracking-widest">{isConnected ? 'Online' : 'Offline'}</span>
          </div>
          <button onClick={toggleFullscreen} className="p-1 md:p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">
            <Play className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-white/60 rotate-[-90deg]" />
          </button>
          {isAdmin && (
            <button onClick={openAdminPanel} className="flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-0.5 md:py-1 rounded-full border border-red-500/30 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all">
              <Trophy className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
              <span className="text-[8px] md:text-xs font-bold uppercase">ADMIN</span>
            </button>
          )}
          <button onClick={() => window.location.reload()} className="p-1 md:p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/60" />
          </button>
        </div>
      </header>

      <main className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
        <div className="relative w-full h-full bg-emerald-950 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img src={ASSETS.TABLE_BG} alt="Table BG" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
          </div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 w-full max-w-[90vw]">
            {!gameState?.gameStarted && !gameState?.winner && (
              <button onClick={startGame} className="mb-2 md:mb-4 bg-red-600 hover:bg-red-500 text-white px-5 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl font-black text-sm md:text-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse border-2 border-red-400/30 active:scale-95 transition-transform">START GAME</button>
            )}
            
            <div className="bg-zinc-950/90 backdrop-blur-2xl border border-red-500/40 px-3 md:px-8 py-1.5 md:py-4 rounded-xl md:rounded-[32px] shadow-[0_0_40px_rgba(0,0,0,0.8)] flex flex-col items-center min-w-[100px] md:min-w-[180px]">
              <span className="text-[5px] md:text-[9px] font-black uppercase tracking-[0.3em] text-red-500/80 mb-0.5">Total Pot</span>
              <div className="flex items-center gap-1 md:gap-2 text-base md:text-3xl font-black text-white">
                <Coins className="w-3 h-3 md:w-7 md:h-7 text-yellow-500" />
                {gameState?.pot.toLocaleString() || 0}
              </div>
              <div className="mt-0.5 text-[5px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest">Bet: {gameState?.lastBet.toLocaleString() || 0} • Round: {gameState?.roundCount || 0}/5</div>
            </div>
            
            {gameState?.winner && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 bg-yellow-500 text-black px-4 py-1.5 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(234,179,8,0.4)] flex flex-col items-center border-2 border-yellow-300">
                <span>🏆 {gameState.winner} Wins!</span>
              </motion.div>
            )}
          </div>

          {/* Players Positioning */}
          {rotatedPlayers.map((player, idx) => {
            const originalIdx = gameState?.players.findIndex(p => p.id === player.id);
            const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
            const isMobile = window.innerWidth < 768;
            const radiusX = isMobile ? 38 : 32;
            const radiusY = isMobile ? 30 : 30;
            const x = Math.cos(angle) * radiusX;
            const y = Math.sin(angle) * radiusY;
            const isCurrent = gameState?.currentTurn === originalIdx;
            const isMe = player.id === socket?.id;
            const isTopHalf = y < -5; 

            return (
              <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 md:gap-2 z-30">
                {!isTopHalf && (
                  <div className="flex -space-x-8 md:-space-x-10 mb-0.5 scale-[0.5] md:scale-[0.8] origin-bottom">
                    {player.hand.map((card: Card, cIdx: number) => (
                      <CardComponent key={`${player.id}-${cIdx}`} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />
                    ))}
                  </div>
                )}

                <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-40' : ''} scale-[0.6] xs:scale-[0.7] md:scale-[0.9]`}>
                  <div className={`w-7 h-7 md:w-12 md:h-12 rounded-lg md:rounded-xl border-2 flex items-center justify-center transition-all duration-500 ${isCurrent ? 'border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-110 bg-red-500/30' : 'border-white/10 bg-black/60'}`}>
                    <UserIcon className={`w-3.5 h-3.5 md:w-6 md:h-6 ${isCurrent ? 'text-red-400' : 'text-white/40'}`} />
                  </div>
                  <div className="mt-0.5 md:mt-1 bg-black/90 backdrop-blur-xl px-2 md:px-4 py-0.5 md:py-1 rounded-full border border-white/10 flex flex-col items-center min-w-[50px] md:min-w-[100px] shadow-xl">
                    <span className="text-[5px] md:text-[10px] font-black truncate max-w-[40px] md:max-w-[80px] text-white/90">{player.name} {isMe && "(You)"}</span>
                    <div className="flex items-center gap-0.5 md:gap-1 text-[6px] md:text-[10px] font-black text-yellow-500">
                      <Coins className="w-1.5 h-1.5 md:w-3 md:h-3" />
                      {player.chips === -1 ? "???" : player.chips.toLocaleString()}
                    </div>
                  </div>
                </div>

                {isTopHalf && (
                  <div className="flex -space-x-8 md:-space-x-10 mt-0.5 scale-[0.5] md:scale-[0.8] origin-top">
                    {player.hand.map((card: Card, cIdx: number) => (
                      <CardComponent key={`${player.id}-${cIdx}`} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-2 md:p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-40 shrink-0">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4 bg-black/40 backdrop-blur-xl p-1.5 md:p-2.5 rounded-xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-[5px] md:text-[8px] font-black uppercase tracking-widest text-white/30">Balance</span>
              <div className="flex items-center gap-1 md:gap-1.5">
                <Coins className="w-3 h-3 md:w-5 md:h-5 text-yellow-500" />
                <span className="text-[10px] md:text-xl font-black tracking-tighter text-white">{currentPlayer?.chips.toLocaleString() || 0}</span>
              </div>
            </div>
            <div className="h-5 md:h-8 w-px bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[5px] md:text-[8px] font-black uppercase tracking-widest text-white/30">Current Bet</span>
              <div className="flex items-center gap-1 md:gap-1.5">
                <Hand className="w-3 h-3 md:w-5 md:h-5 text-red-500" />
                <span className="text-[10px] md:text-xl font-black tracking-tighter text-white">{gameState?.lastBet.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {isMyTurn && gameState?.gameStarted && !gameState.winner && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1 md:gap-2">
                <button onClick={() => takeAction('fold')} className="bg-zinc-900/80 border border-white/10 text-white/60 font-black px-2 md:px-5 py-1.5 md:py-3 rounded-lg md:rounded-xl text-[8px] md:text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95">Fold</button>
                {currentPlayer?.isBlind && (
                  <button onClick={() => takeAction('see')} className="bg-zinc-900/80 border border-white/10 text-white/80 font-black px-2 md:px-5 py-1.5 md:py-3 rounded-lg md:rounded-xl flex items-center gap-1 md:gap-2 text-[8px] md:text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"><Eye className="w-3 h-3 md:w-5 md:h-5 text-red-500" />See</button>
                )}
                <div className="flex items-stretch gap-0.5 shadow-2xl">
                  <button onClick={() => takeAction('chaal')} className="bg-red-600 text-white font-black px-3 md:px-8 py-1.5 md:py-3 rounded-l-lg md:rounded-l-xl shadow-[0_0_20px_rgba(220,38,38,0.3)] flex flex-col items-center uppercase tracking-widest min-w-[60px] md:min-w-[120px] hover:bg-red-500 transition-all active:scale-95">
                    <span className="text-[5px] md:text-[9px] font-black text-white/60">CHAAL</span>
                    <span className="text-[10px] md:text-lg">{(currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)?.toLocaleString()}</span>
                  </button>
                  <button onClick={handleRaise} className="bg-red-700 text-white font-black px-2 md:px-4 rounded-r-lg md:rounded-r-xl border-l border-red-500/30 text-base md:text-2xl hover:bg-red-600 transition-all active:scale-95">+</button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-4 md:p-8 rounded-2xl md:rounded-[2rem] text-center max-w-sm shadow-2xl">
              <h3 className="text-xl md:text-2xl font-black mb-1 md:mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-xs md:text-base text-white/60 mb-4 md:mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands with you.</p>
              <div className="flex gap-2 md:gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 hover:bg-white/10 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all text-[10px] md:text-sm">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 hover:bg-red-500 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 text-[10px] md:text-sm">Accept</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
