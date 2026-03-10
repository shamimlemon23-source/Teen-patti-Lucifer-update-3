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
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
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

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("Invite link copied!");
  };

  const currentPlayer = useMemo(() => gameState?.players.find(p => p.id === socket?.id), [gameState, socket]);
  const isMyTurn = useMemo(() => gameState?.players[gameState.currentTurn]?.id === socket?.id, [gameState, socket]);

  const canSideShow = useMemo(() => {
    if (!gameState || !isMyTurn || !currentPlayer || currentPlayer.isBlind) return false;
    let prevIdx = (gameState.currentTurn - 1 + gameState.players.length) % gameState.players.length;
    while (gameState.players[prevIdx].isFolded) {
      prevIdx = (prevIdx - 1 + gameState.players.length) % gameState.players.length;
    }
    return !gameState.players[prevIdx].isBlind;
  }, [gameState, isMyTurn, currentPlayer]);

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

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white font-sans">
        <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
          <div className="text-red-600 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">ULTRA UPDATE v3.0</div>
          <h1 className="text-4xl font-black mb-2">LUCIFER <span className="text-red-600">POKER</span></h1>
          <p className="text-white/40 text-sm mb-8">5 Crore Chips & Lucifer Bots Active!</p>
          <div className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none focus:border-red-600" />
            <input type="text" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Room ID" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none focus:border-red-600" />
            <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-4 rounded-xl font-bold text-lg hover:bg-red-500 transition-all active:scale-95">Enter Underworld</button>
            <button onClick={() => window.location.reload()} className="w-full bg-white/5 p-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors">Force Refresh App</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col">
      {/* Orientation Warning */}
      <div className="portrait-warning fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <svg className="w-12 h-12 text-red-600 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2">PLEASE ROTATE DEVICE</h2>
        <p className="text-white/60">For the best experience, please play in landscape mode.</p>
      </div>

      {/* Header */}
      <header className="p-2 md:p-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)] overflow-hidden border border-red-500/30">
            <img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h2 className="font-black text-sm md:text-lg leading-tight text-white tracking-tighter">TEEN PATTI <span className="text-red-500">LUCIFER</span></h2>
            <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">Table: {roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{isConnected ? 'Online' : 'Offline'}</span>
          </div>

          {isAdmin && (
            <button onClick={openAdminPanel} className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/30 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all">
              <Trophy className="w-4 h-4" />
              <span className="text-sm font-bold">DASHBOARD</span>
            </button>
          )}

          <button onClick={copyShareLink} className="hidden md:flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 px-4 py-2 rounded-full border border-red-500/30 text-red-400 transition-all">
            <Users className="w-4 h-4" />
            <span className="text-sm font-bold">Invite</span>
          </button>
          
          <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Users className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold">{gameState?.players.length || 0} Players</span>
          </div>
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <LogOut className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </header>

      {/* Game Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden bg-[#050505]">
        <div className="relative w-full h-full md:max-w-6xl md:max-h-[80vh] md:aspect-video bg-emerald-950 md:rounded-[100px] border-emerald-900/50 shadow-[0_0_100px_rgba(16,185,129,0.1)] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-20">
            <img src={ASSETS.TABLE_BG} alt="Table BG" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-10">
            <h1 className="text-[12vw] font-black rotate-[-30deg] whitespace-nowrap">TEEN PATTI LUCIFER</h1>
          </div>
          
          <div className="absolute inset-0 opacity-10 pointer-events-none z-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
            {!gameState?.gameStarted && !gameState?.winner && (
              <button onClick={startGame} className="mb-4 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse">
                START GAME
              </button>
            )}
            
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-red-500/30 px-4 md:px-8 py-2 md:py-4 rounded-2xl md:rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.2)] flex flex-col items-center">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-red-500/60 mb-1">Total Pot</span>
              <div className="flex items-center gap-2 text-xl md:text-4xl font-black text-white">
                <Coins className="w-5 h-5 md:w-8 md:h-8 text-yellow-500" />
                {gameState?.pot.toLocaleString() || 0}
              </div>
              <div className="mt-1 text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest">
                Bet: {gameState?.lastBet.toLocaleString() || 0} • Round: {gameState?.roundCount || 0}/5
              </div>
              
              {gameState?.gameStarted && !gameState.winner && (
                <div className="mt-2 md:mt-4 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 30, ease: "linear" }}
                    key={gameState.currentTurn}
                  />
                </div>
              )}
            </div>
            
            {gameState?.winner && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(234,179,8,0.4)] flex flex-col items-center">
                <span>🏆 {gameState.winner} Wins!</span>
                {(gameState as any).winnerChips && <span className="text-[8px] opacity-70">+{(gameState as any).winnerChips.toLocaleString()}</span>}
              </motion.div>
            )}
          </div>

          {gameState?.players.map((player, idx) => {
            const angle = (idx / gameState.players.length) * 2 * Math.PI + Math.PI / 2;
            const x = Math.cos(angle) * 35;
            const y = Math.sin(angle) * 35;
            const isCurrent = gameState.currentTurn === idx;
            const isMe = player.id === socket?.id;

            return (
              <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-3 z-30">
                <div className="flex -space-x-6 md:-space-x-8 mb-1">
                  {player.hand.map((card: Card, cIdx: number) => (
                    <CardComponent key={`${player.id}-${cIdx}`} card={card} hidden={isMe ? player.isBlind : !gameState.winner} index={cIdx} />
                  ))}
                </div>

                <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-40' : ''}`}>
                  <div className={`w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${isCurrent ? 'border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-110 bg-red-500/20' : 'border-white/10 bg-white/5'}`}>
                    <UserIcon className={`w-5 h-5 md:w-8 md:h-8 ${isCurrent ? 'text-red-400' : 'text-white/40'}`} />
                  </div>
                  
                  <div className="mt-1 bg-black/80 backdrop-blur-md px-2 md:px-4 py-0.5 md:py-1.5 rounded-full border border-white/10 flex flex-col items-center min-w-[60px] md:min-w-[100px]">
                    <span className="text-[8px] md:text-xs font-bold truncate max-w-[60px] md:max-w-[80px]">{player.name} {isMe && "(You)"}</span>
                    <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-black text-yellow-500">
                      <Coins className="w-2 h-2 md:w-3 md:h-3" />
                      {player.chips === -1 ? "???" : player.chips.toLocaleString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Controls */}
      <footer className="p-3 md:p-6 bg-black/60 backdrop-blur-2xl border-t border-white/10 z-30 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 md:gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-white/40">Balance</span>
              <div className="flex items-center gap-1 md:gap-2">
                <Coins className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                <span className="text-sm md:text-2xl font-black tracking-tighter">{currentPlayer?.chips.toLocaleString() || 0}</span>
              </div>
            </div>
            <div className="h-6 md:h-10 w-px bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-white/40">Bet</span>
              <div className="flex items-center gap-1 md:gap-2">
                <Hand className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
                <span className="text-sm md:text-2xl font-black tracking-tighter">{gameState?.lastBet.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {isMyTurn && gameState?.gameStarted && !gameState.winner && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 md:gap-3">
                <button onClick={() => takeAction('fold')} className="bg-white/5 border border-white/10 text-white/60 font-bold px-3 md:px-6 py-2 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-sm uppercase tracking-widest">Fold</button>
                {currentPlayer?.isBlind && (
                  <button onClick={() => takeAction('see')} className="bg-white/5 border border-white/10 text-white/60 font-bold px-3 md:px-6 py-2 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-1 md:gap-2 text-[10px] md:text-sm uppercase tracking-widest">
                    <Eye className="w-4 h-4 md:w-5 md:h-5" /> See
                  </button>
                )}
                {canSideShow && (
                  <button onClick={handleSideShow} className="bg-white/5 border border-white/10 text-white/60 font-bold px-3 md:px-6 py-2 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-sm uppercase tracking-widest">Side</button>
                )}
                <div className="flex items-stretch gap-0.5 md:gap-1">
                  <button onClick={() => takeAction('chaal')} className="bg-red-600 text-white font-black px-4 md:px-10 py-2 md:py-4 rounded-l-xl md:rounded-l-2xl shadow-lg flex flex-col items-center uppercase tracking-widest min-w-[70px] md:min-w-[140px]">
                    <span className="text-[7px] md:text-[10px] opacity-60">Chaal</span>
                    <span className="text-xs md:text-lg">{(currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)?.toLocaleString()}</span>
                  </button>
                  <button onClick={handleRaise} className="bg-red-700 text-white font-black px-2 md:px-4 rounded-r-xl md:rounded-r-2xl border-l border-red-500/30 text-lg md:text-2xl">+</button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-8 rounded-[2rem] text-center max-w-sm">
              <h3 className="text-2xl font-black mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-white/60 mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands with you.</p>
              <div className="flex gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 hover:bg-white/10 p-4 rounded-xl font-bold uppercase tracking-widest transition-all">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 hover:bg-red-500 p-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/20">Accept</button>
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
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-red-500" />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Lucifer Dashboard</h2>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut className="w-5 h-5 text-white/40" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {adminMessage && <div className="bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-xl text-emerald-400 text-xs font-bold text-center animate-bounce">{adminMessage}</div>}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Player Accounts ({adminStats.length})</span>
                  <button onClick={resetAllChips} className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all">Reset All Chips</button>
                </div>
                <div className="grid gap-2">
                  {adminStats.map((stat, i) => (
                    <div key={stat.name} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{stat.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-yellow-500 font-black"><Coins className="w-4 h-4" />{stat.chips.toLocaleString()}</div>
                        <button onClick={() => addPlayerChips(stat.name)} className="p-2 bg-green-600/10 hover:bg-green-600/20 border border-green-500/20 rounded-lg text-green-500 text-[10px] font-black uppercase transition-all">Add Chips</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
