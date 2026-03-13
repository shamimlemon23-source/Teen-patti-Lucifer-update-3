import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Eye, LogOut, Play, User as UserIcon, Hand, Settings, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Assets Configuration ---
const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png",
  CARD_BACK: "https://i.imgur.com/8zV6YQO.png" // Added card back image
};

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card { suit: Suit; rank: Rank; }
interface Player { id: string; name: string; chips: number; hand: Card[]; isFolded: boolean; isBlind: boolean; isBot?: boolean; }
interface GameState { players: Player[]; pot: number; currentTurn: number; lastBet: number; gameStarted: boolean; winner: string | null; roundCount: number; autoStartIn: number; }

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS: Record<Suit, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-900', spades: 'text-slate-900' };

const CardComponent = ({ card, hidden, index }: { card: Card; hidden: boolean; index: number }) => {
  const tilt = (index - 1) * 8;
  return (
    <motion.div
      initial={{ scale: 0, y: -50, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1, rotate: tilt }}
      className={`relative w-12 h-16 md:w-28 md:h-40 rounded-xl shadow-2xl border-2 flex flex-col items-center justify-center overflow-hidden ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200'}`}
    >
      {hidden ? (
        <div className="w-full h-full relative">
           <img 
            src={ASSETS.CARD_BACK} 
            alt="Card Back" 
            className="w-full h-full object-cover opacity-80"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 md:w-16 md:h-16 border-2 border-red-500/30 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm">
               <span className="text-red-500 font-black text-[10px] md:text-2xl">L</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 md:top-2 md:left-2 font-black text-[10px] md:text-2xl ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
          <div className={`text-xl md:text-6xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-1 right-1 md:bottom-2 md:right-2 font-black text-[10px] md:text-2xl rotate-180 ${SUIT_COLORS[card.suit]}`}>{card.rank}</div>
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
    const splashTimer = setTimeout(() => setShowSplash(false), 3000);
    const s = io({ transports: ['polling', 'websocket'] });
    setSocket(s);
    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));
    s.on('gameState', (state) => {
      setGameState(state);
      if (state.winner) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#ff0000', '#ffd700', '#ffffff'] });
      }
    });
    s.on('adminStats', setAdminStats);
    s.on('adminMessage', (msg) => { setAdminMessage(msg); setTimeout(() => setAdminMessage(''), 4000); });
    s.on('sideShowPrompt', setSideShowPrompt);
    return () => { s.close(); clearTimeout(splashTimer); };
  }, []);

  const joinRoom = () => { if (socket && name) { socket.emit('joinRoom', { roomId, name }); setJoined(true); } };
  const takeAction = (action: string, amount?: number) => socket?.emit('action', { roomId, action, amount });
  const handleRaise = () => {
    const amt = prompt("Enter Raise Amount (e.g. 1000000):", "1000000");
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

  // --- Splash Screen ---
  if (showSplash) return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center">
      <img src={ASSETS.SPLASH_BG} alt="Splash" className="absolute inset-0 w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 flex flex-col items-center"
      >
        <img src={ASSETS.LOGO} alt="Logo" className="w-32 h-32 md:w-48 md:h-48 mb-6 drop-shadow-[0_0_30px_rgba(255,0,0,0.5)]" referrerPolicy="no-referrer" />
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">LUCIFER <span className="text-red-600">POKER</span></h1>
        <div className="mt-8 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-full h-full bg-red-600"
          />
        </div>
      </motion.div>
    </div>
  );

  // --- Login Screen ---
  if (!joined) return (
    <div className="h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <img src={ASSETS.SPLASH_BG} alt="BG" className="absolute inset-0 w-full h-full object-cover opacity-20" referrerPolicy="no-referrer" />
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-center relative z-10 shadow-2xl"
      >
        <img src={ASSETS.LOGO} alt="Logo" className="w-24 h-24 mx-auto mb-6" referrerPolicy="no-referrer" />
        <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">LUCIFER <span className="text-red-600">POKER</span></h1>
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-8">High Stakes Teen Patti</p>
        
        <div className="space-y-4">
          <div className="text-left">
            <label className="text-[10px] font-black text-white/40 uppercase ml-2 mb-1 block">Player Identity</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Enter Your Name" 
              className="w-full bg-white/5 p-4 rounded-2xl outline-none text-white border border-white/10 focus:border-red-600 transition-all font-bold" 
            />
          </div>
          <button 
            onClick={joinRoom} 
            className="w-full bg-red-600 hover:bg-red-500 p-4 rounded-2xl font-black text-white transition-all shadow-lg shadow-red-600/20 active:scale-95"
          >
            JOIN TABLE
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="p-3 flex items-center justify-between bg-black/60 backdrop-blur-xl z-[60] border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={ASSETS.LOGO} alt="Logo" className="w-8 h-8" referrerPolicy="no-referrer" />
          <div className="flex flex-col">
            <span className="font-black text-xs tracking-tighter">LUCIFER POKER</span>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[8px] font-bold text-white/40 uppercase">{isConnected ? 'Server Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button 
              onClick={() => { setShowAdminPanel(true); socket?.emit('getAdminStats', name); }} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 rounded-full text-[10px] font-black text-red-500 transition-all"
            >
              <ShieldCheck className="w-3 h-3" /> ADMIN
            </button>
          )}
          <button onClick={() => window.location.reload()} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative bg-[#0a2e1f] overflow-hidden flex items-center justify-center">
        {/* Table Background Image */}
        <img 
          src={ASSETS.TABLE_BG} 
          alt="Table" 
          className="absolute inset-0 w-full h-full object-cover opacity-60" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
        
        {/* Dealer */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 opacity-80">
          <img src={ASSETS.DEALER} alt="Dealer" className="w-24 md:w-40" referrerPolicy="no-referrer" />
        </div>

        {/* Pot & Info */}
        <div className="z-20 flex flex-col items-center bg-black/60 p-6 rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl">
          <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-1">Total Pot Value</span>
          <div className="text-3xl md:text-5xl font-black flex items-center gap-3 text-white">
            <Coins className="text-yellow-500 w-6 h-6 md:w-10 md:h-10" /> 
            {gameState?.pot.toLocaleString()}
          </div>
          
          <AnimatePresence>
            {!gameState?.gameStarted && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="mt-6 flex flex-col items-center"
              >
                {gameState?.autoStartIn && gameState.autoStartIn > 0 ? (
                  <div className="text-sm font-black text-white/60 uppercase tracking-widest">Starting in {gameState.autoStartIn}s...</div>
                ) : (
                  <button 
                    onClick={() => socket?.emit('startGame', roomId)} 
                    className="bg-red-600 hover:bg-red-500 px-10 py-3 rounded-2xl font-black text-sm tracking-widest shadow-xl shadow-red-600/30 transition-all active:scale-95"
                  >
                    START GAME
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Players Layout */}
        <div className="absolute inset-0 pointer-events-none">
          {rotatedPlayers.map((p, idx) => {
            const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
            const rx = window.innerWidth < 768 ? 38 : 35;
            const ry = window.innerWidth < 768 ? 32 : 28;
            const x = Math.cos(angle) * rx;
            const y = Math.sin(angle) * ry;
            const isCurrent = gameState?.players[gameState.currentTurn]?.id === p.id;
            const isMe = p.id === socket?.id;

            return (
              <div 
                key={p.id} 
                style={{ left: `${50 + x}%`, top: `${50 + y}%` }} 
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto"
              >
                {/* Cards */}
                <div className="flex -space-x-8 md:-space-x-16 mb-3">
                  {p.hand.length > 0 ? (
                    p.hand.map((c, ci) => (
                      <CardComponent 
                        key={ci} 
                        card={c} 
                        hidden={isMe ? p.isBlind : !gameState?.winner} 
                        index={ci} 
                      />
                    ))
                  ) : (
                    !gameState?.gameStarted && idx === 0 && (
                      <div className="h-16 md:h-40" /> // Spacer
                    )
                  )}
                </div>

                {/* Player Tag */}
                <motion.div 
                  animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
                  className={`relative p-3 rounded-2xl border-2 flex flex-col items-center bg-black/80 backdrop-blur-md min-w-[100px] md:min-w-[140px] transition-all ${isCurrent ? 'border-red-600 shadow-[0_0_25px_rgba(255,0,0,0.4)]' : 'border-white/10'}`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 bg-red-600 text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest">Thinking</div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${p.isFolded ? 'bg-zinc-600' : 'bg-green-500'}`} />
                    <span className={`text-[10px] md:text-xs font-black truncate max-w-[80px] md:max-w-[100px] ${p.isFolded ? 'text-white/40 line-through' : 'text-white'}`}>
                      {p.name} {isMe && "(You)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-500 font-black text-[10px] md:text-sm">
                    <Coins className="w-3 h-3" />
                    {p.chips === -1 ? '???' : p.chips.toLocaleString()}
                  </div>
                  {p.isBlind && !p.isFolded && (
                    <div className="mt-1 text-[8px] font-black text-red-500 uppercase tracking-tighter">Blind Player</div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Action Controls */}
      <footer className="p-4 md:p-6 bg-zinc-900/90 backdrop-blur-2xl border-t border-white/10 z-[60]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* My Stats */}
          <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
            <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
              <UserIcon className="text-red-500 w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Available Chips</span>
              <div className="text-xl md:text-2xl font-black text-yellow-500 flex items-center gap-2">
                <Coins className="w-5 h-5" /> {currentPlayer?.chips.toLocaleString() || 0}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {isMyTurn && gameState?.gameStarted && !gameState.winner ? (
              <div className="flex items-center gap-2 w-full justify-center md:justify-end">
                <button 
                  onClick={() => takeAction('fold')} 
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Fold
                </button>
                
                {currentPlayer?.isBlind && (
                  <button 
                    onClick={() => takeAction('see')} 
                    className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Eye className="w-4 h-4" /> See Cards
                  </button>
                )}

                <div className="flex items-stretch rounded-xl overflow-hidden border-2 border-red-600 shadow-lg shadow-red-600/20">
                  <button 
                    onClick={() => takeAction('chaal')} 
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 text-xs font-black uppercase tracking-widest transition-all active:bg-red-700"
                  >
                    Chaal ({(currentPlayer?.isBlind ? gameState?.lastBet : gameState?.lastBet * 2).toLocaleString()})
                  </button>
                  <button 
                    onClick={handleRaise} 
                    className="px-4 py-3 bg-red-800 hover:bg-red-700 font-black text-xl border-l border-red-500 transition-all active:bg-red-900"
                  >
                    +
                  </button>
                </div>

                {gameState.roundCount >= 1 && (
                   <button 
                    onClick={() => socket?.emit('sideShowRequest', roomId)} 
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    Side Show
                  </button>
                )}
                
                {gameState.players.filter(p => !p.isFolded).length === 2 && (
                   <button 
                    onClick={() => takeAction('show')} 
                    className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    Show
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs font-bold text-white/20 uppercase tracking-[0.3em] py-3">
                {gameState?.gameStarted ? "Waiting for other players..." : "Game will start soon"}
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* Side Show Prompt */}
      <AnimatePresence>
        {sideShowPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/10 text-center max-w-sm shadow-2xl">
              <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Hand className="text-blue-500 w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black mb-2 tracking-tighter">SIDE SHOW REQUEST</h3>
              <p className="text-sm text-white/60 mb-8 font-medium leading-relaxed">
                <span className="text-white font-bold">{sideShowPrompt.fromName}</span> is asking for a side show. Do you accept?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => { socket?.emit('sideShowResponse', { roomId, accepted: false }); setSideShowPrompt(null); }} 
                  className="flex-1 p-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs tracking-widest transition-all"
                >
                  DENY
                </button>
                <button 
                  onClick={() => { socket?.emit('sideShowResponse', { roomId, accepted: true }); setSideShowPrompt(null); }} 
                  className="flex-1 p-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs tracking-widest transition-all shadow-lg shadow-blue-600/20"
                >
                  ACCEPT
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4 md:p-10"
          >
            <div className="w-full max-w-3xl bg-zinc-900 rounded-[3rem] border border-white/10 overflow-hidden flex flex-col max-h-full shadow-2xl">
              <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex gap-6">
                  <button 
                    onClick={() => setAdminTab('players')} 
                    className={`text-sm font-black uppercase tracking-widest transition-all ${adminTab === 'players' ? 'text-red-500' : 'text-white/40 hover:text-white'}`}
                  >
                    Active Players
                  </button>
                  <button 
                    onClick={() => setAdminTab('manual')} 
                    className={`text-sm font-black uppercase tracking-widest transition-all ${adminTab === 'manual' ? 'text-red-500' : 'text-white/40 hover:text-white'}`}
                  >
                    Manual Control
                  </button>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><LogOut className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {adminMessage && (
                  <motion.div 
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-4 bg-green-600/20 border border-green-500/30 rounded-2xl text-center text-xs font-bold text-green-400"
                  >
                    {adminMessage}
                  </motion.div>
                )}
                
                {adminTab === 'players' ? (
                  <div className="space-y-3">
                    <button 
                      onClick={() => { if(confirm("Reset ALL players to 5 Crore?")) socket?.emit('resetAllChips', name); }} 
                      className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 p-4 rounded-2xl font-black text-xs tracking-widest border border-red-500/20 mb-6 transition-all"
                    >
                      RESET ALL PLAYERS TO 5CR
                    </button>
                    
                    <div className="grid gap-2">
                      {adminStats.length === 0 ? (
                        <div className="text-center py-10 text-white/20 font-black uppercase tracking-widest">No Players Found</div>
                      ) : (
                        adminStats.map((s, i) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-zinc-800 rounded-xl flex items-center justify-center text-[10px] font-black text-white/40">{i+1}</div>
                              <span className="text-sm font-black">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-yellow-500 font-black">{Number(s.chips).toLocaleString()}</span>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => socket?.emit('addPlayerChips', { adminName: name, targetName: s.name, amount: '10000000' })} 
                                  className="px-3 py-2 bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white rounded-xl text-[10px] font-black transition-all"
                                >
                                  +1CR
                                </button>
                                <button 
                                  onClick={() => socket?.emit('resetPlayerChips', { adminName: name, targetName: s.name })} 
                                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-xl text-[10px] font-black transition-all"
                                >
                                  RESET
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-md mx-auto">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Target Player Name</label>
                      <input 
                        type="text" 
                        value={manualName} 
                        onChange={e => setManualName(e.target.value)} 
                        placeholder="Enter Name" 
                        className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all font-bold" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Chip Amount</label>
                      <input 
                        type="number" 
                        value={manualAmount} 
                        onChange={e => setManualAmount(e.target.value)} 
                        placeholder="Enter Amount" 
                        className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all font-bold" 
                      />
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => { if(!manualName) return alert("Enter name"); socket?.emit('addPlayerChips', { adminName: name, targetName: manualName, amount: manualAmount }); }} 
                        className="flex-1 bg-green-600 hover:bg-green-500 p-5 rounded-2xl font-black text-xs tracking-widest transition-all shadow-lg shadow-green-600/20"
                      >
                        ADD CHIPS
                      </button>
                      <button 
                        onClick={() => { if(!manualName) return alert("Enter name"); if(confirm(`Reset ${manualName}?`)) socket?.emit('resetPlayerChips', { adminName: name, targetName: manualName }); }} 
                        className="flex-1 bg-red-600 hover:bg-red-500 p-5 rounded-2xl font-black text-xs tracking-widest transition-all shadow-lg shadow-red-600/20"
                      >
                        RESET CHIPS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
