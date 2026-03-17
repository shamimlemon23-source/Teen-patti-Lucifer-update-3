import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy, getDocFromServer, limit, initializeFirestore } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
let firebaseConfig: any;
try {
  const configPath = new URL('./firebase-applet-config.json', import.meta.url);
  firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.warn("Could not find firebase-applet-config.json, using environment variables");
  firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID,
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
  };
}

if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase configuration is missing! Please set FIREBASE_API_KEY etc.");
}

const firebaseApp = initializeApp(firebaseConfig);
// Use initializeFirestore with long polling to prevent "Disconnecting idle stream" errors
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || undefined);

// Test Firestore connection at startup
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    await getDocFromServer(doc(db, 'system', 'health'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("CRITICAL: Firestore is OFFLINE. Database operations will fail.");
    } else {
      console.warn("Firestore health check warning (this is normal if 'system/health' doc doesn't exist):", error instanceof Error ? error.message : error);
    }
  }
}
testConnection();

const getPlayerChips = async (name: string, password?: string, ignorePassword = false): Promise<{ chips: number, last_spin: number, error?: string }> => {
  try {
    const playerRef = doc(db, 'players', name);
    const playerSnap = await getDoc(playerRef);
    
    if (playerSnap.exists()) {
      const data = playerSnap.data();
      
      // If ignorePassword is true, we are doing an internal update (like spin or admin)
      if (ignorePassword) {
        return { chips: (data.chips !== undefined) ? Number(data.chips) : 50000000, last_spin: data.last_spin || 0 };
      }

      // If the account HAS a password, we MUST verify it.
      if (data.password && String(data.password).trim() !== "") {
        const storedPass = String(data.password).trim();
        const providedPass = (password && typeof password === 'string') ? password.trim() : "";
        
        if (providedPass === "" || storedPass !== providedPass) {
          return { chips: 0, last_spin: 0, error: 'Incorrect password for this name!' };
        }
      } else if (password && typeof password === 'string' && password.trim() !== "") {
        // If the account has NO password, but the user provided one, SET it now (claiming the account)
        await updateDoc(playerRef, { password: password.trim() });
      }
      
      return { chips: (data.chips !== undefined) ? Number(data.chips) : 50000000, last_spin: data.last_spin || 0 };
    }
    
    const initialChips = 50000000;
    const newData = {
      name,
      chips: initialChips,
      last_spin: 0,
      password: (password && password.trim() !== "") ? password.trim() : ''
    };
    await setDoc(playerRef, newData);
    return { chips: initialChips, last_spin: 0 };
  } catch (error) {
    console.error('Firestore Error in getPlayerChips:', error);
    // CRITICAL: Do not allow login if Firestore is failing, otherwise password check is bypassed
    return { chips: 0, last_spin: 0, error: 'Database connection error. Please try again later.' };
  }
};

const updatePlayerChips = async (name: string, chips: number) => {
  try {
    const playerRef = doc(db, 'players', name);
    await updateDoc(playerRef, { chips });
  } catch (error) {
    console.error('Firestore Update Error:', error);
  }
};

const updateLastSpin = async (name: string, time: number) => {
  try {
    const playerRef = doc(db, 'players', name);
    await updateDoc(playerRef, { last_spin: time });
  } catch (error) {
    console.error('Firestore Spin Error:', error);
  }
};

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
interface Card { suit: Suit; rank: Rank; }

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { 
    cors: { origin: "*" },
    transports: ['polling', 'websocket']
  });
  const PORT = Number(process.env.PORT) || 3000;

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const rooms: any = {};
  const turnTimers: any = {};

  const RANK_VALUE: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  function getHandScore(hand: Card[]) {
    const ranks = hand.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
    const suits = hand.map(c => c.suit);
    const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
    let isStraight = false;
    if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) isStraight = true;
    else if (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) isStraight = true;
    const isTrail = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];

    if (isTrail) return 6000000 + ranks[0];
    if (isFlush && isStraight) return 5000000 + (ranks[0] === 14 && ranks[1] === 3 ? 3 : ranks[0]);
    if (isStraight) return 4000000 + (ranks[0] === 14 && ranks[1] === 3 ? 3 : ranks[0]);
    if (isFlush) return 3000000 + ranks[0] * 10000 + ranks[1] * 100 + ranks[2];
    if (isPair) {
      const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[1];
      const kicker = ranks[0] === ranks[1] ? ranks[2] : (ranks[1] === ranks[2] ? ranks[0] : ranks[1]);
      return 2000000 + pairRank * 100 + kicker;
    }
    return 1000000 + ranks[0] * 10000 + ranks[1] * 100 + ranks[2];
  }

  function clearTurnTimer(rid: string) {
    if (turnTimers[rid]) {
      clearTimeout(turnTimers[rid]);
      delete turnTimers[rid];
    }
  }

  function startTurnTimer(rid: string) {
    clearTurnTimer(rid);
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;

    const turnDuration = 20000; // 20 seconds
    game.turnStartTime = Date.now();
    game.turnDuration = turnDuration;

    turnTimers[rid] = setTimeout(() => {
      const currentPlayer = game.players[game.currentTurn];
      if (currentPlayer) {
        console.log(`Timer expired for ${currentPlayer.name} in ${rid}. Auto-folding.`);
        currentPlayer.isFolded = true;
        nextTurn(rid);
      }
    }, turnDuration);
  }

  function emitGameState(rid: string) {
    const game = rooms[rid];
    if (!game) return;
    const socketsInRoom = io.sockets.adapter.rooms.get(rid);
    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          const stateToSend = JSON.parse(JSON.stringify(game));
          stateToSend.players.forEach((p: any) => {
            if (p.id !== socketId && !p.isBot && !game.winner) {
              p.hand = p.hand.map(() => ({ suit: 'back', rank: '?' }));
            }
          });
          socket.emit("gameState", stateToSend);
        }
      }
    }
  }

  function resolveShowdown(rid: string) {
    clearTurnTimer(rid);
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    console.log(`Resolving showdown for room: ${rid}`);
    const activePlayers = game.players.filter((p: any) => !p.isFolded);
    let bestScore = -1;
    let winnerName = "";
    activePlayers.forEach((p: any) => {
      const score = getHandScore(p.hand);
      if (score > bestScore) { bestScore = score; winnerName = p.name; }
    });
    const winner = game.players.find((p: any) => p.name === winnerName);
    if (winner) {
      game.winner = winner.name;
      winner.chips += game.pot;
      if (!winner.isBot) updatePlayerChips(winner.name, winner.chips);
      console.log(`Winner: ${winner.name}, Pot: ${game.pot}`);
    }
    game.gameStarted = false;
    game.turnStartTime = undefined;
    emitGameState(rid);

    setTimeout(() => {
      if (!game.gameStarted) startGame(rid);
    }, 5000);
  }

  function nextTurn(rid: string) {
    clearTurnTimer(rid);
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    let active = game.players.filter((p: any) => !p.isFolded);
    if (active.length <= 1) {
      if (active.length === 1) {
        game.winner = active[0].name;
        active[0].chips += game.pot;
        if (!active[0].isBot) updatePlayerChips(active[0].name, active[0].chips);
      }
      game.gameStarted = false;
      game.turnStartTime = undefined;
      emitGameState(rid);
      setTimeout(() => {
        if (!game.gameStarted) startGame(rid);
      }, 5000);
      return;
    }
    const oldTurn = game.currentTurn;
    do { game.currentTurn = (game.currentTurn + 1) % game.players.length; } 
    while (game.players[game.currentTurn].isFolded);
    
    if (game.currentTurn <= oldTurn) {
      game.roundCount++;
      console.log(`Round ${game.roundCount} in ${rid}`);
    }
    
    if (game.roundCount >= 5) {
      console.log(`Max rounds (5) reached in ${rid}, forcing showdown.`);
      game.players.forEach((p: any) => { if (!p.isFolded) p.isBlind = false; });
      return resolveShowdown(rid);
    }
    
    emitGameState(rid);
    if (game.players[game.currentTurn].isBot) {
      handleBotTurn(rid);
    } else {
      startTurnTimer(rid);
    }
  }

  function handleBotTurn(rid: string) {
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    const currentPlayer = game.players[game.currentTurn];
    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      if (!game.gameStarted || game.players[game.currentTurn].id !== currentPlayer.id) return;
      
      const shouldFold = !currentPlayer.isBlind && Math.random() < 0.1;
      
      if (shouldFold) {
        currentPlayer.isFolded = true;
      } else {
        const bet = currentPlayer.isBlind ? game.lastBet : game.lastBet * 2;
        if (currentPlayer.chips < bet) {
          currentPlayer.isFolded = true;
        } else {
          currentPlayer.chips -= bet; 
          game.pot += bet;
        }
      }
      nextTurn(rid);
    }, delay);
  }

  function startGame(rid: string) {
    clearTurnTimer(rid);
    const game = rooms[rid];
    if (game && game.players.length >= 2) {
      console.log(`Starting game in room: ${rid}`);
      game.gameStarted = true; 
      game.deck = createDeck(); 
      game.pot = 0; 
      game.lastBet = 50000; 
      game.winner = null; 
      game.roundCount = 0;
      game.players.forEach((p: any) => {
        // Fix for bot chips going negative or too low
        if (p.isBot && p.chips < 1000000) {
          p.chips = 500000000;
        }
        
        p.hand = [game.deck.pop(), game.deck.pop(), game.deck.pop()];
        p.isFolded = false; 
        p.isBlind = true; 
        p.chips -= 50000; 
        game.pot += 50000;
        if (!p.isBot) updatePlayerChips(p.name, p.chips);
      });
      game.currentTurn = 0; 
      emitGameState(rid);
      if (game.players[game.currentTurn].isBot) {
        handleBotTurn(rid);
      } else {
        startTurnTimer(rid);
      }
    }
  }

  function createDeck(): Card[] {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    for (const suit of suits) for (const rank of ranks) deck.push({ suit, rank });
    return deck.sort(() => Math.random() - 0.5);
  }

  io.on("connection", (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Player disconnected: ${socket.id}`);
      Object.keys(rooms).forEach(rid => {
        const game = rooms[rid];
        const playerIndex = game.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = game.players[playerIndex];
          console.log(`Removing ${player.name} from room ${rid}`);
          
          const wasTheirTurn = game.gameStarted && game.currentTurn === playerIndex;
          
          game.players.splice(playerIndex, 1);
          
          if (game.gameStarted) {
            // Adjust currentTurn if a player before the current turn was removed
            if (playerIndex < game.currentTurn) {
              game.currentTurn--;
            }
            
            // If it was their turn, or if currentTurn is now out of bounds
            if (wasTheirTurn || game.currentTurn >= game.players.length) {
              game.currentTurn = game.currentTurn % (game.players.length || 1);
              // Check if we need to skip folded players or end game
              const active = game.players.filter((p: any) => !p.isFolded);
              if (active.length <= 1) {
                resolveShowdown(rid); 
              } else {
                // Ensure currentTurn points to a valid active player
                while (game.players[game.currentTurn] && game.players[game.currentTurn].isFolded) {
                  game.currentTurn = (game.currentTurn + 1) % game.players.length;
                }
                if (game.players[game.currentTurn]?.isBot) {
                  handleBotTurn(rid);
                } else {
                  startTurnTimer(rid);
                }
              }
            }
          }
          
          const realPlayers = game.players.filter((p: any) => !p.isBot);
          if (realPlayers.length === 0) {
            clearTurnTimer(rid);
            game.gameStarted = false;
            game.winner = null;
          }
          
          emitGameState(rid);
        }
      });
    });

    socket.on("joinRoom", async ({ roomId, name, password }) => {
      let rid = (roomId || "table-1").trim().toLowerCase();
      console.log(`${name} joining room: ${rid}`);
      if (!rooms[rid]) {
        rooms[rid] = { 
          players: [
            { id: "bot1", name: "😈 Lucifer Bot", chips: 500000000, hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: true }
          ], 
          pot: 0, currentTurn: 0, lastBet: 50000, gameStarted: false, winner: null, deck: [], roundCount: 0 
        };
      }
      const game = rooms[rid];
      const playerName = (name || "Player").trim();
      
      // Check if player already in room
      const existingPlayerIndex = game.players.findIndex((p: any) => p.name === playerName);
      const dbData = await getPlayerChips(playerName, password);

      if (dbData.error) {
        socket.emit("error", dbData.error);
        return;
      }
      
      // Remove player from any other room they might be in to prevent ghosts
      Object.keys(rooms).forEach(otherRid => {
        if (otherRid !== rid) {
          const gameInOther = rooms[otherRid];
          const pIdx = gameInOther.players.findIndex((p: any) => p.name === playerName);
          if (pIdx !== -1) {
            gameInOther.players.splice(pIdx, 1);
            emitGameState(otherRid);
          }
        }
      });
      
      if (existingPlayerIndex !== -1 && !game.players[existingPlayerIndex].isBot) {
        game.players[existingPlayerIndex].id = socket.id;
        game.players[existingPlayerIndex].chips = dbData.chips;
      } else {
        game.players.push({ 
          id: socket.id, 
          name: playerName, 
          chips: dbData.chips, 
          last_spin: dbData.last_spin,
          hand: [], 
          isFolded: false, 
          isBlind: true, 
          currentBet: 0, 
          isBot: false 
        });
      }
      
      socket.join(rid);
      emitGameState(rid);

      // Auto-start if 2+ players and not started
      if (!game.gameStarted && game.players.length >= 2) {
        setTimeout(() => {
          if (!game.gameStarted && game.players.length >= 2) startGame(rid);
        }, 5000);
      }
    });

    // Room Cleanup Interval
    setInterval(() => {
      Object.keys(rooms).forEach(rid => {
        const game = rooms[rid];
        const realPlayers = game.players.filter((p: any) => !p.isBot);
        if (realPlayers.length === 0) {
          // Keep only the bot if no real players for a while
          if (game.gameStarted) {
            clearTurnTimer(rid);
            game.gameStarted = false;
            game.winner = null;
            emitGameState(rid);
          }
        }
      });
    }, 60000);

    socket.on("startGame", (rid) => {
      const roomID = rid?.trim().toLowerCase() || "main-table";
      startGame(roomID);
    });

    socket.on("action", ({ roomId, action, amount }) => {
      const rid = roomId.trim().toLowerCase();
      const game = rooms[rid];
      if (!game || !game.gameStarted) return;
      const player = game.players[game.currentTurn];
      if (!player || player.id !== socket.id) return;

      clearTurnTimer(rid);
      console.log(`Action: ${action} from ${player.name} in ${rid}`);

      if (action === "fold") {
        player.isFolded = true;
      } else if (action === "chaal") {
        const bet = player.isBlind ? game.lastBet : game.lastBet * 2;
        if (player.chips < bet) {
          player.isFolded = true; // Auto-fold if can't pay
        } else {
          player.chips -= bet; 
          game.pot += bet;
        }
      } else if (action === "raise") {
        const raiseAmount = parseInt(amount) || 100000;
        const newLastBet = game.lastBet + raiseAmount;
        const bet = player.isBlind ? newLastBet : newLastBet * 2;
        
        if (player.chips < bet) {
          // If can't afford raise, just do a normal chaal if possible, else fold
          const normalBet = player.isBlind ? game.lastBet : game.lastBet * 2;
          if (player.chips < normalBet) {
            player.isFolded = true;
          } else {
            player.chips -= normalBet;
            game.pot += normalBet;
          }
        } else {
          game.lastBet = newLastBet;
          player.chips -= bet;
          game.pot += bet;
        }
      } else if (action === "see") {
        player.isBlind = false;
        io.to(rid).emit("gameNotification", { message: `${player.name} has seen their cards!` });
        return emitGameState(rid);
      } else if (action === "show") {
        const active = game.players.filter((p: any) => !p.isFolded);
        if (active.length === 2) {
          const bet = player.isBlind ? game.lastBet : game.lastBet * 2;
          if (player.chips >= bet) {
            player.chips -= bet;
            game.pot += bet;
            if (!player.isBot) updatePlayerChips(player.name, player.chips);
            return resolveShowdown(rid);
          }
        }
      }
      
      if (!player.isBot) updatePlayerChips(player.name, player.chips);
      nextTurn(rid);
    });

    socket.on("sideShowRequest", (roomId) => {
      const rid = roomId.trim().toLowerCase();
      const game = rooms[rid];
      if (!game || !game.gameStarted) return;
      const player = game.players[game.currentTurn];
      if (!player || player.id !== socket.id || player.isBlind) return;

      // Find previous active player
      let prevIdx = (game.currentTurn - 1 + game.players.length) % game.players.length;
      let count = 0;
      while (game.players[prevIdx].isFolded && count < game.players.length) {
        prevIdx = (prevIdx - 1 + game.players.length) % game.players.length;
        count++;
      }
      const prevPlayer = game.players[prevIdx];
      if (!prevPlayer || prevPlayer.isBlind || prevPlayer.isFolded) return;

      // Deduct bet for side show
      const bet = game.lastBet * 2;
      if (player.chips < bet) return;
      player.chips -= bet;
      game.pot += bet;
      if (!player.isBot) updatePlayerChips(player.name, player.chips);

      if (prevPlayer.isBot) {
        // Bot always accepts side show for now
        setTimeout(() => {
          const myScore = getHandScore(player.hand);
          const botScore = getHandScore(prevPlayer.hand);
          if (myScore > botScore) {
            prevPlayer.isFolded = true;
            io.to(rid).emit("gameNotification", { message: `${player.name} won side show against ${prevPlayer.name}!` });
          } else {
            player.isFolded = true;
            io.to(rid).emit("gameNotification", { message: `${prevPlayer.name} won side show against ${player.name}!` });
          }
          nextTurn(rid);
        }, 2000);
      } else {
        io.to(prevPlayer.id).emit("sideShowPrompt", { fromId: player.id, fromName: player.name });
        io.to(rid).emit("gameNotification", { message: `${player.name} requested side show from ${prevPlayer.name}` });
      }
      emitGameState(rid);
    });

    socket.on("sideShowResponse", ({ roomId, accepted }) => {
      const rid = roomId.trim().toLowerCase();
      const game = rooms[rid];
      if (!game || !game.gameStarted) return;
      
      const prevIdx = (game.currentTurn - 1 + game.players.length) % game.players.length;
      // This is tricky because the turn might have changed if we are not careful
      // But sideShowResponse happens while it's still the requester's turn (we haven't called nextTurn yet)
      const requester = game.players[game.currentTurn];
      
      // Find the player who was asked (the one who just responded)
      const responder = game.players.find((p: any) => p.id === socket.id);
      if (!responder || !requester) return;

      if (accepted) {
        const reqScore = getHandScore(requester.hand);
        const resScore = getHandScore(responder.hand);
        
        if (reqScore > resScore) {
          responder.isFolded = true;
          io.to(rid).emit("gameNotification", { message: `${requester.name} won side show against ${responder.name}!` });
        } else {
          requester.isFolded = true;
          io.to(rid).emit("gameNotification", { message: `${responder.name} won side show against ${requester.name}!` });
        }
        nextTurn(rid);
      } else {
        io.to(rid).emit("gameNotification", { message: `${responder.name} declined side show.` });
        // Turn stays with requester, they must continue
        startTurnTimer(rid);
      }
      emitGameState(rid);
    });

    const refreshAdminStats = async () => {
      try {
        // Limit to top 100 players to avoid performance issues and timeouts
        const q = query(collection(db, 'players'), orderBy('chips', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);
        const stats: any[] = [];
        querySnapshot.forEach((doc) => {
          stats.push({ name: doc.id, chips: doc.data().chips });
        });
        socket.emit("adminStats", stats);
      } catch (error) {
        console.error('Admin Stats Error:', error);
        socket.emit("adminMessage", "Error loading player stats. Database might be busy.");
      }
    };

    socket.on("getAdminStats", async ({ adminName, adminPassword }) => {
      if (adminName?.trim().toUpperCase() === "LUCIFER_DEV_777" && adminPassword === "LUCIFER_PASS_999") {
        await refreshAdminStats();
      } else {
        socket.emit("adminMessage", "Invalid Admin Credentials");
      }
    });

    socket.on("adminAction", async ({ adminName, adminPassword, type, targetName, amount }) => {
      // Robust admin check
      const isAdminName = adminName?.trim().toUpperCase() === "LUCIFER_DEV_777";
      const isAdminPass = adminPassword === "LUCIFER_PASS_999";

      if (isAdminName && isAdminPass) {
        console.log(`Admin Action: ${type} on ${targetName} with amount ${amount}`);
        if (type === "resetAll") {
          try {
            const querySnapshot = await getDocs(collection(db, 'players'));
            const promises = querySnapshot.docs.map(d => updateDoc(d.ref, { chips: 50000000 }));
            await Promise.all(promises);
            
            Object.keys(rooms).forEach(r => {
              rooms[r].players.forEach((p: any) => {
                p.chips = 50000000;
              });
              emitGameState(r);
            });
            await refreshAdminStats();
            socket.emit("adminMessage", "All players reset to 5 Cr");
          } catch (error) {
            console.error('Admin Reset All Error:', error);
            socket.emit("adminMessage", "Error resetting all players");
          }
          return;
        }

        const target = targetName?.trim();
        if (!target) return;

        const playerRef = doc(db, 'players', target);
        try {
          const snap = await getDoc(playerRef);
          
          if (type === "add") {
            const add = Number(amount) || 0;
            if (snap.exists()) {
              const currentChips = Number(snap.data().chips) || 0;
              const newChips = currentChips + add;
              await updateDoc(playerRef, { chips: newChips });
            } else {
              await setDoc(playerRef, { name: target, chips: add, last_spin: 0, password: '' });
            }
          } else if (type === "reset") {
            await updateDoc(playerRef, { chips: 50000000 });
          } else if (type === "set") {
            const setVal = Number(amount) || 0;
            if (snap.exists()) {
              await updateDoc(playerRef, { chips: setVal });
            } else {
              await setDoc(playerRef, { name: target, chips: setVal, last_spin: 0, password: '' });
            }
          }

          // Update active players in rooms
          const updatedSnap = await getDoc(playerRef);
          if (updatedSnap.exists()) {
            const updatedChips = Number(updatedSnap.data().chips);
            Object.keys(rooms).forEach(r => {
              const p = rooms[r].players.find((pl: any) => pl.name === target);
              if (p) {
                p.chips = updatedChips;
                emitGameState(r);
              }
            });
          }
          
          await refreshAdminStats();
          socket.emit("adminMessage", `Action ${type} successful for ${target}`);
        } catch (error) {
          console.error('Admin Action Error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (errorMsg.includes('offline')) {
            socket.emit("adminMessage", "Database is offline. Please check server connection.");
          } else {
            socket.emit("adminMessage", `Error: ${errorMsg}`);
          }
        }
      } else {
        socket.emit("adminMessage", "Unauthorized Admin Action Attempted");
      }
    });

    socket.on("spinWheel", async ({ name }) => {
      try {
        const dbData = await getPlayerChips(name, undefined, true);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - dbData.last_spin < oneDay) {
          const remaining = oneDay - (now - dbData.last_spin);
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          return socket.emit("spinError", { message: `Wait ${hours}h ${minutes}m for next spin!` });
        }

        const options = [
          { label: "1 COROR", value: 10000000 },
          { label: "2 COROR", value: 20000000 },
          { label: "5 COROR", value: 50000000 },
          { label: "10 COROR", value: 100000000 },
          { label: "20 COROR", value: 200000000 }
        ];

        const randomIndex = Math.floor(Math.random() * options.length);
        const win = options[randomIndex];

        const newChips = dbData.chips + win.value;
        await updatePlayerChips(name, newChips);
        await updateLastSpin(name, now);

        // Update player in rooms
        Object.keys(rooms).forEach(r => {
          const p = rooms[r].players.find((pl: any) => pl.name === name);
          if (p) {
            p.chips = newChips;
            emitGameState(r);
          }
        });

        socket.emit("spinResult", { 
          prize: win.label, 
          chips: win.value, 
          lastSpin: now 
        });
      } catch (error) {
        console.error('Spin Wheel Error:', error);
        socket.emit("spinError", { message: "Internal Server Error during spin" });
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: false }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server live on ${PORT}`));
}

startServer();
