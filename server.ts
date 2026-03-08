import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Database Setup ---
const db = new Database('game.db');
db.exec(`CREATE TABLE IF NOT EXISTS players (name TEXT PRIMARY KEY, chips BIGINT DEFAULT 50000000)`);

// Force update all players to 5 Crore chips on start
db.prepare(`UPDATE players SET chips = 50000000`).run();

const getPlayerChips = (name: string): number => {
  const row = db.prepare('SELECT chips FROM players WHERE name = ?').get(name) as { chips: number } | undefined;
  if (row) return row.chips;
  const initialChips = 50000000; 
  db.prepare('INSERT INTO players (name, chips) VALUES (?, ?)').run(name, initialChips);
  return initialChips;
};

const updatePlayerChips = (name: string, chips: number) => {
  db.prepare('UPDATE players SET chips = ? WHERE name = ?').run(chips, name);
};

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
interface Card { suit: Suit; rank: Rank; }

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const PORT = 3000;

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

  function resolveShowdown(rid: string) {
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    
    const activePlayers = game.players.filter((p: any) => !p.isFolded);
    let bestScore = -1;
    let winnerName = "";

    activePlayers.forEach((p: any) => {
      const score = getHandScore(p.hand);
      if (score > bestScore) {
        bestScore = score;
        winnerName = p.name;
      }
    });

    const winner = game.players.find((p: any) => p.name === winnerName);
    if (winner) {
      game.winner = winner.name;
      winner.chips += game.pot;
      if (!winner.isBot) updatePlayerChips(winner.name, winner.chips);
    }
    game.gameStarted = false;
    if (turnTimers[rid]) clearTimeout(turnTimers[rid]);
    io.to(rid).emit("gameState", game);
  }

  function startTurnTimer(rid: string) {
    if (turnTimers[rid]) clearTimeout(turnTimers[rid]);
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;

    game.turnStartTime = Date.now();
    game.turnDuration = 30000;

    turnTimers[rid] = setTimeout(() => {
      const g = rooms[rid];
      if (!g || !g.gameStarted) return;
      const player = g.players[g.currentTurn];
      if (player) {
        player.isFolded = true;
        io.to(rid).emit("adminMessage", `⏰ ${player.name} timed out and folded!`);
        nextTurn(rid);
      }
    }, 30000);
  }

  function nextTurn(rid: string) {
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;

    let active = game.players.filter((p: any) => !p.isFolded);
    if (active.length === 1) {
      game.winner = active[0].name;
      active[0].chips += game.pot;
      if (!active[0].isBot) updatePlayerChips(active[0].name, active[0].chips);
      game.gameStarted = false;
      if (turnTimers[rid]) clearTimeout(turnTimers[rid]);
      io.to(rid).emit("gameState", game);
      return;
    }

    const oldTurn = game.currentTurn;
    do { game.currentTurn = (game.currentTurn + 1) % game.players.length; } 
    while (game.players[game.currentTurn].isFolded);

    if (game.currentTurn <= oldTurn) {
      game.roundCount++;
    }

    if (game.roundCount >= 5) {
      io.to(rid).emit("adminMessage", "🏁 5 Rounds completed! Showdown!");
      return resolveShowdown(rid);
    }

    io.to(rid).emit("gameState", game);
    startTurnTimer(rid);
    if (game.players[game.currentTurn].isBot) handleBotTurn(rid);
  }

  function createDeck(): Card[] {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    for (const suit of suits) for (const rank of ranks) deck.push({ suit, rank });
    return deck.sort(() => Math.random() - 0.5);
  }

  function handleBotTurn(rid: string) {
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    const currentPlayer = game.players[game.currentTurn];
    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.isFolded) return;

    setTimeout(() => {
      if (!game.gameStarted) return;
      const random = Math.random();
      
      if (currentPlayer.isBlind && random < 0.4) {
        currentPlayer.isBlind = false;
        io.to(rid).emit("gameState", game);
        return handleBotTurn(rid);
      }

      let action = "chaal";
      if (random < 0.1) action = "fold";
      else if (random > 0.8) action = "raise";

      if (action === "fold") currentPlayer.isFolded = true;
      else if (action === "chaal") {
        const bet = currentPlayer.isBlind ? game.lastBet : game.lastBet * 2;
        if (currentPlayer.chips < bet) {
          currentPlayer.isFolded = true;
        } else {
          currentPlayer.chips -= bet; game.pot += bet;
        }
      } else if (action === "raise") {
        game.lastBet += 100000;
        const bet = currentPlayer.isBlind ? game.lastBet : game.lastBet * 2;
        if (currentPlayer.chips < bet) {
          currentPlayer.isFolded = true;
        } else {
          currentPlayer.chips -= bet; game.pot += bet;
        }
      }

      nextTurn(rid);
    }, 2000);
  }

  io.on("connection", (socket) => {
    socket.on("joinRoom", ({ roomId, name }) => {
      let rid = (roomId || "main-table").trim().toLowerCase();
      
      if (!rooms[rid]) {
        rooms[rid] = { 
          players: [
            { id: "bot1", name: "😈 Lucifer Bot 1", chips: 500000000, hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: true },
            { id: "bot2", name: "🔥 Lucifer Bot 2", chips: 500000000, hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: true }
          ], 
          pot: 0, currentTurn: 0, lastBet: 50000, gameStarted: false, winner: null, deck: [], roundCount: 0 
        };
      }
      
      const game = rooms[rid];
      const playerName = (name || "Player").trim();
      
      if (game.players.filter((p:any) => p.isBot).length < 2) {
        game.players.unshift({ id: "bot1", name: "😈 Lucifer Bot 1", chips: 500000000, hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: true });
        game.players.unshift({ id: "bot2", name: "🔥 Lucifer Bot 2", chips: 500000000, hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: true });
      }

      const existingPlayer = game.players.find((p: any) => p.name === playerName);
      if (existingPlayer && !existingPlayer.isBot) {
        existingPlayer.id = socket.id;
        existingPlayer.chips = getPlayerChips(playerName);
        socket.join(rid);
        return io.to(rid).emit("gameState", game);
      }

      socket.join(rid);
      game.players.push({ 
        id: socket.id, name: playerName, chips: getPlayerChips(playerName), 
        hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: false 
      });
      io.to(rid).emit("gameState", game);
    });

    socket.on("startGame", (rid) => {
      const game = rooms[rid.trim().toLowerCase()];
      if (game && game.players.length >= 2) {
        game.gameStarted = true;
        game.deck = createDeck();
        game.pot = 0;
        game.lastBet = 50000;
        game.winner = null;
        game.roundCount = 0;
        game.players.forEach((p: any) => {
          p.hand = [game.deck.pop(), game.deck.pop(), game.deck.pop()];
          p.isFolded = false; p.isBlind = true;
          p.chips -= 50000; game.pot += 50000;
          if (!p.isBot) updatePlayerChips(p.name, p.chips);
        });
        game.currentTurn = 0;
        io.to(rid.trim().toLowerCase()).emit("gameState", game);
        startTurnTimer(rid.trim().toLowerCase());
        if (game.players[game.currentTurn].isBot) handleBotTurn(rid.trim().toLowerCase());
      }
    });

    socket.on("action", ({ roomId, action, amount }) => {
      const rid = roomId.trim().toLowerCase();
      const game = rooms[rid];
      if (!game) return;
      const player = game.players[game.currentTurn];
      if (!player || player.id !== socket.id) return;

      if (action === "fold") player.isFolded = true;
      else if (action === "chaal") {
        const bet = player.isBlind ? game.lastBet : game.lastBet * 2;
        if (player.chips < bet) {
          player.isFolded = true;
          socket.emit("adminMessage", "❌ Not enough chips! You are folded.");
        } else {
          player.chips -= bet; game.pot += bet;
        }
      } else if (action === "raise") {
        const raiseAmount = amount ? parseInt(amount) : 100000;
        const newLastBet = game.lastBet + raiseAmount;
        const bet = player.isBlind ? newLastBet : newLastBet * 2;
        
        if (player.chips < bet) {
          player.isFolded = true;
          socket.emit("adminMessage", "❌ Not enough chips for this raise! You are folded.");
        } else {
          game.lastBet = newLastBet;
          player.chips -= bet; game.pot += bet;
        }
      } else if (action === "see") {
        player.isBlind = false;
        return io.to(rid).emit("gameState", game);
      }

      if (!player.isBot) updatePlayerChips(player.name, player.chips);
      nextTurn(rid);
    });

    socket.on("disconnect", () => {
      Object.keys(rooms).forEach(rid => {
        rooms[rid].players = rooms[rid].players.filter((p: any) => p.id !== socket.id || p.isBot);
        io.to(rid).emit("gameState", rooms[rid]);
      });
    });

    socket.on("getAdminStats", (adminName) => {
      if (adminName?.trim().toLowerCase() === "admin") {
        socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
      }
    });

    socket.on("resetAllChips", (adminName) => {
      if (adminName?.trim().toLowerCase() !== "admin") return;
      db.prepare('UPDATE players SET chips = 50000000').run();
      Object.keys(rooms).forEach(rid => {
        rooms[rid].players.forEach((p: any) => { p.chips = 50000000; });
        io.to(rid).emit("gameState", rooms[rid]);
      });
      socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
      socket.emit("adminMessage", "✅ All chips reset to 50,000,000!");
    });

    socket.on("resetPlayerChips", ({ adminName, targetName }) => {
      if (adminName?.trim().toLowerCase() !== "admin") return;
      db.prepare('UPDATE players SET chips = 50000000 WHERE name = ?').run(targetName);
      Object.keys(rooms).forEach(rid => {
        const p = rooms[rid].players.find((pl: any) => pl.name === targetName);
        if (p) { p.chips = 50000000; io.to(rid).emit("gameState", rooms[rid]); }
      });
      socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
      socket.emit("adminMessage", `✅ ${targetName}'s chips reset!`);
    });

    socket.on("addPlayerChips", ({ adminName, targetName, amount }) => {
      if (adminName?.trim().toLowerCase() === "admin") {
        const addAmount = parseInt(amount);
        if (isNaN(addAmount)) return;
        db.prepare('UPDATE players SET chips = chips + ? WHERE name = ?').run(addAmount, targetName);
        Object.keys(rooms).forEach(rid => {
          const p = rooms[rid].players.find((pl: any) => pl.name === targetName);
          if (p) { p.chips += addAmount; io.to(rid).emit("gameState", rooms[rid]); }
        });
        socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
        socket.emit("adminMessage", `✅ Added ${addAmount.toLocaleString()} chips to ${targetName}!`);
      }
    });

    socket.on("adminAction", ({ roomId, type, targetId, amount, adminName }) => {
      if (adminName?.trim().toLowerCase() !== "admin") return;
      const game = rooms[roomId];
      if (!game) return;
      if (type === 'addChips') {
        const player = game.players.find((p: any) => p.id === targetId);
        if (player) {
          const addAmount = parseInt(amount) || 1000000;
          player.chips += addAmount;
          updatePlayerChips(player.name, player.chips);
          io.to(roomId).emit("gameState", game);
          socket.emit("adminMessage", `✅ Added ${addAmount.toLocaleString()} chips to ${player.name}!`);
        }
      }
    });
  });

  // --- Resilient Serving ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) { next(e); }
    });
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.url.startsWith('/api')) return res.status(404).end();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Lucifer Server live on port ${PORT}`);
  });
}

startServer();