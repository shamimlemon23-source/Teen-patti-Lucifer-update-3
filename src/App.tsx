import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Coins, 
  Eye, 
  LogOut, 
  User,
  Maximize2,
  Minimize2,
  Clock,
  ShieldCheck,
  Plus,
  Minus
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Assets ---
const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
};

// --- Types ---
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
interface Card { suit: Suit; rank: Rank; }
interface Player { id: string; name: string; chips: number; hand: Card[]; isFolded: boolean; isBlind: boolean; currentBet: number; isBot?: boolean; }
interface GameState { players: Player[]; pot: number; currentTurn: number; lastBet: number; gameStarted: boolean; winner: string | null; roundCount: number; turnTimeLeft: number; }

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS: Record<Suit, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-900', spades: 'text-slate-900' };

const CardComponent = ({ card, hidden, index }: { card: Card, hidden: boolean, index: number }) => {
  const tilt = (index - 1) * 15;
  return (
    <motion.div
      initial={{ scale: 0, y: 20, rotate: 0, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }}
      className={`relative w-10 h-14 md:w-16 md:h-24 rounded-lg shadow-xl border-2 flex flex-col items-center justify-center transition-all ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black rounded-lg border border-red-500/30">
          <div className="text-red-500 font-black text-lg">L</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-0.5 left-0.5 font-black text-[10px] md:text-lg ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-lg md:text-3xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-0.5 right-0.5 font-black text-[10px] md:text-lg rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('100000000');
  const [showSplash, setShowSplash] = useState(true);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(100000);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
      if (state.winner) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    });
    newSocket.on('adminStats', (stats) => setAdminStats(stats));
    newSocket.on('sideShowPrompt', (data) => setSideShowPrompt(data));
    return () => { newSocket.close(); };
  }, []);

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

  const currentPlayer = gameState?.players.find(p => p.id === socket?.id);
  const isMyTurn = gameState?.players[gameState.currentTurn]?.id === socket?.id;

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center text-white">
        <motion.img initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={ASSETS.LOGO} className="w-48 h-48 mb-8" />
        <h1 className="text-4xl font-black tracking-widest text-red-600">LUCIFER TEEN PATTI</h1>
        <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 2, repeat: Infinity }} className="w-full h-full bg-red-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#2a0a3d] text-white font-sans overflow-hidden select-none">
      {!joined ? (
        <div className="h-full flex items-center justify-center p-4 bg-[url('https://i.imgur.com/Gg4BaeV.png')] bg-cover bg-center">
          <div className="w-full max-w-md bg-black/80 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
            <img src={ASSETS.LOGO} className="w-24 h-24 mx-auto mb-6" />
            <h1 className="text-3xl font-black text-center mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
            <div className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter Name" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-red-600" />
              <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none appearance-none text-white font-bold">
                {[...Array(10)].map((_, i) => <option key={i} value={`table-${i + 1}`} className="bg-zinc-900">Table {i + 1}</option>)}
              </select>
              <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl hover:bg-red-700 transition-all">JOIN TABLE</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col relative">
          {/* Background Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black z-0" />

          {/* Header */}
          <header className="relative z-50 p-4 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-3">
              <img src={ASSETS.LOGO} className="w-10 h-10" />
              <span className="font-black text-sm md:text-xl">LUCIFER <span className="text-red-600">TEEN PATTI</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleFullscreen} className="p-2 bg-white/5 rounded-xl">
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              {name === 'LUCIFER_DEV_777' && (
                <button onClick={() => {
                  const pass = prompt("Admin Pass:");
                  if (pass === "LUCIFER_PASS_999") {
                    setAdminPassword(pass);
                    setShowAdminPanel(true);
                    socket?.emit('getAdminStats', { adminName: name, adminPassword: pass });
                  }
                }} className="p-2 bg-red-600 rounded-xl"><ShieldCheck className="w-5 h-5" /></button>
              )}
              <button onClick={() => window.location.reload()} className="p-2 bg-red-600/20 rounded-xl"><LogOut className="w-5 h-5 text-red-500" /></button>
            </div>
          </header>

          {/* Game Table Area */}
          <main className="flex-1 relative z-10">
            {/* Dealer */}
            <div className="absolute top-[5%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
              <img src={ASSETS.DEALER} className="w-24 md:w-44 drop-shadow-2xl" />
            </div>

            {/* Table Surface */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[60%] bg-[#0b4d2c] rounded-[200px] border-[12px] border-[#3d2b1f] shadow-[inset_0_0_100px_rgba(0,0,0,0.5),0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center">
               {/* Pot */}
               <div className="text-center">
                <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full mb-2">
                  <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Total Pot</span>
                  <div className="text-xl md:text-3xl font-black flex items-center justify-center gap-2">
                    <Coins className="w-4 h-4 md:w-6 md:h-6 text-yellow-500" />
                    {gameState?.pot.toLocaleString() || 0}
                  </div>
                </div>
                {gameState?.winner && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-xs uppercase shadow-lg">
                    🏆 {gameState.winner} WINS!
                  </motion.div>
                )}
              </div>
            </div>

            {/* Players Positioning (5 Player Layout) */}
            {rotatedPlayers.map((player, idx) => {
              const isMe = player.id === socket?.id;
              const isCurrentTurn = gameState?.currentTurn === gameState?.players.findIndex(p => p.id === player.id);
              
              // Positions for 5 players around the ellipse
              const positions = [
                { x: 0, y: 38 },   // Bottom Center (Me)
                { x: -42, y: 10 }, // Mid Left
                { x: -30, y: -30 },// Top Left
                { x: 30, y: -30 }, // Top Right
                { x: 42, y: 10 },  // Mid Right
              ];

              const pos = positions[idx % positions.length];

              return (
                <motion.div 
                  key={player.id} 
                  style={{ left: `${50 + pos.x}%`, top: `${50 + pos.y}%` }} 
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-40"
                >
                  {/* Cards */}
                  <div className={`flex -space-x-6 mb-2 transition-all ${isMe ? 'scale-110' : 'scale-75'}`}>
                    {player.hand.map((card, cIdx) => (
                      <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />
                    ))}
                  </div>

                  {/* Player Info Box */}
                  <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-40' : ''}`}>
                    {/* Avatar Circle */}
                    <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all ${isCurrentTurn ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-110' : 'border-zinc-700 bg-zinc-800'}`}>
                      <User className={`w-8 h-8 md:w-12 md:h-12 ${isCurrentTurn ? 'text-yellow-400' : 'text-white/20'}`} />
                      
                      {/* Turn Timer */}
                      {isCurrentTurn && gameState?.gameStarted && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-lg font-black text-yellow-400">{gameState.turnTimeLeft}</span>
                        </div>
                      )}
                    </div>

                    {/* Name & Chips */}
                    <div className="mt-1 bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-center min-w-[80px]">
                      <div className="text-[10px] font-bold truncate max-w-[70px]">{player.name}</div>
                      <div className="text-yellow-500 font-black text-[10px]">{player.chips.toLocaleString()}</div>
                    </div>

                    {/* Status Badges */}
                    {player.isFolded && <div className="absolute top-0 bg-red-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Folded</div>}
                    {player.isBlind && !player.isFolded && <div className="absolute -top-2 bg-blue-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Blind</div>}
                  </div>
                </motion.div>
              );
            })}
          </main>

          {/* Footer Controls */}
          <footer className="relative z-50 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              {/* My Balance */}
              <div className="flex items-center gap-4 bg-black/40 p-3 rounded-2xl border border-white/5">
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black text-lg">L</div>
                <div>
                  <div className="text-[8px] text-white/40 uppercase font-black tracking-widest">My Balance</div>
                  <div className="text-xl font-black text-yellow-500">{currentPlayer?.chips.toLocaleString() || 0}</div>
                </div>
              </div>

              {/* Action Buttons */}
              {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                <div className="flex flex-wrap justify-center gap-2">
                  <button onClick={() => takeAction('fold')} className="bg-zinc-800 px-5 py-3 rounded-xl font-black text-xs uppercase hover:bg-zinc-700 border-b-4 border-zinc-950">Fold</button>
                  {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-blue-600 px-5 py-3 rounded-xl font-black text-xs uppercase hover:bg-blue-700 border-b-4 border-blue-800">See</button>}
                  
                  {/* Chaal & Raise Group */}
                  <div className="flex items-center bg-red-600 rounded-xl border-b-4 border-red-800 overflow-hidden">
                    <button onClick={() => takeAction('chaal')} className="px-8 py-3 font-black text-xs uppercase hover:bg-red-500 border-r border-red-400/20">
                      Chaal: {(currentPlayer?.isBlind ? gameState?.lastBet : gameState?.lastBet * 2)?.toLocaleString()}
                    </button>
                    <button onClick={() => setRaiseAmount(prev => Math.max(100000, prev - 100000))} className="p-3 hover:bg-red-500"><Minus className="w-4 h-4" /></button>
                    <div className="px-2 font-bold text-xs">{raiseAmount / 1000000}M</div>
                    <button onClick={() => setRaiseAmount(prev => prev + 100000)} className="p-3 hover:bg-red-500"><Plus className="w-4 h-4" /></button>
                    <button onClick={() => takeAction('raise', raiseAmount)} className="bg-yellow-500 text-black px-4 py-3 font-black text-xs uppercase hover:bg-yellow-400">Raise</button>
                  </div>

                  <button onClick={handleSideShow} className="bg-zinc-800 px-5 py-3 rounded-xl font-black text-xs uppercase hover:bg-zinc-700 border-b-4 border-zinc-950">Side Show</button>
                </div>
              )}

              <div className="text-center md:text-right">
                <a href="https://facebook.com/luciferdev" target="_blank" className="text-[8px] font-black text-white/20 hover:text-red-500 transition-all uppercase tracking-widest">Developed by LUCIFER DEV</a>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Side Show Modal */}
      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 p-8 rounded-[3rem] border border-white/10 text-center max-w-sm w-full">
              <h2 className="text-2xl font-black mb-2">SIDE SHOW</h2>
              <p className="text-white/60 mb-8 font-medium"><b>{sideShowPrompt.fromName}</b> is requesting a side show.</p>
              <div className="flex gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 p-4 rounded-2xl font-bold">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 p-4 rounded-2xl font-bold">Accept</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 p-4">
            <div className="w-full max-w-4xl bg-zinc-900 rounded-[3rem] border border-white/10 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase">Lucifer Admin Panel</h2>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-white/5 rounded-full"><LogOut className="w-6 h-6" /></button>
              </div>
              
              <div className="p-8 border-b border-white/5 bg-white/5">
                <div className="flex flex-wrap gap-4">
                  <input type="text" placeholder="Player Name" value={manualName} onChange={e => setManualName(e.target.value)} className="flex-1 bg-black p-4 rounded-2xl border border-white/10 outline-none" />
                  <input type="number" placeholder="Amount" value={manualAmount} onChange={e => setManualAmount(e.target.value)} className="flex-1 bg-black p-4 rounded-2xl border border-white/10 outline-none" />
                  <button onClick={() => {
                    socket?.emit('addPlayerChips', { adminName: name, adminPassword, targetName: manualName, amount: manualAmount });
                    alert("Chips Added!");
                  }} className="bg-red-600 px-8 py-4 rounded-2xl font-black">ADD CHIPS</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {adminStats.map((stat, i) => (
                  <div key={i} className="flex justify-between items-center p-5 bg-white/5 rounded-[2rem]">
                    <span className="font-black text-lg">{stat.name}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-yellow-500 font-black text-xl">{Number(stat.chips).toLocaleString()}</span>
                      <button onClick={() => socket?.emit('addPlayerChips', { adminName: name, adminPassword, targetName: stat.name, amount: 100000000 })} className="bg-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase">Add 100M</button>
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
