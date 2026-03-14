import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Eye, LogOut, User, Hash, Minimize2, Maximize2, ChevronRight, Settings, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';

const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
};

const CardComponent = ({ card, hidden, index }: { card: any, hidden: boolean, index: number }) => {
  const tilt = (index - 1) * 8;
  return (
    <motion.div initial={{ scale: 0, y: -20, opacity: 0 }} animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }} className={`relative w-10 h-14 md:w-20 md:h-28 rounded-lg shadow-xl border-2 flex flex-col items-center justify-center ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}>
      {hidden ? <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black rounded-lg border border-red-500/30 font-black text-red-500">L</div> : <div className="text-black font-bold text-sm md:text-xl">{card.rank}{card.suit[0].toUpperCase()}</div>}
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
    newSocket.on('gameState', (state) => { setGameState(state); if (state.winner) confetti({ particleCount: 150, spread: 70 }); });
    newSocket.on('adminStats', (stats) => setAdminStats(stats));
    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (gameState?.turnStartTime && gameState?.turnDuration) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - gameState.turnStartTime;
        const remaining = Math.max(0, Math.ceil((gameState.turnDuration - elapsed) / 1000));
        setTimeLeft(remaining);
      }, 500);
      return () => clearInterval(interval);
    } else setTimeLeft(null);
  }, [gameState?.turnStartTime, gameState?.currentTurn]);

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
              <button onClick={() => { const pass = prompt("Admin Pass:"); if (pass === "LUCIFER_PASS_999") setShowAdminPanel(true); }} className="p-2 bg-red-600 rounded-xl"><Trophy className="w-4 h-4" /></button>
              <button onClick={() => window.location.reload()} className="p-2 bg-white/5 rounded-xl"><LogOut className="w-4 h-4" /></button>
            </div>
          </header>

          <main className="flex-1 relative overflow-hidden">
            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 z-10"><img src={ASSETS.DEALER} className="w-20 md:w-40" /></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] h-[60%] md:w-[80%] md:h-[60%] bg-[#0b4d2c] rounded-[100px] md:rounded-[200px] border-[8px] md:border-[15px] border-[#3d2b1f] shadow-2xl flex items-center justify-center">
              <div className="text-center z-20">
                <div className="bg-black/40 px-4 py-1 rounded-full mb-1"><span className="text-yellow-500 font-black text-xs md:text-base">POT: {gameState?.pot.toLocaleString()}</span></div>
                {gameState?.winner && <div className="bg-yellow-500 text-black px-4 py-1 rounded-full font-black uppercase text-xs md:text-sm">🏆 {gameState.winner} WINS!</div>}
              </div>
            </div>

            {rotatedPlayers.map((player: any, idx) => {
              const isPortrait = window.innerHeight > window.innerWidth;
              const rX = isPortrait ? 40 : 42; const rY = isPortrait ? 42 : 38;
              const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
              const x = Math.cos(angle) * rX; const y = Math.sin(angle) * rY;
              const isCurrent = gameState?.currentTurn === gameState?.players.findIndex((p: any) => p.id === player.id);
              return (
                <div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30">
                  <div className="flex -space-x-4 mb-1 scale-75 md:scale-100">{player.hand.map((card: any, cIdx: number) => <CardComponent key={cIdx} card={card} hidden={player.id === socket?.id ? player.isBlind : !gameState?.winner} index={cIdx} />)}</div>
                  <div className={`w-12 h-12 md:w-20 md:h-20 rounded-full border-2 md:border-4 ${isCurrent ? 'border-red-500 shadow-[0_0_20px_red]' : 'border-zinc-700'} overflow-hidden bg-zinc-800 flex items-center justify-center`}><User className="w-6 h-6 md:w-10 md:h-10 text-white/20" /></div>
                  <div className="bg-black/80 px-2 py-0.5 rounded-lg border border-white/10 text-center mt-1 min-w-[60px]"><div className="text-[8px] md:text-[10px] font-bold truncate max-w-[50px] md:max-w-none">{player.name}</div><div className="text-yellow-500 font-black text-[8px] md:text-[10px]">{player.chips.toLocaleString()}</div></div>
                </div>
              );
            })}
          </main>

          <footer className="p-2 md:p-4 bg-black/80 z-50">
            <div className="max-w-6xl mx-auto flex flex-col items-center gap-2">
              <div className="flex justify-between w-full items-center px-2">
                <div className="bg-white/5 p-2 rounded-xl border border-white/10 flex flex-col"><span className="text-[7px] text-white/40 uppercase">Balance</span><span className="text-xs md:text-xl font-black text-yellow-500">{currentPlayer?.chips.toLocaleString()}</span></div>
                {timeLeft !== null && isMyTurn && <div className="flex flex-col items-end"><span className="text-[7px] text-red-500 uppercase">Time</span><span className={`text-xs md:text-xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}s</span></div>}
              </div>
              {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                <div className="flex gap-1.5 md:gap-3 w-full justify-center flex-wrap">
                  <button onClick={() => takeAction('fold')} className="bg-zinc-800 px-3 md:px-6 py-2 md:py-3 rounded-xl font-black uppercase text-[9px] md:text-xs">Fold</button>
                  {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-blue-600 px-3 md:px-6 py-2 md:py-3 rounded-xl font-black uppercase text-[9px] md:text-xs">See</button>}
                  <div className="flex items-center bg-red-600 rounded-xl overflow-hidden">
                    <button onClick={() => takeAction('chaal')} className="px-4 md:px-8 py-2 md:py-3 font-black uppercase text-[9px] md:text-xs">Chaal: {(currentPlayer?.isBlind ? gameState?.lastBet : gameState?.lastBet * 2).toLocaleString()}</button>
                    <button onClick={() => takeAction('raise', 100000)} className="p-2 md:p-3 bg-red-700"><Plus className="w-4 h-4" /></button>
                    <button onClick={handleRaise} className="p-2 md:p-3 bg-red-800"><Settings className="w-4 h-4" /></button>
                  </div>
                  {canShow && <button onClick={() => takeAction('show')} className="bg-emerald-600 px-4 md:px-8 py-2 md:py-3 rounded-xl font-black uppercase text-[9px] md:text-xs border-b-2 md:border-b-4 border-emerald-800">Show</button>}
                </div>
              )}
            </div>
          </footer>
        </div>
      )}

      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-800">
                <h2 className="font-black uppercase">Admin Dashboard</h2>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-white/5 rounded-full"><LogOut className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {adminStats.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <span className="font-bold text-xs">{s.name}</span>
                    <div className="flex gap-2 items-center">
                      <span className="text-yellow-500 font-black text-xs">{Number(s.chips).toLocaleString()}</span>
                      <button onClick={() => socket?.emit('addPlayerChips', { adminName: 'LUCIFER_DEV_777', adminPassword: 'LUCIFER_PASS_999', targetName: s.name, amount: '10000000' })} className="bg-green-600 p-1.5 rounded-lg text-[8px] font-black uppercase">Add 10M</button>
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
