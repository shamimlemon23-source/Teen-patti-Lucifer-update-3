import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Coins, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Shield, 
  User as UserIcon,
  Eye,
  EyeOff,
  History,
  TrendingUp,
  Crown,
  Info
} from 'lucide-react';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  getDocs,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  runTransaction
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';

// --- Types ---
type Card = {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: string;
  rank: number;
};

type Player = {
  uid: string;
  name: string;
  photoURL: string;
  chips: number;
  isReady: boolean;
  cards: Card[];
  isSeen: boolean;
  isFolded: boolean;
  currentBet: number;
  lastAction?: string;
  role: 'admin' | 'player';
};

type GameState = {
  status: 'waiting' | 'playing' | 'showdown';
  pot: number;
  currentBet: number;
  turnIndex: number;
  dealerIndex: number;
  players: string[]; // UIDs of players in current round
  lastWinner?: string;
  winnerHand?: string;
  deck: Card[];
  roundId: string;
};

type SideShowRequest = {
  from: string;
  to: string;
  fromName: string;
};

// --- Constants ---
const BOOTSTRAP_ADMIN = "shamimlemon23@gmail.com";
const INITIAL_CHIPS = 10000;
const BOOT_AMOUNT = 100;

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// --- Utils ---
const createDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    VALUES.forEach((value, index) => {
      deck.push({ suit, value, rank: index + 2 });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

const getHandRank = (cards: Card[]) => {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const isTrail = sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank;
  const isPureSeq = (sorted[0].rank === sorted[1].rank + 1 && sorted[1].rank === sorted[2].rank + 1) &&
                    (cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit);
  const isSeq = (sorted[0].rank === sorted[1].rank + 1 && sorted[1].rank === sorted[2].rank + 1) ||
                (sorted[0].rank === 14 && sorted[1].rank === 3 && sorted[2].rank === 2); // A-3-2
  const isColor = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
  const isPair = sorted[0].rank === sorted[1].rank || sorted[1].rank === sorted[2].rank || sorted[0].rank === sorted[2].rank;

  if (isTrail) return { score: 6, name: 'Trail', power: sorted[0].rank };
  if (isPureSeq) return { score: 5, name: 'Pure Sequence', power: sorted[0].rank };
  if (isSeq) return { score: 4, name: 'Sequence', power: sorted[0].rank };
  if (isColor) return { score: 3, name: 'Color', power: sorted[0].rank };
  if (isPair) {
    const pairRank = sorted[0].rank === sorted[1].rank ? sorted[0].rank : sorted[1].rank;
    return { score: 2, name: 'Pair', power: pairRank };
  }
  return { score: 1, name: 'High Card', power: sorted[0].rank };
};

const compareHands = (h1: Card[], h2: Card[]) => {
  const r1 = getHandRank(h1);
  const r2 = getHandRank(h2);
  if (r1.score !== r2.score) return r1.score > r2.score ? 1 : -1;
  if (r1.power !== r2.power) return r1.power > r2.power ? 1 : -1;
  return 0;
};

// --- Components ---
const PlayingCard = ({ card, hidden, small }: { card: Card, hidden?: boolean, small?: boolean }) => {
  if (hidden) return (
    <div className={`${small ? 'w-6 h-9 md:w-8 md:h-12' : 'w-10 h-14 md:w-14 md:h-20'} bg-red-800 rounded-sm md:rounded-md border-2 border-white/20 flex items-center justify-center shadow-lg transform hover:-translate-y-1 transition-transform`}>
      <div className="w-full h-full opacity-20 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:4px_4px]" />
    </div>
  );

  const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'text-red-500' : 'text-zinc-900';
  const SuitIcon = () => {
    switch(card.suit) {
      case 'hearts': return <span>♥</span>;
      case 'diamonds': return <span>♦</span>;
      case 'clubs': return <span>♣</span>;
      case 'spades': return <span>♠</span>;
    }
  };

  return (
    <motion.div 
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      className={`${small ? 'w-6 h-9 md:w-8 md:h-12 text-[10px] md:text-xs' : 'w-10 h-14 md:w-14 md:h-20 text-xs md:text-base'} bg-white rounded-sm md:rounded-md border border-zinc-300 flex flex-col justify-between p-0.5 md:p-1 shadow-lg ${color} font-bold`}
    >
      <div className="leading-none">{card.value}</div>
      <div className={`${small ? 'text-xs md:text-sm' : 'text-lg md:text-2xl'} self-center`}><SuitIcon /></div>
      <div className="leading-none self-end rotate-180">{card.value}</div>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sideShowPrompt, setSideShowPrompt] = useState<SideShowRequest | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentPlayer = players.find(p => p.uid === user?.uid);
  const isMyTurn = gameState?.status === 'playing' && players[gameState.turnIndex]?.uid === user?.uid;

  // --- Auth & Sync ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const playerRef = doc(db, 'players', u.uid);
        const playerSnap = await getDocs(query(collection(db, 'players'), where('uid', '==', u.uid)));
        
        if (playerSnap.empty) {
          await setDoc(playerRef, {
            uid: u.uid,
            name: u.displayName || 'Player',
            photoURL: u.photoURL || '',
            chips: INITIAL_CHIPS,
            isReady: false,
            cards: [],
            isSeen: false,
            isFolded: true,
            currentBet: 0,
            role: u.email === BOOTSTRAP_ADMIN ? 'admin' : 'player'
          });
        }
        setUser(u);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      setPlayers(snap.docs.map(doc => doc.data() as Player));
    });
    const unsubGame = onSnapshot(doc(db, 'game', 'state'), (snap) => {
      if (snap.exists()) setGameState(snap.data() as GameState);
    });
    const unsubSideShow = onSnapshot(doc(db, 'game', 'sideshow'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SideShowRequest;
        if (data.to === user?.uid) setSideShowPrompt(data);
        else setSideShowPrompt(null);
      } else {
        setSideShowPrompt(null);
      }
    });
    return () => {
      unsubPlayers();
      unsubGame();
      unsubSideShow();
    };
  }, [user]);

  // --- Game Logic ---
  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const toggleReady = async () => {
    if (!currentPlayer) return;
    await updateDoc(doc(db, 'players', user.uid), { isReady: !currentPlayer.isReady });
  };

  const startGame = async () => {
    const readyPlayers = players.filter(p => p.isReady && p.chips >= BOOT_AMOUNT);
    if (readyPlayers.length < 2) return;

    const deck = createDeck();
    const roundId = Math.random().toString(36).substring(7);
    
    // Reset players for new round
    for (const p of players) {
      const isParticipating = readyPlayers.some(rp => rp.uid === p.uid);
      await updateDoc(doc(db, 'players', p.uid), {
        cards: isParticipating ? [deck.pop()!, deck.pop()!, deck.pop()!] : [],
        isSeen: false,
        isFolded: !isParticipating,
        currentBet: isParticipating ? BOOT_AMOUNT : 0,
        chips: isParticipating ? increment(-BOOT_AMOUNT) : increment(0),
        isReady: false
      });
    }

    await setDoc(doc(db, 'game', 'state'), {
      status: 'playing',
      pot: readyPlayers.length * BOOT_AMOUNT,
      currentBet: BOOT_AMOUNT,
      turnIndex: 0,
      dealerIndex: (gameState?.dealerIndex ?? -1 + 1) % readyPlayers.length,
      players: readyPlayers.map(p => p.uid),
      deck,
      roundId
    });
  };

  const fold = async () => {
    if (!isMyTurn || !gameState) return;
    
    await updateDoc(doc(db, 'players', user.uid), { isFolded: true, lastAction: 'Folded' });
    
    const activePlayers = players.filter(p => !p.isFolded && p.uid !== user.uid && gameState.players.includes(p.uid));
    
    if (activePlayers.length === 1) {
      await endRound(activePlayers[0].uid);
    } else {
      await nextTurn();
    }
  };

  const seeCards = async () => {
    if (!currentPlayer) return;
    await updateDoc(doc(db, 'players', user.uid), { isSeen: true });
  };

  const placeBet = async (multiplier: number) => {
    if (!isMyTurn || !gameState || !currentPlayer) return;

    const betAmount = gameState.currentBet * multiplier * (currentPlayer.isSeen ? 2 : 1);
    if (currentPlayer.chips < betAmount) return;

    await updateDoc(doc(db, 'players', user.uid), {
      chips: increment(-betAmount),
      currentBet: increment(betAmount),
      lastAction: currentPlayer.isSeen ? 'Chaal' : 'Blind'
    });

    await updateDoc(doc(db, 'game', 'state'), {
      pot: increment(betAmount),
      currentBet: gameState.currentBet * multiplier
    });

    await nextTurn();
  };

  const requestSideShow = async () => {
    if (!isMyTurn || !gameState || !currentPlayer) return;
    
    // Find previous active player
    let prevIdx = (gameState.turnIndex - 1 + players.length) % players.length;
    while (players[prevIdx].isFolded || !gameState.players.includes(players[prevIdx].uid)) {
      prevIdx = (prevIdx - 1 + players.length) % players.length;
    }

    await setDoc(doc(db, 'game', 'sideshow'), {
      from: user.uid,
      to: players[prevIdx].uid,
      fromName: currentPlayer.name
    });
  };

  const respondSideShow = async (accepted: boolean) => {
    if (!sideShowPrompt || !gameState) return;

    if (accepted) {
      const p1 = players.find(p => p.uid === sideShowPrompt.from)!;
      const p2 = players.find(p => p.uid === sideShowPrompt.to)!;
      const winner = compareHands(p1.cards, p2.cards);
      
      if (winner === 1) {
        await updateDoc(doc(db, 'players', p2.uid), { isFolded: true, lastAction: 'Lost SideShow' });
      } else {
        await updateDoc(doc(db, 'players', p1.uid), { isFolded: true, lastAction: 'Lost SideShow' });
      }
    }

    await deleteDoc(doc(db, 'game', 'sideshow'));
    await nextTurn();
  };

  const show = async () => {
    if (!isMyTurn || !gameState || !currentPlayer) return;
    
    const activePlayers = players.filter(p => !p.isFolded && gameState.players.includes(p.uid));
    if (activePlayers.length !== 2) return;

    const p1 = activePlayers[0];
    const p2 = activePlayers[1];
    const result = compareHands(p1.cards, p2.cards);
    const winnerUid = result === 1 ? p1.uid : p2.uid;
    
    await endRound(winnerUid);
  };

  const nextTurn = async () => {
    if (!gameState) return;
    let nextIdx = (gameState.turnIndex + 1) % players.length;
    while (players[nextIdx].isFolded || !gameState.players.includes(players[nextIdx].uid)) {
      nextIdx = (nextIdx + 1) % players.length;
    }
    await updateDoc(doc(db, 'game', 'state'), { turnIndex: nextIdx });
  };

  const endRound = async (winnerUid: string) => {
    if (!gameState) return;
    const winner = players.find(p => p.uid === winnerUid)!;
    const hand = getHandRank(winner.cards);

    await updateDoc(doc(db, 'players', winnerUid), {
      chips: increment(gameState.pot)
    });

    await updateDoc(doc(db, 'game', 'state'), {
      status: 'showdown',
      lastWinner: winner.name,
      winnerHand: hand.name
    });

    setTimeout(async () => {
      await updateDoc(doc(db, 'game', 'state'), { status: 'waiting' });
    }, 5000);
  };

  // --- Admin Actions ---
  const resetGame = async () => {
    await setDoc(doc(db, 'game', 'state'), { status: 'waiting', pot: 0, currentBet: BOOT_AMOUNT, turnIndex: 0, dealerIndex: 0, players: [] });
    for (const p of players) {
      await updateDoc(doc(db, 'players', p.uid), { cards: [], isSeen: false, isFolded: true, isReady: false, currentBet: 0 });
    }
  };

  const addChips = async (uid: string, amount: number) => {
    await updateDoc(doc(db, 'players', uid), { chips: increment(amount) });
  };

  // --- Render Helpers ---
  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full"
      >
        <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-600/20 rotate-12">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">TEEN PATTI <span className="text-red-600">ROYALE</span></h1>
        <p className="text-zinc-400 mb-12 text-lg">The ultimate high-stakes card game experience. Join the table and prove your skill.</p>
        <button 
          onClick={login}
          className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95 text-xl shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
          SIGN IN WITH GOOGLE
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-red-500/30 overflow-hidden flex flex-col">
      {/* Header - Compact for Landscape */}
      <header className="p-2 md:p-4 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="w-8 h-8 md:w-12 md:h-12 bg-red-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
            <Trophy className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm md:text-xl font-black tracking-tight">ROYALE TABLE</h2>
            <div className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs text-zinc-500">
              <Users className="w-3 h-3" />
              <span>{players.length} Players Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Your Balance</span>
            <div className="flex items-center gap-2 text-xl font-black text-emerald-500">
              <Coins className="w-5 h-5" />
              {currentPlayer?.chips.toLocaleString()}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {currentPlayer?.role === 'admin' && (
              <button 
                onClick={() => setIsAdminPanelOpen(true)}
                className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-lg md:rounded-xl transition-all"
              >
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
              </button>
            )}
            <button 
              onClick={logout}
              className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-lg md:rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4 md:w-5 md:h-5 text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Area - Optimized for Landscape */}
      <main className="flex-1 relative flex items-center justify-center p-2 md:p-8">
        {/* Poker Table - Scaled for Landscape */}
        <div className="relative w-full max-w-4xl aspect-[2/1] md:aspect-[2.5/1] bg-emerald-900/20 rounded-[100px] md:rounded-[200px] border-[8px] md:border-[16px] border-zinc-900 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <div className="absolute inset-4 md:inset-8 border-2 border-white/5 rounded-[80px] md:rounded-[180px]" />
          
          {/* Center Pot - More Compact */}
          <div className="text-center z-10 bg-zinc-950/80 p-3 md:p-6 rounded-2xl md:rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl scale-75 md:scale-100">
            {gameState?.status === 'playing' ? (
              <>
                <div className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Current Pot</div>
                <div className="text-2xl md:text-5xl font-black text-white flex items-center justify-center gap-2 md:gap-3 mb-1 md:mb-2">
                  <Coins className="w-6 h-6 md:w-10 md:h-10 text-emerald-500" />
                  {gameState.pot.toLocaleString()}
                </div>
                <div className="inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-emerald-500/10 rounded-full text-[10px] md:text-xs font-bold text-emerald-500 border border-emerald-500/20">
                  <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  MIN BET: {gameState.currentBet}
                </div>
              </>
            ) : gameState?.status === 'showdown' ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-1 md:space-y-2"
              >
                <Crown className="w-8 h-8 md:w-12 md:h-12 text-yellow-500 mx-auto mb-2" />
                <h3 className="text-xl md:text-3xl font-black text-white uppercase">{gameState.lastWinner} WINS!</h3>
                <p className="text-yellow-500 font-bold text-xs md:text-lg">{gameState.winnerHand}</p>
              </motion.div>
            ) : (
              <div className="space-y-2 md:space-y-4">
                <h3 className="text-lg md:text-2xl font-black text-zinc-500">WAITING FOR PLAYERS</h3>
                <div className="flex justify-center gap-1 md:gap-2">
                  {[1,2,3].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-red-600 rounded-full"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Players - Better Spacing for Landscape */}
          {players.map((p, i) => {
            const angle = (i / players.length) * 2 * Math.PI;
            // Adjusted radius for landscape: wider but shorter
            const rx = 42; // percentage of width
            const ry = 38; // percentage of height
            const x = 50 + rx * Math.cos(angle);
            const y = 50 + ry * Math.sin(angle);
            const isTurn = gameState?.status === 'playing' && gameState.turnIndex === i;
            const isMe = p.uid === user.uid;

            return (
              <div 
                key={p.uid}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className={`relative flex flex-col items-center gap-1 md:gap-2 ${p.isFolded ? 'opacity-40 grayscale' : ''}`}>
                  {/* Cards Display - Smaller for Landscape */}
                  <div className="flex -space-x-4 md:-space-x-8 mb-1 md:mb-2">
                    {p.cards.length > 0 && p.cards.map((c, ci) => (
                      <motion.div
                        key={ci}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: ci * 0.1 }}
                      >
                        <PlayingCard 
                          card={c} 
                          hidden={!isMe && gameState?.status !== 'showdown'} 
                          small 
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Player Info Box - Compact */}
                  <div className={`
                    relative p-1.5 md:p-3 rounded-xl md:rounded-2xl border-2 transition-all min-w-[80px] md:min-w-[140px] text-center
                    ${isTurn ? 'bg-red-600 border-white shadow-[0_0_30px_rgba(220,38,38,0.5)] scale-110' : 'bg-zinc-900 border-white/10'}
                  `}>
                    {isTurn && (
                      <div className="absolute -top-2 md:-top-3 left-1/2 -translate-x-1/2 bg-white text-red-600 text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
                        THINKING...
                      </div>
                    )}
                    <div className="flex items-center gap-1 md:gap-2 justify-center mb-0.5 md:mb-1">
                      <img src={p.photoURL} className="w-4 h-4 md:w-6 md:h-6 rounded-full border border-white/20" alt="" />
                      <span className="text-[10px] md:text-sm font-black truncate max-w-[50px] md:max-w-[80px]">{p.name}</span>
                    </div>
                    <div className="text-[10px] md:text-xs font-bold text-zinc-400 flex items-center justify-center gap-1">
                      <Coins className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      {p.chips.toLocaleString()}
                    </div>
                    {p.lastAction && (
                      <div className="mt-1 text-[8px] md:text-[10px] font-black text-red-400 uppercase tracking-tighter">
                        {p.lastAction}
                      </div>
                    )}
                  </div>

                  {/* Status Badges */}
                  <div className="flex gap-1">
                    {p.isSeen && <span className="bg-blue-500 text-[8px] md:text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Seen</span>}
                    {!p.isSeen && !p.isFolded && <span className="bg-zinc-700 text-[8px] md:text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Blind</span>}
                    {p.isReady && gameState?.status === 'waiting' && <span className="bg-emerald-500 text-[8px] md:text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Ready</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Dashboard - Compact for Landscape */}
      <footer className="p-2 md:p-6 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 z-50">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 md:gap-4">
          {/* Left: Player Info - Hidden on very small height */}
          <div className="hidden sm:flex items-center gap-2 md:gap-4">
            <div className="relative">
              <img src={user.photoURL} className="w-8 h-8 md:w-14 md:h-14 rounded-xl md:rounded-2xl border-2 border-white/10" alt="" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 md:w-5 md:h-5 bg-emerald-500 border-2 md:border-4 border-zinc-900 rounded-full" />
            </div>
            <div>
              <div className="text-[10px] md:text-sm font-bold text-zinc-500 uppercase tracking-widest">Logged In As</div>
              <div className="text-xs md:text-xl font-black">{user.displayName}</div>
            </div>
          </div>

          {/* Center: Game Controls - More Compact */}
          <div className="flex-1 flex items-center justify-center gap-1 md:gap-3">
            {gameState?.status === 'waiting' ? (
              <div className="flex gap-2">
                <button 
                  onClick={toggleReady}
                  className={`px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl font-black text-sm md:text-xl transition-all active:scale-95 shadow-xl ${currentPlayer?.isReady ? 'bg-emerald-600 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                >
                  {currentPlayer?.isReady ? 'READY!' : 'READY TO PLAY'}
                </button>
                {currentPlayer?.role === 'admin' && players.filter(p => p.isReady).length >= 2 && (
                  <button 
                    onClick={startGame}
                    className="px-4 md:px-8 py-2 md:py-4 bg-red-600 text-white rounded-xl md:rounded-2xl font-black text-sm md:text-xl hover:bg-red-500 transition-all active:scale-95 shadow-xl shadow-red-600/20"
                  >
                    START ROUND
                  </button>
                )}
              </div>
            ) : isMyTurn ? (
              <div className="flex flex-wrap justify-center gap-1 md:gap-3">
                <button 
                  onClick={fold}
                  className="px-3 md:px-6 py-2 md:py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg md:rounded-2xl font-black text-[10px] md:text-lg transition-all"
                >
                  FOLD
                </button>
                
                {!currentPlayer?.isSeen && (
                  <button 
                    onClick={seeCards}
                    className="px-3 md:px-6 py-2 md:py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg md:rounded-2xl font-black text-[10px] md:text-lg transition-all flex items-center gap-1 md:gap-2"
                  >
                    <Eye className="w-3 h-3 md:w-5 md:h-5" /> SEE
                  </button>
                )}

                <button 
                  onClick={() => placeBet(1)}
                  className="px-3 md:px-6 py-2 md:py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg md:rounded-2xl font-black text-[10px] md:text-lg transition-all"
                >
                  CHAAL (1x)
                </button>

                <button 
                  onClick={() => placeBet(2)}
                  className="px-3 md:px-6 py-2 md:py-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg md:rounded-2xl font-black text-[10px] md:text-lg transition-all"
                >
                  DOUBLE (2x)
                </button>

                {players.filter(p => !p.isFolded && gameState.players.includes(p.uid)).length > 2 && (
                  <button 
                    onClick={requestSideShow}
                    className="px-3 md:px-6 py-2 md:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg md:rounded-2xl font-black text-[10px] md:text-lg transition-all"
                  >
                    SIDE SHOW
                  </button>
                )}

                {players.filter(p => !p.isFolded && gameState.players.includes(p.uid)).length === 2 && (
                  <button 
                    onClick={show}
                    className="px-3 md:px-6 py-2 md:py-4 bg-red-600 hover:bg-red-500 text-white rounded-lg md:rounded-2xl font-black text-[10px] md:text-lg transition-all"
                  >
                    SHOW
                  </button>
                )}
              </div>
            ) : (
              <div className="text-zinc-500 font-black text-xs md:text-2xl uppercase tracking-widest animate-pulse">
                {gameState?.status === 'playing' ? "Waiting for opponent's move..." : "Round ending..."}
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* Side Show Prompt - Compact for Landscape */}
      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-white/10 p-4 md:p-8 rounded-2xl md:rounded-[2rem] text-center max-w-sm shadow-2xl"
            >
              <h3 className="text-xl md:text-2xl font-black mb-1 md:mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-xs md:text-base text-white/60 mb-4 md:mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands with you.</p>
              <div className="flex gap-2 md:gap-4">
                <button 
                  onClick={() => respondSideShow(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all text-[10px] md:text-sm"
                >
                  Deny
                </button>
                <button 
                  onClick={() => respondSideShow(true)}
                  className="flex-1 bg-red-600 hover:bg-red-500 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 text-[10px] md:text-sm"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel - Compact for Landscape */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 w-full max-w-lg rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-red-500" />
                  <h3 className="text-xl font-black">ADMIN CONTROL</h3>
                </div>
                <button onClick={() => setIsAdminPanelOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto flex-1">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Global Actions</h4>
                  <button 
                    onClick={resetGame}
                    className="w-full py-3 md:py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl font-bold border border-red-500/20 transition-all text-sm md:text-base"
                  >
                    FORCE RESET GAME STATE
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Player Management</h4>
                  <div className="space-y-2">
                    {players.map(p => (
                      <div key={p.uid} className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2 md:gap-3">
                          <img src={p.photoURL} className="w-6 h-6 md:w-10 md:h-10 rounded-lg" alt="" />
                          <div>
                            <div className="font-bold text-xs md:text-sm">{p.name}</div>
                            <div className="text-[10px] md:text-xs text-zinc-500">{p.chips.toLocaleString()} Chips</div>
                          </div>
                        </div>
                        <div className="flex gap-1 md:gap-2">
                          <button 
                            onClick={() => addChips(p.uid, 1000)}
                            className="px-2 md:px-3 py-1 md:py-2 bg-emerald-600/20 text-emerald-500 rounded-lg text-[10px] md:text-xs font-bold"
                          >
                            +1K
                          </button>
                          <button 
                            onClick={() => addChips(p.uid, 10000)}
                            className="px-2 md:px-3 py-1 md:py-2 bg-emerald-600/20 text-emerald-500 rounded-lg text-[10px] md:text-xs font-bold"
                          >
                            +10K
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
