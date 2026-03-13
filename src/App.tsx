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
  const tilt = (index - 1) * 10;
  return (
    <motion.div initial={{ scale: 0, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }} className={`relative w-10 h-14 md:w-16 md:h-24 rounded-lg shadow-xl border-2 flex flex-col items-center justify-center ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}>
      {hidden ? <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black rounded-lg border border-red-500/30 font-black text-red-500">L</div> : <div className="text-black font-bold">{card.rank}{card.suit[0].toUpperCase()}</div>}
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => { setTimeout(() => setShowSplash(false), 3000); }, []);

  useEffect(() => {
    const newSocket = io(); setSocket(newSocket);
    newSocket.on('gameState', (state) => { setGameState(state); if (state.winner) confetti({ particleCount: 150, spread: 70 }); });
    newSocket.on('adminStats', (stats) => setAdminStats(stats));
    return () => { newSocket.close(); };
  }, []);

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
  const activePlayersCount = useMemo(() => gameState?.players.filter((p: any) => !p.isFolded).length || 0, [gameState]);
  const canShow = isMyTurn && gameState?.gameStarted && !gameState.winner && activePlayersCount === 2;

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount (Unlimited):", "1000000");
    if (amount && !isNaN(parseInt(amount))) takeAction('raise', parseInt(amount));
  };

  if (showSplash) return <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white"><img src={ASSETS.LOGO} className="w-48 h-48 mb-8" /><h1 className="text-4xl font-black text-red-600">LUCIFER TEEN PATTI</h1></div>;

  return (
    <div className="fixed inset-0 bg-[#1a0524] text-white font-sans overflow-hidden select-none">
      {!joined ? (
        <div className="h-full flex items-center justify-center bg-[url('https://i.imgur.com/Gg4BaeV.png')] bg-cover bg-center">
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
          <header className="p-4 flex justify-between items-center bg-black/40 backdrop-blur-md z-50">
            <div className="flex items-center gap-3"><img src={ASSETS.LOGO} className="w-10 h-10" /><span className="font-black">LUCIFER <span className="text-red-600">POKER</span></span></div>
            <div className="flex gap-2">
              <button onClick={() => { const pass = prompt("Admin Pass:"); if (pass === "LUCIFER_PASS_999") setShowAdminPanel(true); }} className="p-2 bg-red-600 rounded-xl"><Trophy className="w-5 h-5" /></button>
              <button onClick={() => window.location.reload()} className="p-2 bg-white/5 rounded-xl"><LogOut className="w-5 h-5" /></button>
            </div>
          </header>

          <main className="flex-1 relative">
            <div className="absolute top-[5%] left-1/2 -translate-x-1/2"><img src={ASSETS.DEALER} className="w-24 md:w-44" /></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[65%] bg-[#0b4d2c] rounded-[200px] border-[12px] border-[#3d2b1f] shadow-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="bg-black/40 px-6 py-2 rounded-full mb-2"><span className="text-yellow-500 font-black">POT: {gameState?.pot.toLocaleString()}</span></div>
                {gameState?.winner && <div className="bg-yellow-500 text-black px-4 py-1 rounded-full font-black uppercase">🏆 {gameState.winner} WINS!</div>}
              </div>
            </div>

            {rotatedPlayers.map((player: any, idx) => {
              const positions = [{ x: 0, y: 38 }, { x: -42, y: 10 }, { x: -30, y: -30 }, { x: 30, y: -30 }, { x: 42, y: 10 }];
              const pos = positions[idx % positions.length];
              const isCurrent = gameState?.currentTurn === gameState?.players.findIndex((p: any) => p.id === player.id);
              return (
                <div key={player.id} style={{ left: `${50 + pos.x}%`, top: `${50 + pos.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="flex -space-x-4 mb-2">{player.hand.map((card: any, cIdx: number) => <CardComponent key={cIdx} card={card} hidden={player.id === socket?.id ? player.isBlind : !gameState?.winner} index={cIdx} />)}</div>
                  <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full border-4 ${isCurrent ? 'border-yellow-400 scale-110' : 'border-zinc-700'} overflow-hidden bg-zinc-800 flex items-center justify-center`}><User className="w-8 h-8 text-white/20" /></div>
                  <div className="bg-black/80 px-3 py-1 rounded-lg border border-white/10 text-center mt-1"><div className="text-[10px] font-bold">{player.name}</div><div className="text-yellow-500 font-black text-[10px]">{player.chips.toLocaleString()}</div></div>
                </div>
              );
            })}
          </main>

          <footer className="p-4 bg-black/80 z-50">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10"><div className="text-[8px] text-white/40 uppercase">My Balance</div><div className="text-xl font-black text-yellow-500">{currentPlayer?.chips.toLocaleString()}</div></div>
              {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                <div className="flex gap-2">
                  <button onClick={() => takeAction('fold')} className="bg-zinc-800 px-6 py-3 rounded-xl font-black uppercase">Fold</button>
                  {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-blue-600 px-6 py-3 rounded-xl font-black uppercase">See</button>}
                  <div className="flex items-center bg-red-600 rounded-xl overflow-hidden">
                    <button onClick={() => takeAction('chaal')} className="px-8 py-3 font-black uppercase">Chaal: {(currentPlayer?.isBlind ? gameState?.lastBet : gameState?.lastBet * 2).toLocaleString()}</button>
                    <button onClick={() => takeAction('raise', 100000)} className="p-3 bg-red-700"><Plus className="w-5 h-5" /></button>
                    <button onClick={handleRaise} className="p-3 bg-red-800"><Settings className="w-5 h-5" /></button>
                  </div>
                  {canShow && <button onClick={() => takeAction('show')} className="bg-emerald-600 px-6 py-3 rounded-xl font-black uppercase border-b-4 border-emerald-800">Show</button>}
                </div>
              )}
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
