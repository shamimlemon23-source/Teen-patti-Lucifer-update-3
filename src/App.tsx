import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Coins, 
  Eye, 
  LogOut, 
  User,
  Hash,
  Maximize2,
  Minimize2,
  ChevronRight,
  Clock,
  ShieldCheck
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
  const tilt = (index - 1) * 10;
  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }}
      className={`relative w-14 h-20 md:w-24 md:h-32 rounded-xl shadow-2xl border-2 flex flex-col items-center justify-center transition-all ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black rounded-xl border border-red-500/30">
          <div className="text-red-500 font-black text-xl drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">L</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-xs md:text-2xl ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-2xl md:text-6xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-1 right-1 font-black text-xs md:text-2xl rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
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
        <motion.img 
          initial={{ scale: 0.5, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          src={ASSETS.LOGO} className="w-48 h-48 mb-8" 
        />
        <h1 className="text-4xl font-black tracking-widest text-red-600">LUCIFER TEEN PATTI</h1>
        <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 2, repeat: Infinity }} className="w-full h-full bg-red-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white font-sans overflow-hidden select-none">
      {!joined ? (
        <div className="h-full flex items-center justify-center p-4 bg-[url('https://i.imgur.com/Gg4BaeV.png')] bg-cover bg-center">
          <div className="w-full max-w-md bg-black/80 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
            <img src={ASSETS.LOGO} className="w-24 h-24 mx-auto mb-6" />
            <h1 className="text-3xl font-black text-center mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
            <div className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter Name" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-red-600" />
              <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none appearance-none font-bold">
                {[...Array(10)].map((_, i) => <option key={i} value={`table-${i + 1}`} className="bg-zinc-900">Table {i + 1}</option>)}
              </select>
              <button onClick={joinRoom} disabled={!name} className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl hover:bg-red-700 transition-all">JOIN TABLE</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col bg-[url('https://i.imgur.com/Wupafhm.png')] bg-cover bg-center">
          {/* Header */}
          <header className="p-4 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5">
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
          <main className="flex-1 relative">
            {/* Dealer */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
              <img src={ASSETS.DEALER} className="w-20 md:w-32 drop-shadow-2xl" />
              <div className="bg-black/60 px-4 py-1 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest">Dealer</div>
            </div>

            {/* Pot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center">
              <div className="bg-zinc-950/90 border-2 border-red-600/40 px-8 py-4 rounded-[2.5rem] shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                <span className="text-[10px] font-black uppercase text-red-500 tracking-tighter">Total Pot</span>
                <div className="text-3xl md:text-5xl font-black flex items-center justify-center gap-2">
                  <Coins className="w-6 h-6 md:w-10 md:h-10 text-yellow-500" />
                  {gameState?.pot.toLocaleString() || 0}
                </div>
              </div>
              {gameState?.winner && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 bg-yellow-500 text-black px-6 py-2 rounded-full font-black text-sm uppercase">
                  🏆 {gameState.winner} WINS!
                </motion.div>
              )}
            </div>

            {/* Players */}
            {rotatedPlayers.map((player, idx) => {
              const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
              const x = Math.cos(angle) * 40;
              const y = Math.sin(angle) * 35;
              const isMe = player.id === socket?.id;
              const isCurrentTurn = gameState?.currentTurn === gameState?.players.findIndex(p => p.id === player.id);

              return (
                <motion.div key={player.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                  <div className="flex -space-x-8 scale-75 md:scale-100">
                    {player.hand.map((card, cIdx) => (
                      <CardComponent key={cIdx} card={card} hidden={isMe ? player.isBlind : !gameState?.winner} index={cIdx} />
                    ))}
                  </div>
                  <div className={`relative p-3 rounded-2xl border-2 transition-all ${isCurrentTurn ? 'border-red-500 bg-red-500/20 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'border-white/10 bg-black/80'}`}>
                    {isCurrentTurn && gameState?.gameStarted && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-600 px-2 py-1 rounded-full text-[10px] font-bold">
                        <Clock className="w-3 h-3 animate-spin" /> {gameState.turnTimeLeft}s
                      </div>
                    )}
                    <div className="text-xs font-bold truncate max-w-[80px]">{player.name}</div>
                    <div className="text-yellow-500 font-black text-sm">{player.chips.toLocaleString()}</div>
                    {player.isFolded && <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl font-black text-red-500 text-xs uppercase rotate-12">Folded</div>}
                    {player.isBlind && !player.isFolded && <div className="absolute -right-2 -top-2 bg-blue-600 text-[8px] px-2 py-1 rounded-full font-black uppercase">Blind</div>}
                  </div>
                </motion.div>
              );
            })}
          </main>

          {/* Footer Controls */}
          <footer className="p-4 md:p-8 bg-black/80 border-t border-white/10 backdrop-blur-2xl">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center font-black text-xl">L</div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-black tracking-widest">My Balance</div>
                  <div className="text-2xl font-black text-yellow-500">{currentPlayer?.chips.toLocaleString() || 0}</div>
                </div>
              </div>

              {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                <div className="flex flex-wrap justify-center gap-3">
                  <button onClick={() => takeAction('fold')} className="bg-zinc-800 px-6 py-3 rounded-2xl font-black text-sm uppercase hover:bg-zinc-700">Fold</button>
                  {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="bg-blue-600 px-6 py-3 rounded-2xl font-black text-sm uppercase hover:bg-blue-700">See Cards</button>}
                  <button onClick={() => takeAction('chaal')} className="bg-red-600 px-10 py-3 rounded-2xl font-black text-sm uppercase hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]">Chaal</button>
                  <button onClick={handleSideShow} className="bg-zinc-800 px-6 py-3 rounded-2xl font-black text-sm uppercase hover:bg-zinc-700">Side Show</button>
                </div>
              )}

              <div className="text-center md:text-right">
                <a href="https://facebook.com/luciferdev" target="_blank" className="text-[10px] font-black text-white/20 hover:text-red-500 transition-all uppercase tracking-widest">Developed by LUCIFER DEV</a>
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
              <div className="w-20 h-20 bg-red-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <Eye className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black mb-2">SIDE SHOW</h2>
              <p className="text-white/60 mb-8 font-medium"><b>{sideShowPrompt.fromName}</b> is requesting a side show. Accept to compare cards?</p>
              <div className="flex gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 p-4 rounded-2xl font-bold hover:bg-white/10">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 p-4 rounded-2xl font-bold hover:bg-red-700">Accept</button>
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
                <h2 className="text-2xl font-black uppercase tracking-tighter">Lucifer Admin Panel</h2>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-white/5 rounded-full"><LogOut className="w-6 h-6" /></button>
              </div>
              
              <div className="p-8 border-b border-white/5 bg-white/5">
                <h3 className="text-xs font-black uppercase text-white/40 mb-4">Manual Chip Addition</h3>
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
                <h3 className="text-xs font-black uppercase text-white/40">Player Rankings</h3>
                {adminStats.map((stat, i) => (
                  <div key={i} className="flex justify-between items-center p-5 bg-white/5 rounded-[2rem] border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center font-bold text-white/40">{i+1}</div>
                      <span className="font-black text-lg">{stat.name}</span>
                    </div>
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
