import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('game.db');
db.exec(`CREATE TABLE IF NOT EXISTS players (
  name TEXT PRIMARY KEY, 
  chips BIGINT DEFAULT 50000000,
  last_spin INTEGER DEFAULT 0
)`);

const getPlayerChips = (name: string): { chips: number, last_spin: number } => {
  const row = db.prepare('SELECT chips, last_spin FROM players WHERE name = ?').get(name) as { chips: number, last_spin: number } | undefined;
  if (row) return row;
  const initialChips = 50000000; 
  db.prepare('INSERT INTO players (name, chips, last_spin) VALUES (?, ?, ?)').run(name, initialChips, 0);
  return { chips: initialChips, last_spin: 0 };
};

const updatePlayerChips = (name: string, chips: number) => {
  db.prepare('UPDATE players SET chips = ? WHERE name = ?').run(chips, name);
};

const updateLastSpin = (name: string, time: number) => {
  db.prepare('UPDATE players SET last_spin = ? WHERE name = ?').run(time, name);
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

    socket.on("joinRoom", ({ roomId, name }) => {
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

      // Check if player already in room
      const existingPlayerIndex = game.players.findIndex((p: any) => p.name === playerName);
      const dbData = getPlayerChips(playerName);
      
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

    socket.on("getAdminStats", ({ adminName, adminPassword }) => {
      if (adminName?.trim() === "LUCIFER_DEV_777" && adminPassword === "LUCIFER_PASS_999") {
        socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
      } else {
        socket.emit("adminMessage", "Invalid Admin Credentials");
      }
    });

    socket.on("adminAction", ({ adminName, adminPassword, type, targetName, amount }) => {
      if (adminName?.trim() === "LUCIFER_DEV_777" && adminPassword === "LUCIFER_PASS_999") {
        const target = targetName?.trim();
        if (!target) return;

        if (type === "add") {
          const add = parseInt(amount) || 0;
          const exists = db.prepare('SELECT name FROM players WHERE name = ?').get(target);
          if (exists) db.prepare('UPDATE players SET chips = chips + ? WHERE name = ?').run(add, target);
          else db.prepare('INSERT INTO players (name, chips, last_spin) VALUES (?, ?, 0)').run(target, add);
        } else if (type === "reset") {
          db.prepare('UPDATE players SET chips = 50000000 WHERE name = ?').run(target);
        } else if (type === "set") {
          const setVal = parseInt(amount) || 0;
          db.prepare('UPDATE players SET chips = ? WHERE name = ?').run(setVal, target);
        }

        // Update active players in rooms
        Object.keys(rooms).forEach(r => {
          const p = rooms[r].players.find((pl: any) => pl.name === target);
          if (p) {
            const updated = db.prepare('SELECT chips FROM players WHERE name = ?').get(target) as { chips: number };
            p.chips = updated.chips;
            emitGameState(r);
          }
        });
        socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
      }
    });

    socket.on("spinWheel", ({ name }) => {
      const dbData = getPlayerChips(name);
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      if (now - dbData.last_spin < oneDay) {
        const remaining = oneDay - (now - dbData.last_spin);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return socket.emit("spinError", `Wait ${hours}h ${minutes}m for next spin!`);
      }

      const options = [
        { label: "50 LAC", value: 5000000 },
        { label: "1 COROR", value: 10000000 },
        { label: "5 COROR", value: 50000000 },
        { label: "10 COROR", value: 100000000 },
        { label: "20 COROR", value: 200000000 }
      ];

      const randomIndex = Math.floor(Math.random() * options.length);
      const win = options[randomIndex];

      const newChips = dbData.chips + win.value;
      updatePlayerChips(name, newChips);
      updateLastSpin(name, now);

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
