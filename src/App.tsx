import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Coins, 
  Eye, 
  LogOut, 
  Play, 
  User as UserIcon,
  Hand
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
interface GameState { players: Player[]; pot: number; currentTurn: number; lastBet: number; gameStarted: boolean; winner: string | null; roundCount: number; autoStartIn: number; }

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS: Record<Suit, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-900', spades: 'text-slate-900' };

const CardComponent = ({ card, hidden, index }: { card: Card; hidden: boolean; index: number }) => {
  const tilt = (index - 1) * 5;
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180 }}
      animate={{ scale: 1, y: 0, rotate: tilt }}
      className={`relative w-10 h-14 md:w-18 md:h-24 rounded-md md:rounded-lg shadow-2xl border flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-zinc-50 border-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-800 via-red-950 to-black rounded-md md:rounded-lg border border-red-500/30 overflow-hidden relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '10px 10px' }}></div>
          <div className="w-6 h-9 border border-red-500/40 rounded-sm flex items-center justify-center rotate-45 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <div className="text-red-500/60 font-black text-sm -rotate-45 tracking-tighter">L</div>
          </div>
          <div className="absolute top-0.5 left-0.5 text-[4px] text-red-500/40 font-bold uppercase">Lucifer</div>
          <div className="absolute bottom-0.5 right-0.5 text-[4px] text-red-500/40 font-bold uppercase rotate-180">Lucifer</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-0.5 left-0.5 font-black text-[9px] md:text-lg leading-none ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-base md:text-4xl drop-shadow-sm ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-0.5 right-0.5 font-black text-[9px] md:text-lg leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
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
      timeout: 60000 
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
    newSocket.on('sideShowPrompt', (data: { fromName: string }) => setSideShowPrompt(data));
    return () => { newSocket.close(); };
  }, [name, roomId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const startGame = () => socket?.emit('startGame', roomId);
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount:", "1000000");
    if (amount && !isNaN(parseInt(amount))) takeAction('raise', parseInt(amount));
  };

  const handleSideShow = () => socket?.emit('sideShowRequest', roomId);
  const respondSideShow = (accepted: boolean) => { socket?.emit('sideShowResponse', { roomId, accepted }); setSideShowPrompt(null); };

  const rotatedPlayers = useMemo(() => {
    if (!gameState) return [];
    const players = [...gameState.players];
    const myIndex = players.findIndex(p => p.name === name);
    if (myIndex === -1) return players;
    const rotated = [];
    for (let i = 0; i < players.length; i++) rotated.push(players[(myIndex + i) % players.length]);
    return rotated;
  }, [gameState, name]);

  const currentPlayer = useMemo(() => gameState?.players.find(p => p.name === name), [gameState, name]);
  const isMyTurn = useMemo(() => gameState?.players[gameState.currentTurn]?.name === name, [gameState, name]);
  
  const activeCount = useMemo(() => gameState?.players.filter(p => !p.isFolded).length || 0, [gameState]);
  const canShow = useMemo(() => isMyTurn && activeCount === 2, [isMyTurn, activeCount]);

  const canSideShow = useMemo(() => {
    if (!gameState || !isMyTurn || !currentPlayer || currentPlayer.isBlind) return false;
    let prevIdx = (gameState.currentTurn - 1 + gameState.players.length) % gameState.players.length;
    while (gameState.players[prevIdx].isFolded) prevIdx = (prevIdx - 1 + gameState.players.length) % gameState.players.length;
    return !gameState.players[prevIdx].isBlind;
  }, [gameState, isMyTurn, currentPlayer]);

  if (showSplash) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40"><img src={ASSETS.SPLASH_BG} className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-48 h-48 bg-red-600 rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] border-4 border-red-500/30 overflow-hidden">
          <img src={ASSETS.LOGO} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </motion.div>
        <h1 className="relative z-10 mt-8 text-4xl font-black text-white tracking-tighter">LUCIFER <span className="text-red-600">POKER</span></h1>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
          <h1 className="text-4xl font-black mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
          <div className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none focus:border-red-600" />
            <input type="text" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Room ID" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none focus:border-red-600" />
            <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-4 rounded-xl font-bold text-lg hover:bg-red-500 transition-all active:scale-95">Enter Underworld</button>
            <button onClick={toggleFullscreen} className="w-full bg-white/10 p-3 rounded-xl font-bold text-sm border border-white/10 text-white/60">Enable Fullscreen Mode</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
      <header className="absolute top-0 left-0 right-0 p-1 md:p-2 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-red-600 rounded-lg flex items-center justify-center overflow-hidden border border-red-500/30">
            <img src={ASSETS.LOGO} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col">
            <h2 className="font-black text-[10px] md:text-sm leading-tight text-white tracking-tighter">TEEN PATTI <span className="text-red-500">LUCIFER</span></h2>
            <p className="text-[6px] md:text-[8px] text-white/40 font-bold uppercase tracking-widest">Table: {roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          <div className="flex items-center gap-1 md:gap-1.5">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[7px] md:text-[9px] font-bold text-white/30 uppercase tracking-widest">{isConnected ? 'Online' : 'Offline'}</span>
          </div>
          {!isConnected && <button onClick={() => socket?.connect()} className="px-1.5 py-0.5 bg-red-600/20 rounded text-[7px] md:text-[9px] font-bold uppercase border border-red-500/30">Retry</button>}
          <button onClick={toggleFullscreen} className="p-1 md:p-1.5 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 flex items-center justify-center">
            <Play className="w-3 h-3 md:w-4 md:h-4 text-white rotate-[-90deg]" />
          </button>
          <button onClick={() => window.location.reload()} className="p-1 md:p-1.5 hover:bg-white/10 rounded-full transition-colors"><LogOut className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/60" /></button>
        </div>
      </header>

      <main className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
        <div className="relative w-full h-full bg-emerald-950 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0"><img src={ASSETS.TABLE_BG} className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" /></div>
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
            <div className="w-16 h-16 md:w-32 md:h-32"><img src={ASSETS.DEALER} className="w-full h-full object-contain" referrerPolicy="no-referrer" /></div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 -mt-2"><span className="text-[8px] md:text-xs font-black text-white/80 uppercase tracking-widest">Dealer</span></div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 w-full">
            {!gameState?.gameStarted && !gameState?.winner && <button onClick={startGame} className="mb-4 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-sm md:text-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse">START GAME</button>}
            <div className="bg-zinc-950/90 backdrop-blur-2xl border border-red-500/40 px-3 md:px-8 py-1.5 md:py-4 rounded-xl md:rounded-[32px] shadow-2xl flex flex-col items-center min-w-[100px] md:min-w-[180px]">
              <span className="text-[5px] md:text-[9px] font-black uppercase tracking-[0.3em] text-red-500/80 mb-0.5">Total Pot</span>
              <div className="flex items-center gap-1 md:gap-2 text-base md:text-3xl font-black text-white"><Coins className="w-3 h-3 md:w-7 md:h-7 text-yellow-500" />{gameState?.pot.toLocaleString() || 0}</div>
              <div className="mt-0.5 text-[5px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest">Bet: {gameState?.lastBet.toLocaleString() || 0} • Round: {gameState?.roundCount || 0}/5</div>
            </div>
            {gameState?.winner && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 bg-yellow-500 text-black px-4 py-1.5 rounded-full font-black text-[10px] md:text-xs uppercase border-2 border-yellow-300">🏆 {gameState.winner} Wins!</motion.div>}
          </div>

          {rotatedPlayers.map((player, idx) => {
            const originalIdx = gameState?.players.findIndex(p => p.id === player.id);
            const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
            const isMobile = window.innerWidth < 768;
            const radiusX = isMobile ? 40 : 36;
            const radiusY = isMobile ? 32 : 30;
            const x = Math.cos(angle) * radiusX;
            const y = Math.sin(angle) * radiusY;
            const isCurrent = gameState?.currentTurn === originalIdx;
            const isMe = player.name === name;
            const isTopHalf = y < -5; 

            return (
              <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-3 z-30">
                {!isTopHalf && <div className="flex -space-x-5 md:-space-x-8 mb-1 scale-[0.9] md:scale-[1.0] origin-bottom">{player.hand.map((card, cIdx) => <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />)}</div>}
                <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-40' : ''} scale-[0.9] md:scale-[1.0]`}>
                  <div className={`w-8 h-8 md:w-14 md:h-14 rounded-lg md:rounded-2xl border-2 flex items-center justify-center transition-all duration-500 relative ${isCurrent ? 'border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-110 bg-red-500/30' : 'border-white/10 bg-black/60'}`}>
                    <UserIcon className={`w-4 h-4 md:w-8 md:h-8 ${isCurrent ? 'text-red-400' : 'text-white/40'}`} />
                    {isMe && <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[5px] md:text-[8px] font-black px-1 rounded-sm z-10">VIP</div>}
                  </div>
                  <div className="mt-1 bg-black/90 backdrop-blur-xl px-2 md:px-5 py-1 rounded-full border border-white/10 flex flex-col items-center min-w-[50px] md:min-w-[120px] shadow-2xl">
                    <span className="text-[5px] md:text-xs font-black truncate max-w-[40px] md:max-w-[100px] text-white/90">{player.name} {isMe && "(You)"}</span>
                    <div className="flex items-center gap-1 text-[6px] md:text-xs font-black text-yellow-500"><Coins className="w-2 h-2 md:w-4 md:h-4" />{player.chips === -1 ? "???" : player.chips.toLocaleString()}</div>
                  </div>
                </div>
                {isTopHalf && <div className="flex -space-x-5 md:-space-x-8 mt-1 scale-[0.9] md:scale-[1.0] origin-top">{player.hand.map((card, cIdx) => <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />)}</div>}
              </motion.div>
            );
          })}
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-2 md:p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-40">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-end justify-between gap-2 md:gap-4">
          {/* Balance & Bet Info */}
          <div className="flex items-center gap-2 md:gap-4 bg-black/40 backdrop-blur-xl p-1.5 md:p-2.5 rounded-xl border border-white/5 w-full md:w-auto justify-center md:justify-start">
            <div className="flex flex-col"><span className="text-[5px] md:text-[8px] font-black text-white/30 uppercase">Balance</span><div className="flex items-center gap-1"><Coins className="w-3 h-3 md:w-5 md:h-5 text-yellow-500" /><span className="text-[10px] md:text-xl font-black text-white">{currentPlayer?.chips.toLocaleString() || 0}</span></div></div>
            <div className="h-5 md:h-8 w-px bg-white/10"></div>
            <div className="flex flex-col"><span className="text-[5px] md:text-[8px] font-black text-white/30 uppercase">Current Bet</span><div className="flex items-center gap-1"><Hand className="w-3 h-3 md:w-5 md:h-5 text-red-500" /><span className="text-[10px] md:text-xl font-black text-white">{gameState?.lastBet.toLocaleString() || 0}</span></div></div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 md:gap-2 w-full md:w-auto justify-center md:justify-end overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {isMyTurn && gameState?.gameStarted && !gameState.winner && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1 md:gap-2">
                <button onClick={() => takeAction('fold')} className="bg-zinc-900/90 border border-white/10 text-white font-black px-2 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-[8px] md:text-xs uppercase tracking-widest hover:bg-zinc-800">Fold</button>
                {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-zinc-900/90 border border-white/10 text-white font-black px-2 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl flex items-center gap-1 text-[8px] md:text-xs uppercase tracking-widest hover:bg-zinc-800"><Eye className="w-3 h-3 md:w-5 md:h-5 text-red-500" />See</button>}
                {canSideShow && <button onClick={handleSideShow} className="bg-zinc-900/90 border border-white/10 text-white font-black px-2 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-[8px] md:text-xs uppercase tracking-widest hover:bg-zinc-800">Side</button>}
                {canShow && <button onClick={() => takeAction('show')} className="bg-emerald-600 border border-emerald-500 text-white font-black px-2 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-[8px] md:text-xs uppercase tracking-widest hover:bg-emerald-500">Show</button>}
                <div className="flex items-stretch gap-0.5 shadow-2xl">
                  <button onClick={() => takeAction('chaal')} className="bg-red-600 text-white font-black px-3 md:px-8 py-2 md:py-3 rounded-l-lg md:rounded-l-xl shadow-[0_0_20px_rgba(220,38,38,0.4)] flex flex-col items-center justify-center uppercase tracking-widest min-w-[70px] md:min-w-[120px] hover:bg-red-500">
                    <span className="text-[5px] md:text-[9px] font-black text-white/60 leading-none mb-0.5">CHAAL</span>
                    <span className="text-[10px] md:text-lg leading-none">{(currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)?.toLocaleString()}</span>
                  </button>
                  <button onClick={handleRaise} className="bg-red-700 text-white font-black px-3 md:px-5 rounded-r-lg md:rounded-r-xl border-l border-red-500/30 text-lg md:text-2xl hover:bg-red-600 flex items-center justify-center">+</button>
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
              <h3 className="text-xl md:text-2xl font-black mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-xs md:text-base text-white/60 mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands with you.</p>
              <div className="flex gap-4"><button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 p-2 md:p-4 rounded-xl font-bold uppercase text-[10px] md:text-sm">Deny</button><button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 p-2 md:p-4 rounded-xl font-bold uppercase text-[10px] md:text-sm">Accept</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
