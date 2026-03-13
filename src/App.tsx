import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Eye, LogOut, Play, User as UserIcon, Hand } from 'lucide-react';
import confetti from 'canvas-confetti';

const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
};

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card { suit: Suit; rank: Rank; }
interface Player { id: string; name: string; chips: number; hand: Card[]; isFolded: boolean; isBlind: boolean; }
interface GameState { players: Player[]; pot: number; currentTurn: number; lastBet: number; gameStarted: boolean; winner: string | null; roundCount: number; autoStartIn: number; }

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS: Record<Suit, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-900', spades: 'text-slate-900' };

const CardComponent = ({ card, hidden, index }: { card: Card; hidden: boolean; index: number }) => {
  const tilt = (index - 1) * 5;
  return (
    <motion.div
      initial={{ scale: 0, y: -20 }}
      animate={{ scale: 1, y: 0, rotate: tilt }}
      className={`relative w-10 h-14 md:w-24 md:h-32 rounded-lg shadow-2xl border flex flex-col items-center justify-center ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-zinc-50 border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-red-950 rounded-lg border border-red-500/30">
          <div className="text-red-500 font-black text-xs md:text-xl">L</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-[10px] md:text-xl ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-lg md:text-5xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
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
  const [adminTab, setAdminTab] = useState<'players' | 'manual'>('players');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('50000000');
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [adminMessage, setAdminMessage] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);

  const isAdmin = name.trim().toLowerCase() === 'admin';

  useEffect(() => {
    setTimeout(() => setShowSplash(false), 2000);
    const s = io({ transports: ['polling', 'websocket'] });
    setSocket(s);
    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));
    s.on('gameState', (state) => {
      setGameState(state);
      if (state.winner) confetti({ particleCount: 100, spread: 70 });
    });
    s.on('adminStats', setAdminStats);
    s.on('adminMessage', (msg) => { setAdminMessage(msg); setTimeout(() => setAdminMessage(''), 3000); });
    s.on('sideShowPrompt', setSideShowPrompt);
    return () => { s.close(); };
  }, []);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });
  const handleRaise = () => {
    const amt = prompt("Enter Raise Amount:", "1000000");
    if (amt && !isNaN(parseInt(amt))) takeAction('raise', parseInt(amt));
  };

  const rotatedPlayers = useMemo(() => {
    if (!gameState) return [];
    const players = [...gameState.players];
    const myIdx = players.findIndex(p => p.id === socket?.id);
    if (myIdx === -1) return players;
    const rotated = [];
    for (let i = 0; i < players.length; i++) rotated.push(players[(myIdx + i) % players.length]);
    return rotated;
  }, [gameState, socket]);

  const currentPlayer = gameState?.players.find(p => p.id === socket?.id);
  const isMyTurn = gameState?.players[gameState.currentTurn]?.id === socket?.id;

  if (showSplash) return <div className="h-screen bg-black flex items-center justify-center"><h1 className="text-white text-4xl font-black animate-pulse">LUCIFER POKER</h1></div>;

  if (!joined) return (
    <div className="h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 p-8 rounded-3xl border border-white/10 text-center">
        <h1 className="text-3xl font-black text-white mb-8">LUCIFER <span className="text-red-600">POKER</span></h1>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-white/5 p-4 rounded-xl mb-4 outline-none text-white border border-white/10" />
        <button onClick={joinRoom} className="w-full bg-red-600 p-4 rounded-xl font-bold text-white">Enter Game</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-2 flex items-center justify-between bg-black/60 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black">L</div>
          <span className="font-black text-xs">LUCIFER POKER</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <button onClick={() => { setShowAdminPanel(true); socket?.emit('getAdminStats', name); }} className="px-3 py-1 bg-red-600 rounded-full text-[10px] font-black">ADMIN</button>}
          <button onClick={() => window.location.reload()} className="p-2 bg-white/5 rounded-full"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Table */}
      <main className="flex-1 relative bg-emerald-950 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
        
        {/* Pot */}
        <div className="z-20 flex flex-col items-center bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Total Pot</span>
          <div className="text-2xl md:text-4xl font-black flex items-center gap-2"><Coins className="text-yellow-500" /> {gameState?.pot.toLocaleString()}</div>
          {!gameState?.gameStarted && <button onClick={() => socket?.emit('startGame', roomId)} className="mt-4 bg-red-600 px-6 py-2 rounded-xl font-black animate-bounce">START</button>}
        </div>

        {/* Players */}
        {rotatedPlayers.map((p, idx) => {
          const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
          const rx = window.innerWidth < 768 ? 40 : 35;
          const ry = window.innerWidth < 768 ? 30 : 28;
          const x = Math.cos(angle) * rx;
          const y = Math.sin(angle) * ry;
          const isCurrent = gameState?.players[gameState.currentTurn]?.id === p.id;
          return (
            <div key={p.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="flex -space-x-6 mb-2">
                {p.hand.map((c, ci) => <CardComponent key={ci} card={c} hidden={p.id === socket?.id ? p.isBlind : !gameState?.winner} index={ci} />)}
              </div>
              <div className={`p-2 rounded-xl border-2 flex flex-col items-center bg-black/60 min-w-[80px] ${isCurrent ? 'border-red-500 shadow-[0_0_15px_red]' : 'border-white/10'}`}>
                <span className="text-[10px] font-black truncate max-w-[70px]">{p.name}</span>
                <span className="text-[10px] text-yellow-500 font-bold">{p.chips === -1 ? '???' : p.chips.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </main>

      {/* Controls */}
      <footer className="p-4 bg-black/80 backdrop-blur-xl border-t border-white/5 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/40 uppercase">Your Chips</span>
            <div className="text-xl font-black text-yellow-500 flex items-center gap-1"><Coins className="w-4 h-4" /> {currentPlayer?.chips.toLocaleString() || 0}</div>
          </div>

          {isMyTurn && gameState?.gameStarted && !gameState.winner && (
            <div className="flex items-center gap-1 md:gap-2 flex-wrap justify-end">
              <button onClick={() => takeAction('fold')} className="px-4 py-2 bg-zinc-800 rounded-lg text-[10px] font-black uppercase">Fold</button>
              {currentPlayer?.isBlind && <button onClick={() => takeAction('see')} className="px-4 py-2 bg-zinc-800 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"><Eye className="w-3 h-3" /> See</button>}
              <div className="flex items-stretch rounded-lg overflow-hidden border border-red-500">
                <button onClick={() => takeAction('chaal')} className="px-4 py-2 bg-red-600 text-[10px] font-black uppercase">Chaal ({(currentPlayer?.isBlind ? gameState?.lastBet : gameState?.lastBet * 2).toLocaleString()})</button>
                <button onClick={handleRaise} className="px-3 py-2 bg-red-800 font-black text-lg border-l border-red-400">+</button>
              </div>
            </div>
          )}
        </div>
      </footer>

      {/* Side Show Prompt */}
      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-zinc-900 p-8 rounded-3xl border border-white/10 text-center max-w-xs">
              <h3 className="text-xl font-black mb-4">SIDE SHOW?</h3>
              <p className="text-sm text-white/60 mb-6">{sideShowPrompt.fromName} wants a side show.</p>
              <div className="flex gap-4">
                <button onClick={() => { socket?.emit('sideShowResponse', { roomId, accepted: false }); setSideShowPrompt(null); }} className="flex-1 p-3 bg-white/5 rounded-xl font-bold">DENY</button>
                <button onClick={() => { socket?.emit('sideShowResponse', { roomId, accepted: true }); setSideShowPrompt(null); }} className="flex-1 p-3 bg-red-600 rounded-xl font-bold">ACCEPT</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-zinc-900 rounded-3xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex gap-4">
                  <button onClick={() => setAdminTab('players')} className={`text-sm font-black uppercase ${adminTab === 'players' ? 'text-red-500' : 'text-white/40'}`}>Players</button>
                  <button onClick={() => setAdminTab('manual')} className={`text-sm font-black uppercase ${adminTab === 'manual' ? 'text-red-500' : 'text-white/40'}`}>Manual</button>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-white/5 rounded-full"><LogOut className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {adminMessage && <div className="mb-4 p-3 bg-green-600/20 border border-green-500/30 rounded-xl text-center text-xs font-bold">{adminMessage}</div>}
                
                {adminTab === 'players' ? (
                  <div className="space-y-2">
                    <button onClick={() => socket?.emit('resetAllChips', name)} className="w-full bg-red-600/20 text-red-500 p-3 rounded-xl font-black text-xs mb-4">RESET ALL PLAYERS</button>
                    {adminStats.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-xs font-bold">{s.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-yellow-500 font-black">{Number(s.chips).toLocaleString()}</span>
                          <button onClick={() => socket?.emit('addPlayerChips', { adminName: name, targetName: s.name, amount: '10000000' })} className="px-2 py-1 bg-green-600 rounded text-[8px] font-black">ADD 1CR</button>
                          <button onClick={() => socket?.emit('resetPlayerChips', { adminName: name, targetName: s.name })} className="px-2 py-1 bg-red-600 rounded text-[8px] font-black">RESET</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Player Name" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                    <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="Amount" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                    <div className="flex gap-4">
                      <button onClick={() => socket?.emit('addPlayerChips', { adminName: name, targetName: manualName, amount: manualAmount })} className="flex-1 bg-green-600 p-4 rounded-xl font-black">ADD CHIPS</button>
                      <button onClick={() => socket?.emit('resetPlayerChips', { adminName: name, targetName: manualName })} className="flex-1 bg-red-600 p-4 rounded-xl font-black">RESET CHIPS</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
