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
  User,
  Lock,
  Hash,
  Minimize2,
  Maximize2,
  ChevronRight,
  Hand,
  Settings,
  Plus,
  RefreshCw,
  Disc,
  Volume2,
  VolumeX,
  Music,
  CreditCard,
  Camera,
  Search,
  MessageCircle,
  X,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundService } from './services/soundService.js';

// --- Types ---
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

// Custom Asset URLs
const ASSETS = {
  LOGO: "https://i.imgur.com/swQATPt.png",
  TABLE_BG: "https://i.imgur.com/Wupafhm.png",
  SPLASH_BG: "https://i.imgur.com/Gg4BaeV.png",
  DEALER: "https://i.imgur.com/Wwp3cG0.png"
};

interface Card {
  suit: Suit;
  rank: Rank;
}

interface Player {
  id: string;
  name: string;
  chips: number;
  xp?: number;
  tier?: string;
  hand: Card[];
  isFolded: boolean;
  isBlind: boolean;
  currentBet: number;
  isBot?: boolean;
  profilePic?: string;
  uid?: string;
}

interface GameState {
  players: Player[];
  pot: number;
  currentTurn: number;
  lastBet: number;
  gameStarted: boolean;
  winner: string | null;
  roundCount: number;
  type?: string;
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

const TIERS = [
  { name: 'Bronze', minXP: 0, icon: '🥇', color: 'text-orange-400' },
  { name: 'Silver', minXP: 500, icon: '🥈', color: 'text-slate-300' },
  { name: 'Gold', minXP: 1500, icon: '🥉', color: 'text-yellow-400' },
  { name: 'Platinum', minXP: 3000, icon: '🔷', color: 'text-cyan-400' },
  { name: 'Diamond', minXP: 6000, icon: '💎', color: 'text-blue-400' },
  { name: 'Master', minXP: 10000, icon: '🔥', color: 'text-red-500' },
  { name: 'Grandmaster', minXP: 15000, icon: '🏆', color: 'text-purple-500' },
  { name: 'Legend', minXP: 30000, icon: '👑', color: 'text-yellow-500' },
];

const getTier = (xp: number) => {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXP) return TIERS[i];
  }
  return TIERS[0];
};

// --- Utilities ---
const formatChips = (amount: number): string => {
  if (!isFinite(amount) || amount === null || amount === undefined) return '0';
  if (amount >= 1e12) {
    return (amount / 1e12).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' trillion';
  }
  if (amount >= 1e9) {
    return (amount / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (amount >= 1e6) {
    return (amount / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (amount >= 1e3) {
    return (amount / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return amount.toString();
};

// --- Components ---

interface CardComponentProps {
  card: Card;
  hidden: boolean;
  index: number;
  key?: string | number;
}

const CardComponent = ({ card, hidden, index }: CardComponentProps) => {
  const tilt = useMemo(() => (index - 1) * 8, [index]);
  
  useEffect(() => {
    if (!hidden) {
      soundService.play('flip');
    } else {
      soundService.play('deal');
    }
  }, [hidden]);

  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: 180, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotate: tilt, opacity: 1 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 120, damping: 12 }}
      className={`relative w-12 h-18 md:w-24 md:h-32 rounded-lg md:rounded-xl shadow-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${hidden ? 'bg-zinc-900 border-red-900/50' : 'bg-white border-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.15)]'}`}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-800 via-red-950 to-black rounded-lg md:rounded-xl border border-red-500/30 overflow-hidden relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '10px 10px' }}></div>
          <div className="w-8 h-12 border-2 border-red-500/40 rounded-md flex items-center justify-center rotate-45 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            <div className="text-red-500 font-black text-lg -rotate-45 tracking-tighter drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">L</div>
          </div>
          <div className="absolute top-1 left-1 text-[5px] text-red-500/60 font-black uppercase tracking-widest">Lucifer</div>
          <div className="absolute bottom-1 right-1 text-[5px] text-red-500/60 font-black uppercase tracking-widest rotate-180">Lucifer</div>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 font-black text-[10px] md:text-2xl leading-none ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
          <div className={`text-xl md:text-6xl drop-shadow-md ${SUIT_COLORS[card.suit]}`}>
            {SUIT_SYMBOLS[card.suit]}
          </div>
          <div className={`absolute bottom-1 right-1 font-black text-[10px] md:text-2xl leading-none rotate-180 ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </div>
          <div className={`absolute top-1 right-1 text-[6px] md:text-[10px] opacity-20 ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={`absolute bottom-1 left-1 text-[6px] md:text-[10px] opacity-20 rotate-180 ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
        </>
      )}
    </motion.div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('table-1');
  const [joined, setJoined] = useState(false);
  const [view, setView] = useState<'splash' | 'login' | 'lobby' | 'game'>('splash');
  const [isConnected, setIsConnected] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'players' | 'manual'>('players');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('50000');
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [lobbyChips, setLobbyChips] = useState<number>(50000);
  const [lobbyXP, setLobbyXP] = useState<number>(0);
  const [sideShowPrompt, setSideShowPrompt] = useState<{ fromName: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [gameNotification, setGameNotification] = useState<string | null>(null);
  const [lastSpinTime, setLastSpinTime] = useState<number>(0);
  const [lastBonusTime, setLastBonusTime] = useState<number>(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [soundSettings, setSoundSettings] = useState(soundService.getSettings());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showContactUs, setShowContactUs] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, timestamp: string}[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = useMemo(() => name.trim().toUpperCase() === 'LUCIFER_ADMIN_777', [name]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement || !!(document as any).msFullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleFirstInteraction = () => {
      soundService.init();
      // Remove listeners after first interaction
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('mousedown', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('mousedown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('mousedown', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (!gameState || view !== 'game') return;

    const oldWinner = prevGameState.current?.winner;
    const oldGameStarted = prevGameState.current?.gameStarted;

    if (gameState.winner && !oldWinner) {
      const myPlayer = gameState.players.find(p => p.id === socket?.id);
      if (gameState.winner === myPlayer?.name) {
        soundService.play('win');
        confetti({ particleCount: 150, spread: 70 });
      } else {
        soundService.play('lose');
      }
    }

    if (gameState.gameStarted && !oldGameStarted) {
      soundService.play('shuffle');
    }

    prevGameState.current = gameState;
  }, [gameState, view, socket]);

  const prevGameState = React.useRef<GameState | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('loginSuccess', (data: { name: string, chips: number, xp: number, last_spin: number, last_bonus: number, profilePic?: string, uid?: string }) => {
      setName(data.name);
      setLobbyChips(data.chips);
      setLobbyXP(data.xp || 0);
      setLastSpinTime(data.last_spin);
      setLastBonusTime(data.last_bonus || 0);
      if (data.profilePic) setProfilePic(data.profilePic);
      if (data.uid) setUid(data.uid);
      setView('lobby');
      localStorage.setItem('lucifer_poker_name', data.name);
    });

    socket.on('chipsUpdated', (newChips: number) => {
      setLobbyChips(newChips);
    });

    socket.on('profilePicUpdated', (url: string) => {
      setProfilePic(url);
    });

    socket.on('gameState', (state: GameState) => {
      setGameState(state);
    });

    socket.on('gameNotification', (data: { message: string }) => {
      setGameNotification(data.message);
      setTimeout(() => setGameNotification(null), 4000);
    });

    socket.on('adminStats', (stats: any[]) => setAdminStats(stats));
    socket.on('adminMessage', (msg: string) => {
      setAdminMessage(msg);
      setTimeout(() => setAdminMessage(''), 3000);
    });

    socket.on('error', (msg: string) => {
      alert(msg);
      if (msg.includes("chips")) {
        setJoined(false);
        setView('lobby');
      } else {
        setJoined(false);
        setView('login');
      }
    });

    socket.on('sideShowPrompt', (data: { fromId: string, fromName: string }) => {
      setSideShowPrompt(data);
    });

    socket.on('spinResult', (data: { prize: string, chips: number, lastSpin: number }) => {
      soundService.play('win');
      setIsSpinning(false);
      setSpinResult(data.prize);
      setLastSpinTime(data.lastSpin);
      setLobbyChips(data.chips);
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
      setTimeout(() => setSpinResult(null), 5000);
    });

    socket.on('spinError', (data: { message: string }) => {
      setIsSpinning(false);
      alert(data.message);
    });

    socket.on('bonusResult', (data: { amount: number, chips: number, lastBonus: number }) => {
      soundService.play('win');
      setLobbyChips(data.chips);
      setLastBonusTime(data.lastBonus);
      setGameNotification(`Collected ${formatChips(data.amount)} Bonus!`);
      confetti({ particleCount: 100, spread: 50, origin: { y: 0.8 } });
      setTimeout(() => setGameNotification(null), 3000);
    });

    socket.on('bonusError', (data: { message: string }) => {
      alert(data.message);
    });

    socket.on('leaderboardData', (data: any[]) => {
      setLeaderboardData(data);
    });

    socket.on('chatMessage', (msg: {sender: string, message: string, timestamp: string}) => {
      setChatMessages(prev => [...prev.slice(-49), msg]);
      
      // Play sound and update unread count if chat is closed or message is from someone else
      if (msg.sender !== localStorage.getItem('lucifer_poker_name')) {
        soundService.play('chat');
        if (!isChatOpen) {
          setUnreadCount(prev => prev + 1);
        }
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket?.connected) {
        // Request fresh state if we were away
        const currentRoom = localStorage.getItem('lastRoomId');
        if (currentRoom) {
          socket.emit('joinRoom', { roomId: currentRoom, name });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.off('loginSuccess');
      socket.off('chipsUpdated');
      socket.off('profilePicUpdated');
      socket.off('gameState');
      socket.off('gameNotification');
      socket.off('adminStats');
      socket.off('adminMessage');
      socket.off('error');
      socket.off('sideShowPrompt');
      socket.off('spinResult');
      socket.off('spinError');
      socket.off('chatMessage');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket]);

  useEffect(() => {
    const newSocket = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      autoConnect: true,
      randomizationFactor: 0.5
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });
    
    newSocket.on('connect_error', (err) => {
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (gameState?.turnStartTime && gameState?.turnDuration) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - gameState.turnStartTime!;
        const remaining = Math.max(0, Math.ceil((gameState.turnDuration! - elapsed) / 1000));
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [gameState?.turnStartTime, gameState?.turnDuration, gameState?.currentTurn]);

  useEffect(() => {
    const timer = setTimeout(() => setView('login'), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      window.scrollTo(0, 0);
      if (window.innerWidth > window.innerHeight && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const joinRoom = (type?: string, tableId?: string) => { 
    if (socket && name) { 
      soundService.play('click');
      soundService.init(); 
      const rid = tableId || roomId;
      setRoomId(rid);
      socket.emit('joinRoom', { roomId: rid, name, password, roomType: type }); 
      setJoined(true); 
      setView('game');
    } 
  };

  const login = async () => {
    if (!name) return;
    soundService.play('click');
    socket?.emit('login', { name, password });
  };

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (view !== 'game' && joined && socket && roomId) {
      socket.emit('leaveRoom', roomId);
      setJoined(false);
      setGameState(null);
    }
  }, [view, joined, socket, roomId]);

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socket || !roomId) return;
    socket.emit('chatMessage', { roomId, message: chatInput });
    setChatInput('');
  };

  const logout = () => {
    soundService.play('click');
    setJoined(false);
    setView('lobby');
    setGameState(null);
    setChatMessages([]);
    if (socket && roomId) {
      socket.emit('leaveRoom', roomId);
    }
  };

  const fullLogout = () => {
    soundService.play('click');
    if (socket && roomId && joined) {
      socket.emit('leaveRoom', roomId);
    }
    setName('');
    setJoined(false);
    setView('login');
    setGameState(null);
    setChatMessages([]);
    localStorage.removeItem('lucifer_poker_name');
  };
  const startGame = () => {
    soundService.play('click');
    socket?.emit('startGame', roomId);
  };
  
  const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert("Image too large! Please choose an image under 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      socket?.emit('updateProfilePic', { name, profilePic: base64 });
    };
    reader.readAsDataURL(file);
  };
  
  const takeAction = (action: string, amount?: number) => {
    if (action === 'fold') {
      soundService.play('fold');
    } else if (['chaal', 'raise', 'see'].includes(action)) {
      soundService.play('bet');
    } else {
      soundService.play('click');
    }

    if (action === 'chaal' || action === 'raise' || action === 'show') {
      const bet = action === 'show'
        ? (currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)
        : (action === 'chaal' 
          ? (currentPlayer?.isBlind ? gameState?.lastBet : (gameState?.lastBet || 0) * 2)
          : (currentPlayer?.isBlind ? (gameState?.lastBet || 0) + (amount || 0) : ((gameState?.lastBet || 0) + (amount || 0)) * 2));
      
      if (currentPlayer && currentPlayer.chips < (bet || 0)) {
        alert("Not enough chips!");
        return;
      }
    }
    socket?.emit('action', { roomId, action, amount });
  };

  const handleSideShow = () => {
    soundService.play('click');
    socket?.emit('sideShowRequest', roomId);
  };

  const respondSideShow = (accepted: boolean) => {
    soundService.play('click');
    socket?.emit('sideShowResponse', { roomId, accepted });
    setSideShowPrompt(null);
  };

  const handleRaise = () => {
    const amount = prompt("Enter Raise Amount (Unlimited):", "1000000");
    if (amount && !isNaN(parseInt(amount))) {
      const raiseAmount = parseInt(amount);
      const newLastBet = (gameState?.lastBet || 0) + raiseAmount;
      const totalBet = currentPlayer?.isBlind ? newLastBet : newLastBet * 2;
      
      if (currentPlayer && currentPlayer.chips < totalBet) {
        alert(`Not enough chips! You need ${formatChips(totalBet)} $(USD) for this raise.`);
        return;
      }
      takeAction('raise', raiseAmount);
    }
  };

  const openAdminPanel = () => {
    if (adminPassword === "LUCIFER_PASS_999") {
      setShowAdminPanel(true);
      socket?.emit('getAdminStats', { adminName: name, adminPassword });
      return;
    }
    
    const pass = prompt("Enter Admin Dashboard Password:", "");
    if (pass === "LUCIFER_PASS_999") {
      setAdminPassword(pass);
      setShowAdminPanel(true);
      socket?.emit('getAdminStats', { adminName: name, adminPassword: pass });
    } else if (pass !== null) {
      alert("Access Denied: Invalid Admin Password!");
    }
  };

  const refreshAdminStats = () => socket?.emit('getAdminStats', { adminName: name, adminPassword });
  
  const adminAction = (targetName: string | null, type: 'add' | 'reset' | 'set' | 'resetAll' | 'delete', amount: number = 0) => {
    socket?.emit('adminAction', { adminName: name, adminPassword, targetName, type, amount });
  };

  const handleAdminAdd = (targetName: string) => {
    const amount = prompt(`Enter amount to add for ${targetName}:`, "50000");
    if (amount && !isNaN(parseInt(amount))) {
      adminAction(targetName, 'add', parseInt(amount));
    }
  };

  const handleAdminSet = (targetName: string) => {
    const amount = prompt(`Enter exact chips for ${targetName}:`, "50000");
    if (amount && !isNaN(parseInt(amount))) {
      adminAction(targetName, 'set', parseInt(amount));
    }
  };

  const handleSpin = () => {
    if (isSpinning) return;
    soundService.play('click');
    setIsSpinning(true);
    
    const timeout = setTimeout(() => {
      setIsSpinning(prev => {
        if (prev) {
          alert("Spin timed out. Please try again.");
          return false;
        }
        return prev;
      });
    }, 10000);

    socket?.emit('spinWheel', { name });
    
    // Clear timeout if result comes back
    const resultHandler = () => clearTimeout(timeout);
    socket?.once('spinResult', resultHandler);
    socket?.once('spinError', resultHandler);
  };

  const handleCollectBonus = () => {
    soundService.play('click');
    socket?.emit('collectBonus', { name });
  };

  const openLeaderboard = () => {
    soundService.play('click');
    setShowLeaderboard(true);
    socket?.emit('getLeaderboard');
  };

  const rotatedPlayers = useMemo(() => {
    if (!gameState) return [];
    const players = [...gameState.players];
    const myIndex = players.findIndex(p => p.id === socket?.id);
    if (myIndex === -1) return players;
    
    const rotated = [];
    for (let i = 0; i < players.length; i++) {
      rotated.push(players[(myIndex + i) % players.length]);
    }
    return rotated;
  }, [gameState, socket]);

  const currentPlayer = useMemo(() => gameState?.players.find(p => p.id === socket?.id), [gameState, socket]);
  const isMyTurn = useMemo(() => gameState?.players[gameState.currentTurn]?.id === socket?.id, [gameState, socket]);

  const canSideShow = useMemo(() => {
    if (!gameState || !isMyTurn || !currentPlayer || currentPlayer.isBlind) return false;
    let prevIdx = (gameState.currentTurn - 1 + gameState.players.length) % gameState.players.length;
    let count = 0;
    while (gameState.players[prevIdx].isFolded && count < gameState.players.length) {
      prevIdx = (prevIdx - 1 + gameState.players.length) % gameState.players.length;
      count++;
    }
    return !gameState.players[prevIdx].isBlind;
  }, [gameState, isMyTurn, currentPlayer]);

  const activePlayersCount = useMemo(() => gameState?.players.filter(p => !p.isFolded).length || 0, [gameState]);

  const canShow = useMemo(() => {
    return isMyTurn && gameState?.gameStarted && !gameState.winner && activePlayersCount === 2;
  }, [isMyTurn, gameState, activePlayersCount]);

  const toggleFullscreen = () => {
    soundService.play('click');
    try {
      const doc = window.document as any;
      const elem = doc.documentElement;

      if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
        const request = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
        if (request) request.call(elem);
      } else {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exit) exit.call(doc);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const toggleMute = () => {
    soundService.toggleMute();
    setSoundSettings(soundService.getSettings());
  };

  const toggleMusic = () => {
    soundService.toggleMusic();
    setSoundSettings(soundService.getSettings());
  };

  if (view === 'splash') {
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
          className="relative z-10 mt-4 text-3xl md:text-5xl font-poker text-emerald-500 tracking-tighter text-center uppercase drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]"
        >
          TEEN PATTI LUCIFER
        </motion.h1>
        <div className="relative z-10 mt-4 text-white/40 font-bold uppercase tracking-[0.5em] text-[10px]">Loading Underworld...</div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="fixed inset-0 bg-black text-white font-sans overflow-hidden flex flex-col select-none touch-none">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img src="https://i.imgur.com/oEnM0Fz.png" alt="Background" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-end p-4 pb-16 md:pb-24">
          <div className="w-full max-w-md bg-black/10 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center relative overflow-hidden mb-8">
            <div className="relative z-10">
              <p className="text-white/80 text-sm mb-8 font-bold tracking-wide drop-shadow-lg">50K Chips & Lucifer Bots Active!</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full bg-black/20 p-4 pl-12 rounded-2xl border border-white/20 outline-none focus:border-red-600 transition-all font-bold text-white placeholder:text-white/20" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Set/Enter Password" className="w-full bg-black/20 p-4 pl-12 rounded-2xl border border-white/20 outline-none focus:border-red-600 transition-all font-bold text-white placeholder:text-white/20" />
                </div>
                <button onClick={login} disabled={!name} className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl hover:bg-red-500 transition-all active:scale-95 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] border-b-4 border-red-800">
                  ENTER UNDERWORLD
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-center">
            Copyright © 2026 Lucifer Games Studio. All Rights Reserved.
          </div>
        </div>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
        {/* Immersive Casino Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img 
            src="https://i.imgur.com/Ub14p8N.png" 
            alt="Casino Background" 
            className="w-full h-full object-cover opacity-50" 
            referrerPolicy="no-referrer" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>

        {/* Header */}
        <header className="relative z-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl p-2 pr-4 rounded-2xl border border-white/10 shadow-2xl min-w-0 max-w-[60%]">
            <div className="relative group shrink-0 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-900 rounded-full flex items-center justify-center shadow-lg overflow-hidden relative z-10 border-2 border-white/10">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 md:w-7 md:h-7 text-white/50" />
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity z-30">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                </label>
              </div>
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0a0a0a] rounded-full z-30" />
            </div>
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-xs md:text-sm font-black text-white uppercase tracking-tight truncate">{name}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-black uppercase tracking-wider ${getTier(lobbyXP).color}`}>
                  {getTier(lobbyXP).icon} {getTier(lobbyXP).name}
                </span>
                <span className="text-[8px] text-white/30 font-bold">({lobbyXP} XP)</span>
              </div>
              <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest truncate">UID: {uid || 'Loading...'}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <Coins className="w-3 h-3 text-yellow-500 shrink-0" />
                <span className="text-[10px] md:text-xs font-black text-yellow-500 truncate">{formatChips(lobbyChips)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
             {isAdmin && (
               <button 
                 onClick={openAdminPanel}
                 className="p-2 md:p-3 bg-red-600/10 hover:bg-red-600/20 rounded-xl border border-red-500/20 transition-all text-red-500"
                 title="Admin Panel"
               >
                 <Trophy className="w-4 h-4 md:w-5 md:h-5" />
               </button>
             )}
             <button onClick={toggleFullscreen} className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all">
                {isFullscreen ? <Minimize2 className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize2 className="w-4 h-4 md:w-5 md:h-5" />}
             </button>
             <button onClick={fullLogout} className="p-2 md:p-3 bg-red-600/10 hover:bg-red-600/20 rounded-xl border border-red-500/20 transition-all group">
                <LogOut className="w-4 h-4 md:w-5 md:h-5 text-red-500 group-hover:scale-110 transition-transform" />
             </button>
          </div>
        </header>

        {/* Circular Lobby Layout */}
        <main className="relative z-10 flex-1 flex items-center justify-center">
          <div className="relative w-[280px] h-[280px] md:w-[400px] md:h-[400px] flex items-center justify-center">
            {/* Central Logo Hub */}
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className="relative z-20 w-28 h-28 md:w-40 md:h-40 bg-gradient-to-br from-red-600/80 to-red-950/80 rounded-full border-4 border-red-500/50 shadow-[0_0_50px_rgba(220,38,38,0.5)] flex items-center justify-center overflow-hidden group"
              style={{ 
                backgroundImage: `url('https://i.imgur.com/9jpJ7hQ.png')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundBlendMode: 'overlay'
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50" />
              <div className="text-center z-10">
                <div className="font-poker text-xl md:text-3xl text-white leading-none drop-shadow-2xl">LUCIFER</div>
                <div className="text-[7px] md:text-[9px] font-black text-red-200 uppercase tracking-[0.3em] mt-1">Underworld</div>
              </div>
              {/* Spinning outer ring */}
              <div className="absolute inset-0 border-4 border-dashed border-red-400/20 rounded-full animate-spin-slow" />
            </motion.div>

            {/* Radial Buttons */}
            <div className="absolute inset-0">
              {/* Play Now - Top */}
              <motion.button
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => joinRoom('PLAY_NOW', 'table-1')}
                className="absolute top-4 left-1/2 -translate-x-1/2 -translate-y-1/2 group"
              >
                <div 
                  className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-b from-emerald-400/80 to-emerald-800/80 rounded-full border-4 border-emerald-300/30 shadow-2xl flex flex-col items-center justify-center p-2 transition-all group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] overflow-hidden relative"
                  style={{ 
                    backgroundImage: `url('https://i.imgur.com/9jpJ7hQ.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                  }}
                >
                  <Play className="w-6 h-6 md:w-10 md:h-10 text-white mb-1" />
                  <span className="font-poker text-[8px] md:text-lg text-white uppercase">Play Now</span>
                </div>
              </motion.button>

              {/* No Limit - Right */}
              <motion.button
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => joinRoom('NO_LIMIT', 'nolimit-1')}
                className="absolute top-1/2 right-4 translate-x-1/2 -translate-y-1/2 group"
              >
                <div 
                  className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-b from-orange-400/80 to-red-800/80 rounded-full border-4 border-orange-300/30 shadow-2xl flex flex-col items-center justify-center p-2 transition-all group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] overflow-hidden relative"
                  style={{ 
                    backgroundImage: `url('https://i.imgur.com/9jpJ7hQ.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                  }}
                >
                  <Trophy className="w-6 h-6 md:w-10 md:h-10 text-white mb-1" />
                  <span className="font-poker text-[8px] md:text-lg text-white uppercase leading-none text-center">No Limit<br/>Table</span>
                </div>
              </motion.button>

              {/* Private Table - Bottom */}
              <motion.button
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => {
                  const code = prompt("Enter Table Code (Number):");
                  if (code && !isNaN(Number(code))) {
                    joinRoom('PRIVATE', 'private-' + code);
                  }
                }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-1/2 group"
              >
                <div 
                  className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-b from-purple-500/80 to-indigo-900/80 rounded-full border-4 border-purple-300/30 shadow-2xl flex flex-col items-center justify-center p-2 transition-all group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] overflow-hidden relative"
                  style={{ 
                    backgroundImage: `url('https://i.imgur.com/9jpJ7hQ.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                  }}
                >
                  <Lock className="w-6 h-6 md:w-10 md:h-10 text-white mb-1" />
                  <span className="font-poker text-[8px] md:text-lg text-white uppercase leading-none text-center">Private<br/>Table</span>
                </div>
              </motion.button>

              {/* Lucky Spin - Left */}
              <motion.button
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setShowSpinWheel(true)}
                className="absolute top-1/2 left-4 -translate-x-1/2 -translate-y-1/2 group"
              >
                <div 
                  className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-b from-yellow-400/80 to-amber-700/80 rounded-full border-4 border-yellow-300/30 shadow-2xl flex flex-col items-center justify-center p-2 transition-all group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] overflow-hidden relative"
                  style={{ 
                    backgroundImage: `url('https://i.imgur.com/9jpJ7hQ.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                  }}
                >
                  <Disc className="w-6 h-6 md:w-10 md:h-10 text-white mb-1 animate-spin-slow" />
                  <span className="font-poker text-[8px] md:text-lg text-white uppercase">Lucky Spin</span>
                </div>
              </motion.button>
            </div>
          </div>
        </main>

        {/* Footer Navigation Removed per request */}
        <div className="h-6" />

        {/* How to Play Button */}
        <div className="absolute bottom-6 left-6 z-50">
          <button 
            onClick={() => setShowHowToPlay(true)}
            className="group relative flex flex-col items-center gap-1 transition-transform active:scale-95"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border border-white/10 shadow-2xl group-hover:border-yellow-500/50 transition-all">
              <img src="https://i.imgur.com/IncdBH7.png" alt="How to Play" className="w-full h-full object-cover" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover:text-white">How to Play</span>
          </button>
        </div>

        {/* Daily Bonus Button */}
        <div className="absolute bottom-6 left-24 md:left-28 z-50">
          <button 
            onClick={handleCollectBonus}
            className="group relative flex flex-col items-center gap-1 transition-transform active:scale-95"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border border-white/10 shadow-2xl group-hover:border-yellow-500/50 transition-all bg-black/40 p-2">
              <img src="https://i.imgur.com/62odWX1.png" alt="Daily Bonus" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover:text-yellow-500">Daily Bonus</span>
          </button>
        </div>

        {/* Leaderboard Button */}
        <div className="absolute bottom-6 left-[176px] md:left-[200px] z-50">
          <button 
            onClick={openLeaderboard}
            className="group relative flex flex-col items-center gap-1 transition-transform active:scale-95"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border border-white/10 shadow-2xl group-hover:border-yellow-500/50 transition-all bg-black/40 p-2">
              <img src="https://i.imgur.com/tho01us.png" alt="Leaderboard" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover:text-yellow-500">Leaderboard</span>
          </button>
        </div>

        {/* Contact Us Button */}
        <div className="absolute bottom-6 right-6 z-50">
          <button 
            onClick={() => setShowContactUs(true)}
            className="group relative flex flex-col items-center gap-1 transition-transform active:scale-95"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border border-white/10 shadow-2xl group-hover:border-red-500/50 transition-all bg-black/40 p-2">
              <img src="https://i.imgur.com/GnVwYc9.png" alt="Contact Us" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover:text-red-500">Contact Us</span>
          </button>
        </div>

        {/* Modals available in Lobby */}
        <AnimatePresence>
          {showHowToPlay && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHowToPlay(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                  <h2 className="text-xl font-black uppercase tracking-tighter text-yellow-500">How to Play</h2>
                  <button onClick={() => setShowHowToPlay(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                    <LogOut className="w-5 h-5 text-white/40" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar">
                  <img 
                    src="https://i.imgur.com/fpPwhJk.png" 
                    alt="Instructions" 
                    className="w-full h-auto rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            </div>
          )}

          {showLeaderboard && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLeaderboard(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                className="relative w-full max-w-2xl max-h-[85vh] bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-red-600/20 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-2xl border border-yellow-500/20">
                      <Trophy className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Top Players</h2>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Global Chip Rankings</p>
                    </div>
                  </div>
                  <button onClick={() => setShowLeaderboard(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-colors">
                    <LogOut className="w-6 h-6 text-white/40" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-3">
                  {leaderboardData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                      <Disc className="w-12 h-12 animate-spin-slow mb-4" />
                      <span className="font-black uppercase tracking-widest text-sm">Loading Rankings...</span>
                    </div>
                  ) : (
                    leaderboardData.map((player, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={player.uid || player.name}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          idx === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 
                          idx === 1 ? 'bg-zinc-400/10 border-zinc-400/30' :
                          idx === 2 ? 'bg-orange-600/10 border-orange-600/30' :
                          'bg-white/5 border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                            idx === 0 ? 'text-yellow-500' : 
                            idx === 1 ? 'text-zinc-400' :
                            idx === 2 ? 'text-orange-600' :
                            'text-white/20'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 bg-zinc-800 shrink-0">
                            {player.profilePic ? (
                              <img src={player.profilePic} alt={player.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="w-6 h-6 text-white/20" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-white uppercase tracking-tight truncate max-w-[120px] md:max-w-[200px]">
                              {player.name}
                            </span>
                            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                              UID: {player.uid || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5 text-yellow-500 font-black text-sm md:text-lg">
                            <Coins className="w-4 h-4" />
                            {formatChips(player.chips)}
                          </div>
                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Total Chips</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {showContactUs && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowContactUs(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-8 items-center text-center"
              >
                <div className="w-20 h-20 bg-red-600/20 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
                  <img src="https://i.imgur.com/GnVwYc9.png" alt="Contact" className="w-12 h-12 object-contain" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Contact Us</h2>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-6">Have questions or issues?</p>
                
                <a 
                  href="mailto:lucifergamesstudio@gmail.com" 
                  className="group bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl w-full transition-all flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Email Support</span>
                  <span className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">lucifergamesstudio@gmail.com</span>
                </a>

                <button 
                  onClick={() => setShowContactUs(false)}
                  className="mt-8 text-white/20 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSpinWheel && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSpinning && setShowSpinWheel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                className="relative w-full max-w-lg bg-[#0a0a0a] border border-yellow-500/20 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(234,179,8,0.2)] p-8 flex flex-col items-center"
              >
                <div className="absolute top-6 right-6">
                  <button onClick={() => !isSpinning && setShowSpinWheel(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <LogOut className="w-6 h-6 text-white/40" />
                  </button>
                </div>

                <div className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Daily Reward</div>
                <h2 className="text-3xl font-black text-white mb-8 tracking-tighter">LUCIFER <span className="text-yellow-500">SPIN</span></h2>

                <div className="relative w-64 h-64 md:w-80 md:h-80 mb-8">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-white rounded-full shadow-2xl flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[20px] border-t-red-600" />
                  </div>

                  <motion.div 
                    animate={isSpinning ? { rotate: 360 * 10 } : { rotate: 0 }}
                    transition={isSpinning ? { duration: 5, ease: "easeInOut" } : { duration: 0 }}
                    className="w-full h-full rounded-full border-8 border-yellow-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.3)] bg-zinc-900"
                  >
                    {[
                      { prize: '10k', color: 'bg-red-600' },
                      { prize: '20k', color: 'bg-zinc-800' },
                      { prize: '30k', color: 'bg-red-700' },
                      { prize: '50k', color: 'bg-zinc-900' },
                      { prize: '1lac', color: 'bg-yellow-600' }
                    ].map((item, i) => (
                      <div 
                        key={i}
                        className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 origin-bottom flex flex-col items-center pt-4 ${item.color}`}
                        style={{ 
                          transform: `translateX(-50%) rotate(${i * (360/5)}deg)`,
                          clipPath: 'polygon(50% 100%, 0 0, 100% 0)'
                        }}
                      >
                        <span className="text-white font-black text-xs md:text-lg tracking-tighter mt-4 drop-shadow-lg">
                          {item.prize}
                        </span>
                      </div>
                    ))}
                    
                    <div className="absolute inset-0 m-auto w-12 h-12 bg-black border-4 border-yellow-500 rounded-full z-10 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  </motion.div>
                </div>

                {spinResult ? (
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                    <div className="text-yellow-500 font-black text-4xl mb-2">CONGRATS!</div>
                    <div className="text-white font-black text-2xl uppercase tracking-widest">You Won {spinResult}</div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className={`w-full py-6 rounded-2xl font-black text-2xl transition-all active:scale-95 shadow-2xl border-b-4 ${isSpinning ? 'bg-zinc-800 text-white/20 border-zinc-900' : 'bg-yellow-600 text-black border-yellow-800 hover:bg-yellow-500'}`}
                  >
                    {isSpinning ? 'SPINNING...' : 'SPIN NOW'}
                  </button>
                )}

                <p className="mt-6 text-white/30 text-[10px] font-bold uppercase tracking-widest">Available once every 24 hours</p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none touch-none">
      {/* Global Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src={ASSETS.TABLE_BG} 
          alt="Background" 
          className="w-full h-full object-cover opacity-20" 
          referrerPolicy="no-referrer" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      {/* Header - Now Global */}
      <header className="relative z-50 p-2 md:p-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-12 md:h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)] overflow-hidden border border-red-500/30">
            <img src={ASSETS.LOGO} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col">
            <h2 className="font-poker text-lg md:text-2xl leading-tight text-emerald-500 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
              TEEN PATTI LUCIFER
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">
                {joined ? `Table: ${roomId}` : 'Underworld Lobby'}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 flex items-center justify-center"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>

          <button 
            onClick={toggleMute}
            className={`p-2 rounded-xl transition-colors border flex items-center justify-center ${soundSettings.isMuted ? 'bg-red-600/20 border-red-500/30 text-red-500' : 'bg-white/5 border-white/10 text-white'}`}
            title={soundSettings.isMuted ? "Unmute" : "Mute"}
          >
            {soundSettings.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button 
            onClick={toggleMusic}
            className={`p-2 rounded-xl transition-colors border flex items-center justify-center ${!soundSettings.isMusicEnabled ? 'bg-red-600/20 border-red-500/30 text-red-500' : 'bg-white/5 border-white/10 text-white'}`}
            title={soundSettings.isMusicEnabled ? "Stop Music" : "Play Music"}
          >
            <Music className="w-4 h-4" />
          </button>

          {joined && (
            <button 
              onClick={() => {
                const lastClaim = localStorage.getItem(`last_claim_${name}`);
                const now = Date.now();
                if (lastClaim && now - parseInt(lastClaim) < 24 * 60 * 60 * 1000) {
                  const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - parseInt(lastClaim))) / (60 * 60 * 1000));
                  alert(`You can claim again in ${hoursLeft} hours.`);
                  return;
                }
                socket?.emit('addChips', { name, amount: 20000 });
                localStorage.setItem(`last_claim_${name}`, now.toString());
                alert("20,000 chips claimed!");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 transition-all"
            >
              <Coins className="w-4 h-4" />
              <span className="text-xs font-black uppercase hidden md:inline">Claim 20k</span>
            </button>
          )}

          {joined && isAdmin && (
            <button 
              onClick={openAdminPanel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all"
            >
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-black uppercase hidden md:inline">Admin</span>
            </button>
          )}

          <button 
            onClick={logout} 
            className="p-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-xl transition-colors group"
            title="Exit Game"
          >
            <LogOut className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {!joined ? (
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-black/60 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/20 blur-[100px]" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-600/20 blur-[100px]" />
            
            <div className="relative z-10">
              {/* Dealer Mascot on Join Screen */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-32 h-32 mx-auto mb-4"
              >
                <img src={ASSETS.DEALER} alt="Dealer" className="w-full h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
              </motion.div>

              <div className="text-red-600 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">ULTRA UPDATE v3.0</div>
              <h1 className="font-poker text-3xl md:text-5xl mb-1 tracking-normal uppercase text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                TEEN PATTI LUCIFER
              </h1>
              <p className="text-white/40 text-sm mb-8 font-bold">50K Chips & Lucifer Bots Active!</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Your Name" 
                    className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all font-bold" 
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Set/Enter Password" 
                    className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all font-bold" 
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <select 
                    value={roomId} 
                    onChange={e => setRoomId(e.target.value)} 
                    className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all font-bold appearance-none text-white"
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i} value={`table-${i + 1}`} className="bg-zinc-900 text-white">
                        Table {i + 1}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronRight className="w-5 h-5 text-white/20 rotate-90" />
                  </div>
                </div>
                <button 
                  onClick={joinRoom} 
                  disabled={!name} 
                  className="w-full bg-red-600 p-5 rounded-2xl font-black text-xl hover:bg-red-500 transition-all active:scale-95 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] border-b-4 border-red-800"
                >
                  ENTER UNDERWORLD
                </button>
                
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <button 
                    onClick={() => { setRoomId('table-1'); joinRoom(); }}
                    className="bg-emerald-600/20 border border-emerald-500/30 p-3 rounded-xl font-bold text-[10px] hover:bg-emerald-600/40 transition-all text-emerald-500 uppercase tracking-widest"
                  >
                    Quick Join: Table 1
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-2">
                  <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Developed By</span>
                  <a 
                    href="https://facebook.com/shamimlemon" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-500/60 hover:text-red-500 font-black uppercase tracking-[0.2em] transition-all hover:scale-110"
                  >
                    Shamim Lemon
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Game Area */}
          <main className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            {/* Notification Bar */}
            <AnimatePresence>
              {gameNotification && (
                <motion.div 
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 20, opacity: 1 }}
                  exit={{ y: -50, opacity: 0 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 z-[60] bg-red-600/90 backdrop-blur-xl border border-red-500/50 px-6 py-2 rounded-full shadow-2xl"
                >
                  <span className="text-white font-black text-[10px] md:text-sm uppercase tracking-widest whitespace-nowrap">{gameNotification}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden py-4">
              {/* Table Surface */}
              <div className="absolute w-[95%] h-[60%] md:w-[85%] md:h-[55%] bg-emerald-900/20 rounded-[100px] md:rounded-[200px] border-[8px] md:border-[15px] border-zinc-900/80 shadow-[inset_0_0_100px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                <img src={ASSETS.TABLE_BG} alt="Table" className="w-full h-full object-cover opacity-30 mix-blend-overlay" referrerPolicy="no-referrer" />
              </div>
              
              {/* Dealer */}
              <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-24 h-24 md:w-40 md:h-40 relative"
                >
                  <img src={ASSETS.DEALER} alt="Dealer" className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" referrerPolicy="no-referrer" />
                </motion.div>
                <div className="bg-black/80 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 -mt-4 shadow-xl">
                  <span className="text-[10px] md:text-xs font-black text-white/60 uppercase tracking-[0.3em]">Dealer</span>
                </div>
              </div>

              {/* Pot Display */}
              <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 w-full">
                {!gameState?.gameStarted && !gameState?.winner && (
                  <div className="flex flex-col items-center gap-6 mb-8">
                    {(gameState?.players.length || 0) < 2 ? (
                      <div className="bg-black/80 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 text-white/40 font-black uppercase tracking-widest text-xs animate-pulse shadow-2xl">
                        Waiting for players ({(gameState?.players.length || 0)}/2)
                      </div>
                    ) : (
                      <button 
                        onClick={startGame}
                        className="bg-red-600 hover:bg-red-500 text-white px-12 py-6 rounded-[2rem] font-black text-2xl shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce border-2 border-red-400/40 active:scale-95 transition-all tracking-tighter"
                      >
                        START GAME
                      </button>
                    )}
                  </div>
                )}
                
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-zinc-950/90 backdrop-blur-3xl border-2 border-red-600/40 px-6 md:px-12 py-3 md:py-8 rounded-[2rem] md:rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col items-center min-w-[160px] md:min-w-[280px]"
                >
                  <span className="text-[8px] md:text-[12px] font-black uppercase tracking-[0.5em] text-red-500 mb-1 md:mb-2">Pot Value</span>
            <div className="flex items-center gap-2 md:gap-4 text-2xl md:text-6xl font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
              <Coins className="w-5 h-5 md:w-12 md:h-12 text-yellow-500" />
              {formatChips(gameState?.pot || 0)} <span className="text-xs md:text-2xl ml-1 md:ml-2 text-white/60">$(USD)</span>
            </div>
            <div className="mt-2 md:mt-4 text-[8px] md:text-sm font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2 md:gap-4">
              <span>Bet: {formatChips(gameState?.lastBet || 0)} $(USD)</span>
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span>Round: {gameState?.roundCount || 0}/5</span>
            </div>
                </motion.div>
                
                {gameState?.winner && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mt-6 bg-yellow-500 text-black px-8 py-3 rounded-full font-black text-sm md:text-base uppercase tracking-widest shadow-[0_0_40px_rgba(234,179,8,0.5)] border-2 border-yellow-300"
                  >
                    🏆 {gameState.winner} Wins!
                  </motion.div>
                )}
              </div>

              {/* Players Positioning */}
              {rotatedPlayers.map((player, idx) => {
                const originalIdx = gameState?.players.findIndex(p => p.id === player.id);
                const isMobile = window.innerWidth < 768;
                const isPortrait = window.innerHeight > window.innerWidth;
                let x, y;
                
                const radiusX = isMobile ? (isPortrait ? 32 : 42) : 40;
                const radiusY = isMobile ? (isPortrait ? 32 : 35) : 35;

                if (rotatedPlayers.length === 1) {
                  x = 0; y = radiusY;
                } else {
                  const angle = (idx / rotatedPlayers.length) * 2 * Math.PI + Math.PI / 2;
                  x = Math.cos(angle) * radiusX;
                  y = Math.sin(angle) * radiusY;
                  
                  if (y < -10) {
                    y += isMobile ? 4 : 4; // Move top players DOWN into view
                    if (Math.abs(x) < 15) x = x < 0 ? -28 : 28;
                  }
                  if (y > 10) {
                    y += isMobile ? 8 : 8; // Move bottom players DOWN
                  }
                }

                const isCurrent = gameState?.currentTurn === originalIdx;
                const isMe = player.id === socket?.id;
                const isTopHalf = y < 0; 

                return (
                  <motion.div
                    key={player.id}
                    style={{ left: `${50 + x}%`, top: `${50 + y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-40"
                  >
                    {!isTopHalf && (
                      <div className="flex -space-x-6 md:-space-x-14 mb-2 scale-[0.6] md:scale-[1.1] origin-bottom">
                        {player.hand.map((card: Card, cIdx: number) => (
                          <CardComponent 
                            key={`${player.id}-${cIdx}`} 
                            card={card} 
                            hidden={isMe ? player.isBlind : (!gameState?.winner || player.isFolded)} 
                            index={cIdx} 
                          />
                        ))}
                      </div>
                    )}

                    <div className={`relative flex flex-col items-center ${player.isFolded ? 'opacity-30 grayscale' : ''} scale-[0.85] md:scale-[1.1]`}>
                      <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-3xl border-2 flex items-center justify-center transition-all duration-500 relative ${isCurrent ? 'border-red-500 shadow-[0_0_40px_rgba(220,38,38,0.8)] scale-110 bg-red-500/20' : 'border-white/10 bg-black/80'} ${player.tier === 'Legend' ? 'shadow-[0_0_25px_rgba(234,179,8,0.6)] border-yellow-500/50' : ''}`}>
                        {player.profilePic ? (
                          <img src={player.profilePic} alt={player.name} className="w-full h-full object-cover rounded-2xl md:rounded-3xl" />
                        ) : (
                          <User className={`w-6 h-6 md:w-12 md:h-12 ${isCurrent ? 'text-red-500' : 'text-white/20'}`} />
                        )}
                        {player.tier === 'Legend' && (
                          <div className="absolute -top-2 -left-2 bg-yellow-500 rounded-full p-1 shadow-[0_0_15px_rgba(234,179,8,1)] z-20 border border-yellow-200">
                            <span className="text-[10px]">👑</span>
                          </div>
                        )}
                        {isMe && (
                          <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-[8px] md:text-[10px] font-black px-2 py-1 rounded-lg shadow-xl z-10 uppercase tracking-tighter">You</div>
                        )}
                        {!player.isBlind && !player.isFolded && (
                          <div className="absolute -bottom-3 bg-emerald-500 text-white text-[6px] md:text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg z-10 uppercase tracking-widest border border-emerald-400/50">Seen</div>
                        )}
                        {isCurrent && (
                          <div className="absolute -inset-2 border-2 border-red-500/30 rounded-[2rem] animate-ping" />
                        )}
                      </div>
                      
                      <div className="mt-4 bg-zinc-950/90 backdrop-blur-2xl px-4 md:px-10 py-2 md:py-4 rounded-xl md:rounded-3xl border border-white/20 flex flex-col items-center min-w-[120px] md:min-w-[240px] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <span className="text-sm md:text-2xl font-black truncate max-w-[110px] md:max-w-[220px] text-white tracking-tight leading-none uppercase">{player.name}</span>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`text-[9px] md:text-sm font-black uppercase tracking-wider ${getTier(player.xp || 0).color}`}>
                            {getTier(player.xp || 0).icon} {getTier(player.xp || 0).name}
                          </span>
                          <span className="text-[8px] md:text-[10px] text-white/40 font-bold">({player.xp || 0} XP)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-base md:text-3xl font-black text-yellow-500 mt-2">
                          <Coins className="w-5 h-5 md:w-8 md:h-8" />
                          {player.chips === -1 ? (
                            <span className="text-red-500/80 animate-pulse text-[12px] md:text-lg">HIDDEN</span>
                          ) : (
                            formatChips(player.chips)
                          )} <span className="text-[10px] md:text-sm opacity-60 ml-0.5">$(USD)</span>
                        </div>
                      </div>
                    </div>
                    {isTopHalf && (
                      <div className="flex -space-x-6 md:-space-x-14 mt-2 scale-[0.6] md:scale-[1.1] origin-top">
                        {player.hand.map((card: Card, cIdx: number) => (
                          <CardComponent 
                            key={`${player.id}-${cIdx}`} 
                            card={card} 
                            hidden={isMe ? player.isBlind : (!gameState?.winner || player.isFolded)} 
                            index={cIdx} 
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </main>

          {/* Controls */}
          <footer className="relative p-2 md:p-4 pb-4 md:pb-6 bg-gradient-to-t from-black via-black/80 to-transparent z-50">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-4 bg-black/80 backdrop-blur-3xl p-2 md:p-4 rounded-2xl border border-white/10 w-full md:w-auto justify-between md:justify-start shadow-2xl">
                <div className="flex flex-col items-start">
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Your Balance</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-3 h-3 md:w-6 md:h-6 text-yellow-500" />
                    <span className="text-xs md:text-2xl font-black tracking-tighter text-white">{formatChips(currentPlayer?.chips || 0)} <span className="text-[8px] md:text-sm text-white/40 ml-1">$(USD)</span></span>
                  </div>
                </div>
                {timeLeft !== null && isMyTurn && (
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Time Left</span>
                    <span className={`text-sm md:text-2xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}s</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 md:gap-3 w-full md:w-auto justify-center flex-wrap">
                {isMyTurn && gameState?.gameStarted && !gameState.winner && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 md:gap-3 w-full justify-center flex-wrap">
                    <button onClick={() => takeAction('fold')} className="bg-zinc-900/90 border border-white/10 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">Fold</button>
                    {currentPlayer?.isBlind && (
                      <button onClick={() => takeAction('see')} className="bg-zinc-900/90 border border-white/10 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-1 md:gap-2 text-[9px] md:text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                        <Eye className="w-3 h-3 md:w-6 md:h-6 text-red-500" /> See
                      </button>
                    )}
                    {canSideShow && <button onClick={handleSideShow} className="bg-zinc-900/90 border border-white/10 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">Side</button>}
                    {canShow && <button onClick={() => takeAction('show')} className="bg-emerald-600 text-white font-black px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95 shadow-xl border-b-2 md:border-b-4 border-emerald-800">Show</button>}
                    
                    <div className="flex items-stretch gap-px shadow-2xl rounded-xl md:rounded-2xl overflow-hidden">
                      <button onClick={() => takeAction('chaal')} className={`bg-red-600 text-white font-black px-4 md:px-12 py-2 md:py-4 uppercase tracking-widest ${gameState?.type === 'PLAY_NOW' ? 'w-full' : 'min-w-[80px] md:min-w-[180px]'} hover:bg-red-500 transition-all active:scale-95 border-r border-red-400/20`}>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] md:text-[10px] font-black text-white/60 leading-none mb-0.5 md:mb-1">CHAAL</span>
                          <span className="text-xs md:text-2xl leading-none">{formatChips(currentPlayer?.isBlind ? (gameState?.lastBet || 0) : (gameState?.lastBet || 0) * 2)} <span className="text-[8px] md:text-xs opacity-60">$(USD)</span></span>
                        </div>
                      </button>
                      {gameState?.type === 'PLAY_NOW' ? (
                        <button 
                          onClick={() => takeAction('raise', gameState.lastBet)} 
                          className="bg-red-700 text-white font-black px-3 md:px-8 hover:bg-red-600 transition-all active:scale-95 flex items-center justify-center"
                          title="Double Bet"
                        >
                          <span className="text-[8px] md:text-xs">DOUBLE</span>
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => takeAction('raise', 100000)} 
                            className="bg-red-700 text-white font-black px-3 md:px-8 hover:bg-red-600 transition-all active:scale-95 flex items-center justify-center border-r border-red-400/20"
                            title="Quick Raise +100k"
                          >
                            <Plus className="w-3 h-3 md:w-6 md:h-6" />
                          </button>
                          <button 
                            onClick={handleRaise} 
                            className="bg-red-800 text-white font-black px-3 md:px-8 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center"
                            title="Custom Raise"
                          >
                            <Settings className="w-3 h-3 md:w-6 md:h-6" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Side Show Prompt */}
      <AnimatePresence>
        {sideShowPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-4 md:p-8 rounded-2xl md:rounded-[2rem] text-center max-w-sm shadow-2xl">
              <h3 className="text-xl md:text-2xl font-black mb-1 md:mb-2">SIDE SHOW REQUEST</h3>
              <p className="text-xs md:text-base text-white/60 mb-4 md:mb-6"><b>{sideShowPrompt.fromName}</b> wants to compare hands.</p>
              <div className="flex gap-2 md:gap-4">
                <button onClick={() => respondSideShow(false)} className="flex-1 bg-white/5 hover:bg-white/10 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all text-[10px] md:text-sm">Deny</button>
                <button onClick={() => respondSideShow(true)} className="flex-1 bg-red-600 hover:bg-red-500 p-2 md:p-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 text-[10px] md:text-sm">Accept</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Dashboard */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdminPanel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-3 md:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2 md:gap-3">
                  <Trophy className="w-4 h-4 md:w-6 md:h-6 text-red-500" />
                  <h2 className="text-sm md:text-xl font-black uppercase tracking-tighter">Lucifer Dashboard</h2>
                  {adminMessage && (
                    <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] text-yellow-500 font-bold ml-2">
                      {adminMessage}
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button onClick={() => setAdminTab('players')} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${adminTab === 'players' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/40'}`}>Players</button>
                  <button onClick={() => setAdminTab('manual')} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${adminTab === 'manual' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/40'}`}>Manual</button>
                  <button onClick={() => setShowAdminPanel(false)} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors"><LogOut className="w-3.5 h-3.5 md:w-5 md:h-5 text-white/40" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
                {!adminPassword ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center">
                      <Lock className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-black uppercase">Authentication Required</h3>
                      <p className="text-white/40 text-sm">Enter the underworld master key</p>
                    </div>
                    <input 
                      type="password" 
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val === "LUCIFER_PASS_999") {
                            setAdminPassword(val);
                            socket?.emit('getAdminStats', { adminName: name, adminPassword: val });
                          } else {
                            alert("Incorrect Password!");
                          }
                        }
                      }}
                      placeholder="Master Key" 
                      className="w-full max-w-xs bg-black/40 border border-white/10 p-4 rounded-xl outline-none focus:border-red-500 transition-all text-center font-black tracking-widest" 
                    />
                    <p className="text-[10px] text-white/20 uppercase font-bold">Press Enter to Unlock</p>
                  </div>
                ) : adminTab === 'players' ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input 
                        type="text" 
                        value={adminSearch} 
                        onChange={e => setAdminSearch(e.target.value)} 
                        placeholder="Search Name or UID..." 
                        className="w-full bg-black/40 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-red-500/50 transition-all font-bold"
                      />
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {adminStats
                        .filter(s => 
                          s.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                          (s.uid && s.uid.toLowerCase().includes(adminSearch.toLowerCase()))
                        )
                        .map((stat, i) => (
                          <div key={stat.name || i} className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-red-500/30 transition-all">
                            <div className="flex flex-col">
                              <span className="font-black text-white uppercase tracking-tight">{stat.name}</span>
                              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">UID: {stat.uid || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-yellow-500 font-black text-xs mr-4">
                                <Coins className="w-3 h-3 md:w-4 md:h-4" />
                                {isFinite(Number(stat.chips)) ? formatChips(Number(stat.chips)) : '0'} $(USD)
                              </div>
                              <button onClick={() => handleAdminAdd(stat.name)} className="p-1.5 md:p-2 bg-green-600/10 hover:bg-green-600/20 border border-green-500/20 rounded-lg text-green-500 text-[8px] md:text-[10px] font-black uppercase">Add</button>
                              <button onClick={() => handleAdminSet(stat.name)} className="p-1.5 md:p-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-blue-500 text-[8px] md:text-[10px] font-black uppercase">Set</button>
                              <button onClick={() => adminAction(stat.name, 'reset')} className="p-1.5 md:p-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-red-500 text-[8px] md:text-[10px] font-black uppercase">Reset</button>
                              <button onClick={() => { if(confirm(`Delete ${stat.name}?`)) adminAction(stat.name, 'delete'); }} className="p-1.5 md:p-2 bg-zinc-600/10 hover:bg-zinc-600/20 border border-zinc-500/20 rounded-lg text-zinc-500 text-[8px] md:text-[10px] font-black uppercase">Del</button>
                            </div>
                          </div>
                        ))}
                      {adminStats.length === 0 && (
                        <div className="text-center py-8 text-white/20 uppercase font-black tracking-widest">No players found</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Player Name or UID" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                    <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="Amount" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => {
                        const amt = parseInt(manualAmount);
                        if (!manualName || isNaN(amt)) return alert("Enter valid name and amount");
                        adminAction(manualName, 'add', amt);
                      }} className="bg-green-600 p-3 rounded-xl font-black uppercase text-[10px]">Add</button>
                      <button onClick={() => {
                        const amt = parseInt(manualAmount);
                        if (!manualName || isNaN(amt)) return alert("Enter valid name and amount");
                        adminAction(manualName, 'set', amt);
                      }} className="bg-blue-600 p-3 rounded-xl font-black uppercase text-[10px]">Set</button>
                      <button onClick={() => {
                        if (!manualName) return alert("Enter player name");
                        adminAction(manualName, 'set', 1000000000);
                      }} className="bg-yellow-600 p-3 rounded-xl font-black uppercase text-[10px] text-black">Unlimited</button>
                    </div>
                    <button onClick={() => { if(confirm("Reset ALL players?")) adminAction(null, 'resetAll'); }} className="w-full bg-red-600/20 border border-red-500/50 p-4 rounded-xl font-black uppercase text-red-500">Reset All Players</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spin Wheel Modal */}
      <AnimatePresence>
        {showSpinWheel && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSpinning && setShowSpinWheel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-yellow-500/20 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(234,179,8,0.2)] p-8 flex flex-col items-center"
            >
              <div className="absolute top-6 right-6">
                <button onClick={() => !isSpinning && setShowSpinWheel(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut className="w-6 h-6 text-white/40" />
                </button>
              </div>

              <div className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Daily Reward</div>
              <h2 className="text-3xl font-black text-white mb-8 tracking-tighter">LUCIFER <span className="text-yellow-500">SPIN</span></h2>

              <div className="relative w-64 h-64 md:w-80 md:h-80 mb-8">
                {/* Pointer */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-white rounded-full shadow-2xl flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[20px] border-t-red-600" />
                </div>

                {/* Wheel */}
                <motion.div 
                  animate={isSpinning ? { rotate: 360 * 10 } : { rotate: 0 }}
                  transition={isSpinning ? { duration: 5, ease: "easeInOut" } : { duration: 0 }}
                  className="w-full h-full rounded-full border-8 border-yellow-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.3)] bg-zinc-900"
                >
                  {[
                    { prize: '10k', color: 'bg-red-600' },
                    { prize: '20k', color: 'bg-zinc-800' },
                    { prize: '30k', color: 'bg-red-700' },
                    { prize: '50k', color: 'bg-zinc-900' },
                    { prize: '1lac', color: 'bg-yellow-600' }
                  ].map((item, i) => (
                    <div 
                      key={i}
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 origin-bottom flex flex-col items-center pt-4 ${item.color}`}
                      style={{ 
                        transform: `translateX(-50%) rotate(${i * (360/5)}deg)`,
                        clipPath: 'polygon(50% 100%, 0 0, 100% 0)'
                      }}
                    >
                      <span className="text-white font-black text-xs md:text-lg tracking-tighter mt-4 drop-shadow-lg">
                        {item.prize}
                      </span>
                    </div>
                  ))}
                  
                  {/* Center hub */}
                  <div className="absolute inset-0 m-auto w-12 h-12 bg-black border-4 border-yellow-500 rounded-full z-10 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                </motion.div>
              </div>

              {spinResult ? (
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                  <div className="text-yellow-500 font-black text-4xl mb-2">CONGRATS!</div>
                  <div className="text-white font-black text-2xl uppercase tracking-widest">You Won {spinResult}</div>
                </motion.div>
              ) : (
                <button 
                  onClick={handleSpin}
                  disabled={isSpinning}
                  className={`w-full py-6 rounded-2xl font-black text-2xl transition-all active:scale-95 shadow-2xl border-b-4 ${isSpinning ? 'bg-zinc-800 text-white/20 border-zinc-900' : 'bg-yellow-600 text-black border-yellow-800 hover:bg-yellow-500'}`}
                >
                  {isSpinning ? 'SPINNING...' : 'SPIN NOW'}
                </button>
              )}

              <p className="mt-6 text-white/30 text-[10px] font-bold uppercase tracking-widest">Available once every 24 hours</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat System */}
      {view === 'game' && (
        <div className="fixed bottom-24 md:bottom-32 right-4 z-[60] flex flex-col items-end gap-2">
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-zinc-950/95 backdrop-blur-3xl border border-white/10 w-72 md:w-96 h-[400px] rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-2"
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-red-500" />
                    <span className="font-black text-sm uppercase tracking-widest text-white">Live Chat</span>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="text-white/40 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-2">
                      <MessageCircle className="w-12 h-12" />
                      <span className="text-xs font-bold uppercase tracking-widest">No messages yet</span>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.sender === name ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-white/40">{msg.sender}</span>
                          <span className="text-[8px] text-white/20">{msg.timestamp}</span>
                        </div>
                        <div className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words ${msg.sender === name ? 'bg-red-600 text-white rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'}`}>
                          {msg.message}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-black/40 border-t border-white/10">
                  <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                    />
                    <button type="submit" className="bg-red-600 p-2 rounded-xl hover:bg-red-500 transition-all">
                      <Send className="w-5 h-5 text-white" />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="w-14 h-14 md:w-20 md:h-20 bg-zinc-950/90 backdrop-blur-2xl border-2 border-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center hover:scale-110 transition-all active:scale-95 shadow-2xl group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src="https://i.imgur.com/A2TTBTM.png" alt="Chat" className="w-8 h-8 md:w-12 md:h-12 object-contain relative z-10" />
              
              {unreadCount > 0 && !isChatOpen && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] md:text-xs font-black w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center shadow-lg z-20 border-2 border-zinc-950"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.div>
              )}
            </button>
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Live Chat</span>
          </div>
        </div>
      )}
    </div>
  );
}
