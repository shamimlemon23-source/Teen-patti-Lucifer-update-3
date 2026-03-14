import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Eye, LogOut, User, Plus, Settings, Maximize2, Minimize2 } from 'lucide-react';
import confetti from 'canvas-confetti';

const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
};

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'
};

const CardComponent = ({ card, hidden, index }: { card: any, hidden: boolean, index: number }) => {
  const tilt = (index - 1) * 10;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  
  return (
    <motion.div 
      initial={{ scale: 0, y: -20, opacity: 0 }} 
      animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }} 
      className={`relative w-12 h-16 md:w-20 md:h-28 rounded-lg shadow-2xl border-2 flex flex-col items-center justify-center ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black rounded-lg border border-red-500/30 font-black text-red-500 text-xl">L</div>
      ) : (
        <div className={`flex flex-col items-center ${isRed ? 'text-red-600' : 'text-black'}`}>
          <span className="text-sm md:text-xl font-bold leading-none">{card.rank}</span>
          <span className="text-lg md:text-3xl leading-none">{SUIT_SYMBOLS[card.suit] || card.suit[0].toUpperCase()}</span>
        </div>
      )}
    </motion.div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('table-1');
  const [joined, setJoined] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => { setTimeout(() => setShowSplash(false), 3000); }, []);

  useEffect(() => {
    const newSocket = io(); setSocket(newSocket);
    newSocket.on('gameState', (state) => { 
      setGameState(state); 
      if (state.winner) confetti({ particleCount: 150, spread: 70 }); 
    });
    newSocket.on('adminStats', (stats) => setAdminStats(stats));
    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (gameState?.turnStartTime && gameState?.turnDuration) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - gameState.turnStartTime;
        const remaining = Math.max(0, Math.ceil((gameState.turnDuration - elapsed) / 1000));
        if (remaining > 20) setTimeLeft(20); // Cap to 20 if sync issue
        else setTimeLeft(remaining);
      }, 200);
      return () => clearInterval(interval);
    } else setTimeLeft(null);
  }, [gameState?.turnStartTime, gameState?.currentTurn]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });

  const rotatedPlayers = useMemo(() => {
    if (!gameState) return [];
    const players = [...gameState.players];
    const myIndex = players.findIndex(p => p.id === socket?.id);
    if (myIndex === -1) return players;
    const rotated = [];
    for (let i = 0; i < players.length; i++) rotated.push(players[(myIndex + i) % players.length]);
    return rotated;
  }, [gameState, socket]);

  const currentPlayer = gameState?.players.find((p: any) => p.id === socket?.id);
  const isMyTurn = gameState?.players[gameState.currentTurn]?.id === socket?.id;
  const activeCount = gameState?.players.filter((p: any) => !p.isFolded).length || 0;
  const canShow = isMyTurn && gameState?.gameStarted && !gameState.winner && activeCount === 2;

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount:", "100000");
    if (amount && !isNaN(parseInt(amount))) takeAction('raise', parseInt(amount));
  };

  if (showSplash) return <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white"><img src={ASSETS.LOGO} className="w-48 h-48 mb-8" /><h1 className="text-4xl font-black text-red-600">LUCIFER TEEN PATTI</h1></div>;

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden select-none">
      {!joined ? (
        <div className="h-full flex items-center justify-center bg-[url('https://i.imgur.com/Gg4BaeV.png')] bg-cover bg-center p-4">
          <div className="w-full max-w-md bg-black/80 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl text-center">
            <img src={ASSETS.LOGO} className="w-24 h-24 mx-auto mb-6" />
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter Name" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 mb-4" />
            <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 mb-4">
              {[...Array(10)].map((_, i) => <option key={i} value={`table-${i + 1}`} className="bg-zinc-900">Table {i + 1}</option>)}
            </select>
            <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl">JOIN TABLE</button>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col relative">
          <header className="p-2 md:p-4 flex justify-between items-center bg-black/40 backdrop-blur-md z-50">
            <div className="flex items-center gap-2"><img src={ASSETS.LOGO} className="w-8 h-8 md:w-10 md:h-10" /><span className="font-black text-xs md:text-base">LUCIFER <span className="text-red-600">POKER</span></span></div>
            <div className="flex gap-2">
              <button onClick={toggleFullscreen} className="p-2 bg-white/5 rounded-xl">{isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
              <button onClick={() => { const pass = prompt("Admin Pass:"); if (pass === "LUCIFER_PASS_999") setShowAdminPanel(true); }} className="p-2 bg-red-600 rounded-xl"><Trophy className="w-4 h-4" /></button>
              <button onClick={() => window.location.reload()} className="p-2 bg-white/5 rounded-xl"><LogOut className="w-4 h-4" /></button>
            </div>
          </header>

          <main className="flex-1 relative overflow-hidden">
            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 z-10"><img src={ASSETS.DEALER} className="w-20 md:w-40" /></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[98%] h-[65%] md:w-[85%] md:h-[65%] bg-[#0b4d2c] rounded-[100px] md:rounded-[200px] border-[8px] md:border-[15px] border-[#3d2b1f] shadow-2xl flex items-center justify-center">
              <div className="text-center z-20">
                <div className="bg-black/40 px-4 py-1 rounded-full mb-1"><span className="text-yellow-500 font-black text-xs md:text-base">POT: {gameState?.pot.toLocaleString()}</span></div>
                {gameState?.winner && <div className="bg-yellow-500 text-black px-4 py-1 rounded-full font-black uppercase text-xs md:text-sm">🏆 {gameState.winner} WINS!</div>}
              </div>
            </div>

            {rotatedPlayers.map((player: any, idx) => {
              const isPortrait = window.innerHeight > window.innerWidth;
              const rX = isPortrait ? 42 : 44; const rY = isPortrait ? 44 : 40;
              const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
              const x = Math.cos(angle) * rX; const y = Math.sin(angle) * rY;
              const isCurrent = gameState?.currentTurn === gameState?.players.findIndex((p: any) => p.id === player.id);
              return (
                <div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30">
                  <div className="flex -space-x-5 mb-1 scale-90 md:scale-100">{player.hand.map((card: any, cIdx: number) => <CardComponent key={cIdx} card={card} hidden={player.id === socket?.id ? player.isBlind : !gameState?.winner} index={cIdx} />)}</div>
                  <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full border-2 md:border-4 ${isCurrent ? 'border-red-500 shadow-[0_0_20px_red]' : 'border-zinc-700'} overflow-hidden bg-zinc-800 flex items-center justify-center`}><User className="w-8 h-8 md:w-10 md:h-10 text-white/20" /></div>
                  <div className="bg-black/80 px-2 py-0.5 rounded-lg border border-white/10 text-center mt-1 min-w-[70px]"><div className="text-[10px] md:text-[12px] font-bold truncate max-w-[60px] md:max-w-none">{player.name}</div><div className="text-yellow-500 font-black text-[10px] md:text-[12px]">{player.chips.toLocaleString()}</div></div>
                </div>
              );
            })}
          </main>

          <footer className="p-2 md:p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-50">
            <div className="max-w-6xl mx-auto flex flex-col items-center gap-3">
              <div className="flex justify-between w-full items-center px-4">
                <div className="bg-black/60 p-2 rounded-xl border border-white/10 flex flex-col"><span className="text-[8px] text-white/40 uppercase font-black">Balance</span><span className="text-sm md:text-2xl font-black text-yellow-500 tracking-tighter">{currentPlayer?.chips.toLocaleString()}</span></div>
                {timeLeft !== null && isMyTurn && <div className="flex flex-col items-end"><span className="text-[8px] text-red-500 uppercase font-black">Turn Timer</span><span className={`text-sm md:text-2xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}s</span></div>}
              </div>
              {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                <div className="flex gap-2 md:gap-4 w-full justify-center flex-wrap">
                  <button onClick={() => takeAction('fold')} className="bg-zinc-900 border border-white/10 px-4 md:px-8 py-3 md:py-4 rounded-xl font-black uppercase text-[10px] md:text-sm tracking-widest">Fold</button>
                  {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-zinc-900 border border-white/10 px-4 md:px-8 py-3 md:py-4 rounded-xl font-black uppercase text-[10px] md:text-sm tracking-widest flex items-center gap-2"><Eye className="w-4 h-4 text-red-500" /> See</button>}
                  <div className="flex items-stretch bg-red-600 rounded-xl overflow-hidden shadow-2xl">
                    <button onClick={() => takeAction('chaal')} className="px-6 md:px-12 py-3 md:py-4 font-black uppercase text-[10px] md:text-sm tracking-widest border-r border-red-400/20">
                      <div className="flex flex-col">
                        <span className="text-[8px] opacity-60">CHAAL</span>
                        <span>{(currentPlayer?.isBlind ? gameState?.lastBet : gameState?.lastBet * 2).toLocaleString()}</span>
                      </div>
                    </button>
                    <button onClick={() => takeAction('raise', 100000)} className="px-3 md:px-6 bg-red-700 hover:bg-red-800 transition-colors"><Plus className="w-5 h-5" /></button>
                    <button onClick={handleRaise} className="px-3 md:px-6 bg-red-800 hover:bg-red-900 transition-colors"><Settings className="w-5 h-5" /></button>
                  </div>
                  {canShow && <button onClick={() => takeAction('show')} className="bg-emerald-600 px-6 md:px-12 py-3 md:py-4 rounded-xl font-black uppercase text-[10px] md:text-sm tracking-widest border-b-4 border-emerald-800">Show</button>}
                </div>
              )}
            </div>
          </footer>
        </div>
      )}

      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-800/50">
                <h2 className="font-black uppercase tracking-widest">Admin Dashboard</h2>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><LogOut className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {adminStats.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="font-bold text-sm">{s.name}</span>
                    <div className="flex gap-3 items-center">
                      <span className="text-yellow-500 font-black text-sm">{Number(s.chips).toLocaleString()}</span>
                      <button onClick={() => socket?.emit('addPlayerChips', { adminName: 'LUCIFER_DEV_777', adminPassword: 'LUCIFER_PASS_999', targetName: s.name, amount: '10000000' })} className="bg-green-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-500">Add 10M</button>
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
