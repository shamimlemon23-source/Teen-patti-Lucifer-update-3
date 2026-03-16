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
  User,
  Hash,
  Minimize2,
  Maximize2,
  ChevronRight,
  Hand,
  Settings,
  Plus,
  RefreshCw,
  Disc
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

// Custom Asset URLs
const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
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
          <div className="absolute top-1 left-1 text-[5px] text-red-500/60 font-black uppercase tracking-widest">Lucifer</div>
          <div className="absolute bottom-1 right-1 text-[5px] text-red-500/60 font-black uppercase tracking-widest rotate-180">Lucifer</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-[10px] md:text-2xl leading-none ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
          <div className={`text-xl md:text-6xl drop-shadow-md ${SUIT_COLORS[card.suit]}`}>
            {SUIT_SYMBOLS[card.suit]}
          </div>
          <div className={`absolute bottom-1 right-1 font-black text-[10px] md:text-2xl leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
          <div className={`absolute top-1 right-1 text-[6px] md:text-[10px] opacity-20 ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-1 left-1 text-[6px] md:text-[10px] opacity-20 rotate-180 ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
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
  const [adminMessage, setAdminMessage] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [gameNotification, setGameNotification] = useState<string | null>(null);
  const [lastSpinTime, setLastSpinTime] = useState<number>(0);

  const isAdmin = useMemo(() => name.trim() === 'LUCIFER_DEV_777', [name]);

  useEffect(() => {
    if (socket) {
      socket.on('spinResult', (data: { prize: string, chips: number, lastSpin: number }) => {
        setIsSpinning(false);
        setSpinResult(data.prize);
        setLastSpinTime(data.lastSpin);
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        setTimeout(() => setSpinResult(null), 5000);
      });

      socket.on('spinError', (data: { message: string }) => {
        setIsSpinning(false);
        alert(data.message);
      });

      socket.on('gameNotification', (data: { message: string }) => {
        setGameNotification(data.message);
        setTimeout(() => setGameNotification(null), 4000);
      });

      socket.on('sideShowPrompt', (data: { fromId: string, fromName: string }) => {
        setSideShowPrompt(data);
      });
    }
  }, [socket]);

  useEffect(() => {
    if (gameState?.turnStartTime && gameState?.turnDuration) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - gameState.turnStartTime!;
        const remaining = Math.max(0, Math.ceil((gameState.turnDuration! - elapsed) / 1000));
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [gameState?.turnStartTime, gameState?.turnDuration, gameState?.currentTurn]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      window.scrollTo(0, 0);
      if (window.innerWidth > window.innerHeight && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
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
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      autoConnect: true,
      randomizationFactor: 0.5
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (name) {
        newSocket.emit('joinRoom', { roomId, name });
      }
    });
    
    newSocket.on('connect_error', (err) => {
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const startGame = () => socket?.emit('startGame', roomId);
  
  const takeAction = (action: string, amount?: number) => {
    if (action === 'chaal' || action === 'raise') {
      const bet = action === 'chaal' 
        ? (currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)
        : (currentPlayer?.isBlind ? (gameState?.lastBet || 0) + (amount || 0) : ((gameState?.lastBet || 0) + (amount || 0)) * 2);
      
      if (currentPlayer && currentPlayer.chips < (bet || 0)) {
        alert("Not enough chips!");
        return;
      }
    }
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
      const raiseAmount = parseInt(amount);
      const newLastBet = (gameState?.lastBet || 0) + raiseAmount;
      const totalBet = currentPlayer?.isBlind ? newLastBet : newLastBet * 2;
      
      if (currentPlayer && currentPlayer.chips < totalBet) {
        alert(`Not enough chips! You need ${totalBet.toLocaleString()} chips for this raise.`);
        return;
      }
      takeAction('raise', raiseAmount);
    }
  };

  const openAdminPanel = () => {
    if (!adminPassword) {
      const pass = prompt("Enter Admin Password:");
      if (pass === "LUCIFER_PASS_999") {
        setAdminPassword(pass);
        setShowAdminPanel(true);
        socket?.emit('getAdminStats', { adminName: name, adminPassword: pass });
      } else {
        alert("Incorrect Password!");
      }
    } else {
      setShowAdminPanel(true);
      socket?.emit('getAdminStats', { adminName: name, adminPassword });
    }
  };

  const refreshAdminStats = () => socket?.emit('getAdminStats', { adminName: name, adminPassword });
  
  const adminAction = (targetName: string | null, type: 'add' | 'reset' | 'set' | 'resetAll', amount: number = 0) => {
    socket?.emit('adminAction', { adminName: name, adminPassword, targetName, type, amount });
  };

  const handleAdminAdd = (targetName: string) => {
    const amount = prompt(`Enter amount to add for ${targetName}:`, "50000000");
    if (amount && !isNaN(parseInt(amount))) {
      adminAction(targetName, 'add', parseInt(amount));
    }
  };

  const handleAdminSet = (targetName: string) => {
    const amount = prompt(`Enter exact chips for ${targetName}:`, "100000000");
    if (amount && !isNaN(parseInt(amount))) {
      adminAction(targetName, 'set', parseInt(amount));
    }
  };

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    socket?.emit('spinWheel', { name });
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

  const activePlayersCount = useMemo(() => gameState?.players.filter(p => !p.isFolded).length || 0, [gameState]);

  const canShow = useMemo(() => {
    return isMyTurn && gameState?.gameStarted && !gameState.winner && activePlayersCount === 2;
  }, [isMyTurn, gameState, activePlayersCount]);

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
        
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="relative z-10 w-48 h-48 bg-red-600 rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] border-4 border-red-500/30 overflow-hidden"
        >
          <img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </motion.div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ delay: 0.5 }} 
          className="relative z-10 mt-8 text-4xl font-black text-white tracking-tighter text-center"
        >
          LUCIFER <span className="text-red-600">POKER</span>
        </motion.h1>
        <div className="relative z-10 mt-4 text-white/40 font-bold uppercase tracking-[0.5em] text-[10px]">Loading Underworld...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
      {/* Global Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src={ASSETS.TABLE_BG} 
          alt="Background" 
          className="w-full h-full object-cover opacity-20" 
          referrerPolicy="no-referrer" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      {/* Header - Now Global */}
      <header className="relative z-50 p-2 md:p-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-12 md:h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)] overflow-hidden border border-red-500/30">
            <img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col">
            <h2 className="font-black text-xs md:text-xl leading-tight text-white tracking-tighter">TEEN PATTI <span className="text-red-500">LUCIFER</span></h2>
            <div className="flex items-center gap-2">
              <span className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">
                {joined ? `Table: ${roomId}` : 'Underworld Lobby'}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 flex items-center justify-center"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>

          {joined && (
            <button 
              onClick={() => setShowSpinWheel(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-500/30 bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 transition-all"
            >
              <Disc className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              <span className="text-xs font-black uppercase hidden md:inline">Spin</span>
            </button>
          )}

          {joined && isAdmin && (
            <button 
              onClick={openAdminPanel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all"
            >
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-black uppercase hidden md:inline">Admin</span>
            </button>
          )}

          <button 
            onClick={() => window.location.reload()} 
            className="p-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-xl transition-colors group"
            title="Exit Game"
          >
            <LogOut className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {!joined ? (
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-black/60 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/20 blur-[100px]" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-600/20 blur-[100px]" />
            
            <div className="relative z-10">
              {/* Dealer Mascot on Join Screen */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-32 h-32 mx-auto mb-4"
              >
                <img src={ASSETS.DEALER} alt="Dealer" className="w-full h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
              </motion.div>

              <div className="text-red-600 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">ULTRA UPDATE v3.0</div>
              <h1 className="text-4xl font-black mb-2 tracking-tighter">LUCIFER <span className="text-red-600">POKER</span></h1>
              <p className="text-white/40 text-sm mb-8 font-bold">5 Crore Chips & Lucifer Bots Active!</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Your Name" 
                    className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all font-bold" 
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <select 
                    value={roomId} 
                    onChange={e => setRoomId(e.target.value)} 
                    className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all font-bold appearance-none text-white"
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i} value={`table-${i + 1}`} className="bg-zinc-900 text-white">
                        Table {i + 1}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronRight className="w-5 h-5 text-white/20 rotate-90" />
                  </div>
                </div>
                <button 
                  onClick={joinRoom} 
                  disabled={!name} 
                  className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl hover:bg-red-500 transition-all active:scale-95 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] border-b-4 border-red-800"
                >
                  ENTER UNDERWORLD
                </button>
                
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <button 
                    onClick={() => { setRoomId('table-1'); joinRoom(); }}
                    className="bg-emerald-600/20 border border-emerald-500/30 p-3 rounded-xl font-bold text-[10px] hover:bg-emerald-600/40 transition-all text-emerald-500 uppercase tracking-widest"
                  >
                    Quick Join: Table 1
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-2">
                  <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Developed By</span>
                  <a 
                    href="https://facebook.com/shamimlemon" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-500/60 hover:text-red-500 font-black uppercase tracking-[0.2em] transition-all hover:scale-110"
                  >
                    Shamim Lemon
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Game Area */}
          <main className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            {/* Notification Bar */}
            <AnimatePresence>
              {gameNotification && (
                <motion.div 
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 20, opacity: 1 }}
                  exit={{ y: -50, opacity: 0 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 z-[60] bg-red-600/90 backdrop-blur-xl border border-red-500/50 px-6 py-2 rounded-full shadow-2xl"
                >
                  <span className="text-white font-black text-[10px] md:text-sm uppercase tracking-widest whitespace-nowrap">{gameNotification}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {/* Table Surface */}
              <div className="absolute w-[90%] h-[70%] md:w-[80%] md:h-[60%] bg-emerald-900/20 rounded-[100px] md:rounded-[200px] border-[10px] md:border-[20px] border-zinc-900/80 shadow-[inset_0_0_100px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                <img src={ASSETS.TABLE_BG} alt="Table" className="w-full h-full object-cover opacity-30 mix-blend-overlay" referrerPolicy="no-referrer" />
              </div>
              
              {/* Dealer */}
              <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-24 h-24 md:w-40 md:h-40 relative"
                >
                  <img src={ASSETS.DEALER} alt="Dealer" className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" referrerPolicy="no-referrer" />
                </motion.div>
                <div className="bg-black/80 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 -mt-4 shadow-xl">
                  <span className="text-[10px] md:text-xs font-black text-white/60 uppercase tracking-[0.3em]">Dealer</span>
                </div>
              </div>

              {/* Pot Display */}
              <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 w-full">
                {!gameState?.gameStarted && !gameState?.winner && (
                  <div className="flex flex-col items-center gap-6 mb-8">
                    {(gameState?.players.length || 0) < 3 ? (
                      <div className="bg-black/80 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 text-white/40 font-black uppercase tracking-widest text-xs animate-pulse shadow-2xl">
                        Waiting for players ({(gameState?.players.length || 0)}/3)
                      </div>
                    ) : (
                      <button 
                        onClick={startGame}
                        className="bg-red-600 hover:bg-red-500 text-white px-12 py-6 rounded-[2rem] font-black text-2xl shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce border-2 border-red-400/40 active:scale-95 transition-all tracking-tighter"
                      >
                        START GAME
                      </button>
                    )}
                  </div>
                )}
                
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-zinc-950/90 backdrop-blur-3xl border-2 border-red-600/40 px-6 md:px-12 py-3 md:py-8 rounded-[2rem] md:rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col items-center min-w-[160px] md:min-w-[280px]"
                >
                  <span className="text-[8px] md:text-[12px] font-black uppercase tracking-[0.5em] text-red-500 mb-1 md:mb-2">Pot Value</span>
                  <div className="flex items-center gap-2 md:gap-4 text-2xl md:text-6xl font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
                    <Coins className="w-5 h-5 md:w-12 md:h-12 text-yellow-500" />
                    {gameState?.pot.toLocaleString() || 0}
                  </div>
                  <div className="mt-2 md:mt-4 text-[8px] md:text-sm font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2 md:gap-4">
                    <span>Bet: {gameState?.lastBet.toLocaleString() || 0}</span>
                    <span className="w-1 h-1 bg-white/20 rounded-full" />
                    <span>Round: {gameState?.roundCount || 0}/5</span>
                  </div>
                </motion.div>
                
                {gameState?.winner && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mt-6 bg-yellow-500 text-black px-8 py-3 rounded-full font-black text-sm md:text-base uppercase tracking-widest shadow-[0_0_40px_rgba(234,179,8,0.5)] border-2 border-yellow-300"
                  >
                    🏆 {gameState.winner} Wins!
                  </motion.div>
                )}
              </div>

              {/* Players Positioning */}
              {rotatedPlayers.map((player, idx) => {
                const originalIdx = gameState?.players.findIndex(p => p.id === player.id);
                const isMobile = window.innerWidth < 768;
                const isPortrait = window.innerHeight > window.innerWidth;
                let x, y;
                
                const radiusX = isMobile ? (isPortrait ? 32 : 42) : 40;
                const radiusY = isMobile ? (isPortrait ? 32 : 35) : 35;

                if (rotatedPlayers.length === 1) {
                  x = 0; y = radiusY;
                } else {
                  const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
                  x = Math.cos(angle) * radiusX;
                  y = Math.sin(angle) * radiusY;
                  
                  if (y < -10) {
                    y -= isMobile ? 10 : 8;
                    if (Math.abs(x) < 15) x = x < 0 ? -28 : 28;
                  }
                  if (y > 10) y += isMobile ? 12 : 8;
                }

                const isCurrent = gameState?.currentTurn === originalIdx;
                const isMe = player.id === socket?.id;
                const isTopHalf = y < 0; 

                return (
                  <motion.div
                    key={player.id}
                    style={{ left: `${50 + x}%`, top: `${50 + y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-40"
                  >
                    {!isTopHalf && (
                      <div className="flex -space-x-6 md:-space-x-14 mb-2 scale-[0.6] md:scale-[1.1] origin-bottom">
                        {player.hand.map((card: Card, cIdx: number) => (
                          <CardComponent key={`${player.id}-${cIdx}`} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />
                        ))}
                      </div>
                    )}

                    <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-30 grayscale' : ''} scale-[0.65] md:scale-[1.1]`}>
                      <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-3xl border-2 flex items-center justify-center transition-all duration-500 relative ${isCurrent ? 'border-red-500 shadow-[0_0_40px_rgba(220,38,38,0.8)] scale-110 bg-red-500/20' : 'border-white/10 bg-black/80'}`}>
                        <User className={`w-6 h-6 md:w-12 md:h-12 ${isCurrent ? 'text-red-500' : 'text-white/20'}`} />
                        {isMe && (
                          <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-[8px] md:text-[10px] font-black px-2 py-1 rounded-lg shadow-xl z-10 uppercase tracking-tighter">You</div>
                        )}
                        {!player.isBlind && !player.isFolded && (
                          <div className="absolute -bottom-3 bg-emerald-500 text-white text-[6px] md:text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg z-10 uppercase tracking-widest border border-emerald-400/50">Seen</div>
                        )}
                        {isCurrent && (
                          <div className="absolute -inset-2 border-2 border-red-500/30 rounded-[2rem] animate-ping" />
                        )}
                      </div>
                      
                      <div className="mt-2 bg-zinc-950/90 backdrop-blur-2xl px-4 md:px-8 py-1 md:py-3 rounded-xl md:rounded-2xl border border-white/10 flex flex-col items-center min-w-[80px] md:min-w-[160px] shadow-2xl">
                        <span className="text-[8px] md:text-sm font-black truncate max-w-[70px] md:max-w-[140px] text-white tracking-tight">{player.name}</span>
                        <div className="flex items-center gap-1 text-[9px] md:text-base font-black text-yellow-500">
                          <Coins className="w-3 h-3 md:w-4 md:h-4" />
                          {player.chips === -1 ? "???" : player.chips.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {isTopHalf && (
                      <div className="flex -space-x-6 md:-space-x-14 mt-2 scale-[0.6] md:scale-[1.1] origin-top">
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

          {/* Controls */}
          <footer className="relative p-2 md:p-6 pb-14 md:pb-20 bg-gradient-to-t from-black via-black/80 to-transparent z-50">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 md:gap-6">
              <div className="flex items-center gap-2 md:gap-4 bg-black/80 backdrop-blur-3xl p-2 md:p-4 rounded-2xl border border-white/10 w-full md:w-auto justify-between md:justify-start shadow-2xl">
                <div className="flex flex-col items-start">
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Your Balance</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-3 h-3 md:w-6 md:h-6 text-yellow-500" />
                    <span className="text-xs md:text-2xl font-black tracking-tighter text-white">{currentPlayer?.chips.toLocaleString() || 0}</span>
                  </div>
                </div>
                {timeLeft !== null && isMyTurn && (
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Time Left</span>
                    <span className={`text-sm md:text-2xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}s</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 md:gap-3 w-full md:w-auto justify-center flex-wrap">
                {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 md:gap-3 w-full justify-center flex-wrap">
                    <button onClick={() => takeAction('fold')} className="bg-zinc-900/90 border border-white/10 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">Fold</button>
                    {currentPlayer?.isBlind && (
                      <button onClick={() => takeAction('see')} className="bg-zinc-900/90 border border-white/10 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-1 md:gap-2 text-[9px] md:text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                        <Eye className="w-3 h-3 md:w-6 md:h-6 text-red-500" /> See
                      </button>
                    )}
                    {canSideShow && <button onClick={handleSideShow} className="bg-zinc-900/90 border border-white/10 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">Side</button>}
                    {canShow && <button onClick={() => takeAction('show')} className="bg-emerald-600 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95 shadow-xl border-b-2 md:border-b-4 border-emerald-800">Show</button>}
                    
                    <div className="flex items-stretch gap-px shadow-2xl rounded-xl md:rounded-2xl overflow-hidden">
                      <button onClick={() => takeAction('chaal')} className="bg-red-600 text-white font-black px-4 md:px-12 py-2 md:py-4 uppercase tracking-widest min-w-[80px] md:min-w-[180px] hover:bg-red-500 transition-all active:scale-95 border-r border-red-400/20">
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] md:text-[10px] font-black text-white/60 leading-none mb-0.5 md:mb-1">CHAAL</span>
                          <span className="text-xs md:text-2xl leading-none">{(currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)?.toLocaleString()}</span>
                        </div>
                      </button>
                      <button 
                        onClick={() => takeAction('raise', 100000)} 
                        className="bg-red-700 text-white font-black px-3 md:px-8 hover:bg-red-600 transition-all active:scale-95 flex items-center justify-center border-r border-red-400/20"
                        title="Quick Raise +100k"
                      >
                        <Plus className="w-3 h-3 md:w-6 md:h-6" />
                      </button>
                      <button 
                        onClick={handleRaise} 
                        className="bg-red-800 text-white font-black px-3 md:px-8 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center"
                        title="Custom Raise"
                      >
                        <Settings className="w-3 h-3 md:w-6 md:h-6" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Side Show Prompt */}
      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-4 md:p-8 rounded-2xl md:rounded-[2rem] text-center max-w-sm shadow-2xl">
              <h3 className="text-xl md:text-2xl font-black mb-1 md:mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-xs md:text-base text-white/60 mb-4 md:mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands.</p>
              <div className="flex gap-2 md:gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 hover:bg-white/10 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all text-[10px] md:text-sm">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 hover:bg-red-500 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 text-[10px] md:text-sm">Accept</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Dashboard */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdminPanel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-3 md:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2 md:gap-3"><Trophy className="w-4 h-4 md:w-6 md:h-6 text-red-500" /><h2 className="text-sm md:text-xl font-black uppercase tracking-tighter">Lucifer Dashboard</h2></div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button onClick={() => setAdminTab('players')} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${adminTab === 'players' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/40'}`}>Players</button>
                  <button onClick={() => setAdminTab('manual')} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${adminTab === 'manual' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/40'}`}>Manual</button>
                  <button onClick={() => setShowAdminPanel(false)} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors"><LogOut className="w-3.5 h-3.5 md:w-5 md:h-5 text-white/40" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
                {adminTab === 'players' ? (
                  adminStats.map((stat, i) => (
                    <div key={stat.name || i} className="flex items-center justify-between p-2 md:p-4 bg-white/5 border border-white/5 rounded-xl md:rounded-2xl">
                      <div className="flex items-center gap-2 md:gap-3"><span className="text-xs md:text-base font-bold">{stat.name}</span></div>
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-1 md:gap-2 text-yellow-500 font-black text-[10px] md:text-base"><Coins className="w-3 h-3 md:w-4 md:h-4" />{Number(stat.chips).toLocaleString()}</div>
                        <button onClick={() => handleAdminAdd(stat.name)} className="p-1.5 md:p-2 bg-green-600/10 hover:bg-green-600/20 border border-green-500/20 rounded-lg text-green-500 text-[8px] md:text-[10px] font-black uppercase">Add</button>
                        <button onClick={() => handleAdminSet(stat.name)} className="p-1.5 md:p-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-blue-500 text-[8px] md:text-[10px] font-black uppercase">Set</button>
                        <button onClick={() => adminAction(stat.name, 'reset')} className="p-1.5 md:p-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-red-500 text-[8px] md:text-[10px] font-black uppercase">Reset</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-4">
                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Player Name" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                    <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="Amount" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => {
                        const amt = parseInt(manualAmount);
                        if (!manualName || isNaN(amt)) return alert("Enter valid name and amount");
                        adminAction(manualName, 'add', amt);
                      }} className="bg-green-600 p-4 rounded-xl font-black uppercase">Add Chips</button>
                      <button onClick={() => {
                        const amt = parseInt(manualAmount);
                        if (!manualName || isNaN(amt)) return alert("Enter valid name and amount");
                        adminAction(manualName, 'set', amt);
                      }} className="bg-blue-600 p-4 rounded-xl font-black uppercase">Set Chips</button>
                    </div>
                    <button onClick={() => { if(confirm("Reset ALL players?")) adminAction(null, 'resetAll'); }} className="w-full bg-red-600/20 border border-red-500/50 p-4 rounded-xl font-black uppercase text-red-500">Reset All Players</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spin Wheel Modal */}
      <AnimatePresence>
        {showSpinWheel && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSpinning && setShowSpinWheel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-yellow-500/20 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(234,179,8,0.2)] p-8 flex flex-col items-center"
            >
              <div className="absolute top-6 right-6">
                <button onClick={() => !isSpinning && setShowSpinWheel(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut className="w-6 h-6 text-white/40" />
                </button>
              </div>

              <div className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Daily Reward</div>
              <h2 className="text-3xl font-black text-white mb-8 tracking-tighter">LUCIFER <span className="text-yellow-500">SPIN</span></h2>

              <div className="relative w-64 h-64 md:w-80 md:h-80 mb-8">
                {/* Pointer */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-white rounded-full shadow-2xl flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[20px] border-t-red-600" />
                </div>

                {/* Wheel */}
                <motion.div 
                  animate={isSpinning ? { rotate: 360 * 10 } : { rotate: 0 }}
                  transition={isSpinning ? { duration: 5, ease: "easeInOut" } : { duration: 0 }}
                  className="w-full h-full rounded-full border-8 border-yellow-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.3)] bg-zinc-900"
                >
                  {[
                    { prize: '1 Cr', color: 'bg-red-600' },
                    { prize: '2 Cr', color: 'bg-zinc-800' },
                    { prize: '5 Cr', color: 'bg-red-700' },
                    { prize: '10 Cr', color: 'bg-zinc-900' },
                    { prize: '20 Cr', color: 'bg-yellow-600' }
                  ].map((item, i) => (
                    <div 
                      key={i}
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 origin-bottom flex flex-col items-center pt-4 ${item.color}`}
                      style={{ 
                        transform: `translateX(-50%) rotate(${i * (360/5)}deg)`,
                        clipPath: 'polygon(50% 100%, 0 0, 100% 0)'
                      }}
                    >
                      <span className="text-white font-black text-xs md:text-lg tracking-tighter mt-4 drop-shadow-lg">
                        {item.prize}
                      </span>
                    </div>
                  ))}
                  
                  {/* Center hub */}
                  <div className="absolute inset-0 m-auto w-12 h-12 bg-black border-4 border-yellow-500 rounded-full z-10 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                </motion.div>
              </div>

              {spinResult ? (
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                  <div className="text-yellow-500 font-black text-4xl mb-2">CONGRATS!</div>
                  <div className="text-white font-black text-2xl uppercase tracking-widest">You Won {spinResult}</div>
                </motion.div>
              ) : (
                <button 
                  onClick={handleSpin}
                  disabled={isSpinning}
                  className={`w-full py-6 rounded-2xl font-black text-2xl transition-all active:scale-95 shadow-2xl border-b-4 ${isSpinning ? 'bg-zinc-800 text-white/20 border-zinc-900' : 'bg-yellow-600 text-black border-yellow-800 hover:bg-yellow-500'}`}
                >
                  {isSpinning ? 'SPINNING...' : 'SPIN NOW'}
                </button>
              )}

              <p className="mt-6 text-white/30 text-[10px] font-bold uppercase tracking-widest">Available once every 24 hours</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
