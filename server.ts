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
db.exec(`CREATE TABLE IF NOT EXISTS players (name TEXT PRIMARY KEY, chips BIGINT DEFAULT 50000000)`);

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
  const io = new Server(httpServer, { 
    cors: { origin: "*" },
    transports: ['polling', 'websocket']
  });
  const PORT = Number(process.env.PORT) || 3000;

  const rooms: any = {};

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
            if (p.id !== socketId && !p.isBot) p.chips = -1; 
          });
          socket.emit("gameState", stateToSend);
        }
      }
    }
  }

  function resolveShowdown(rid: string) {
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
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
    }
    game.gameStarted = false;
    emitGameState(rid);
    setTimeout(() => { if (!game.gameStarted) startGame(rid); }, 5000);
  }

  function nextTurn(rid: string) {
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
      emitGameState(rid);
      setTimeout(() => { if (!game.gameStarted) startGame(rid); }, 5000);
      return;
    }
    const oldTurn = game.currentTurn;
    let safety = 0;
    do { 
      game.currentTurn = (game.currentTurn + 1) % game.players.length; 
      safety++;
    } while (game.players[game.currentTurn].isFolded && safety < 20);
    
    if (game.currentTurn <= oldTurn) game.roundCount++;
    if (game.roundCount >= 5) {
      game.players.forEach((p: any) => { if (!p.isFolded) p.isBlind = false; });
      return resolveShowdown(rid);
    }
    emitGameState(rid);
    if (game.players[game.currentTurn].isBot) handleBotTurn(rid);
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
    const game = rooms[rid];
    if (game && game.players.length >= 2) {
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
      if (game.players[game.currentTurn].isBot) handleBotTurn(rid);
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
    socket.on("disconnect", () => {
      Object.keys(rooms).forEach(rid => {
        const game = rooms[rid];
        const playerIndex = game.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          const wasTheirTurn = game.gameStarted && game.currentTurn === playerIndex;
          game.players.splice(playerIndex, 1);
          if (game.gameStarted) {
            if (playerIndex < game.currentTurn) game.currentTurn--;
            if (wasTheirTurn || game.currentTurn >= game.players.length) {
              game.currentTurn = game.currentTurn % (game.players.length || 1);
              const active = game.players.filter((p: any) => !p.isFolded);
              if (active.length <= 1) resolveShowdown(rid);
              else {
                while (game.players[game.currentTurn] && game.players[game.currentTurn].isFolded) {
                  game.currentTurn = (game.currentTurn + 1) % game.players.length;
                }
                if (game.players[game.currentTurn]?.isBot) handleBotTurn(rid);
              }
            }
          }
          const realPlayers = game.players.filter((p: any) => !p.isBot);
          if (realPlayers.length === 0) { game.gameStarted = false; game.winner = null; }
          emitGameState(rid);
        }
      });
    });

    socket.on("joinRoom", ({ roomId, name }) => {
      let rid = (roomId || "table-1").trim().toLowerCase();
      if (!rooms[rid]) {
        rooms[rid] = { 
          players: [{ id: "bot1", name: "😈 Lucifer Bot", chips: 500000000, hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: true }], 
          pot: 0, currentTurn: 0, lastBet: 50000, gameStarted: false, winner: null, deck: [], roundCount: 0 
        };
      }
      const game = rooms[rid];
      const playerName = (name || "Player").trim();
      const existingPlayerIndex = game.players.findIndex((p: any) => p.name === playerName);
      if (existingPlayerIndex !== -1 && !game.players[existingPlayerIndex].isBot) {
        game.players[existingPlayerIndex].id = socket.id;
        game.players[existingPlayerIndex].chips = getPlayerChips(playerName);
      } else {
        game.players.push({ 
          id: socket.id, name: playerName, chips: getPlayerChips(playerName), 
          hand: [], isFolded: false, isBlind: true, currentBet: 0, isBot: false 
        });
      }
      socket.join(rid);
      emitGameState(rid);
      if (!game.gameStarted && game.players.length >= 3) {
        setTimeout(() => { if (!game.gameStarted) startGame(rid); }, 2000);
      }
    });

    socket.on("startGame", (rid) => { startGame(rid?.trim().toLowerCase() || "table-1"); });

    socket.on("action", ({ roomId, action, amount }) => {
      const rid = roomId.trim().toLowerCase();
      const game = rooms[rid];
      if (!game) return;
      const player = game.players[game.currentTurn];
      if (!player || player.id !== socket.id) return;
      if (action === "fold") player.isFolded = true;
      else if (action === "chaal") {
        const bet = player.isBlind ? game.lastBet : game.lastBet * 2;
        player.chips -= bet; game.pot += bet;
      } else if (action === "raise") {
        const raiseAmount = parseInt(amount) || 100000;
        game.lastBet += raiseAmount;
        const bet = player.isBlind ? game.lastBet : game.lastBet * 2;
        player.chips -= bet; game.pot += bet;
      } else if (action === "see") {
        player.isBlind = false;
        return emitGameState(rid);
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

    socket.on("sideShowRequest", (rid) => {
      const roomID = rid?.trim().toLowerCase() || "table-1";
      const game = rooms[roomID];
      if (!game || !game.gameStarted) return;
      const currentPlayer = game.players[game.currentTurn];
      if (currentPlayer.id !== socket.id || currentPlayer.isBlind) return;
      let prevIdx = (game.currentTurn - 1 + game.players.length) % game.players.length;
      let count = 0;
      while (game.players[prevIdx].isFolded && count < game.players.length) {
        prevIdx = (prevIdx - 1 + game.players.length) % game.players.length;
        count++;
      }
      const prevPlayer = game.players[prevIdx];
      if (prevPlayer.isBlind || prevPlayer.isFolded) return;
      io.to(prevPlayer.id).emit("sideShowPrompt", { fromName: currentPlayer.name });
    });

    socket.on("sideShowResponse", ({ roomId, accepted }) => {
      const rid = roomId?.trim().toLowerCase() || "table-1";
      const game = rooms[rid];
      if (!game || !game.gameStarted) return;
      const currentPlayer = game.players[game.currentTurn];
      let prevIdx = (game.currentTurn - 1 + game.players.length) % game.players.length;
      let count = 0;
      while (game.players[prevIdx].isFolded && count < game.players.length) {
        prevIdx = (prevIdx - 1 + game.players.length) % game.players.length;
        count++;
      }
      const prevPlayer = game.players[prevIdx];
      if (accepted) {
        const score1 = getHandScore(currentPlayer.hand);
        const score2 = getHandScore(prevPlayer.hand);
        if (score1 > score2) prevPlayer.isFolded = true;
        else currentPlayer.isFolded = true;
        nextTurn(rid);
      }
    });

    socket.on("addPlayerChips", ({ adminName, adminPassword, targetName, amount }) => {
      if (adminName?.trim() === "LUCIFER_DEV_777" && adminPassword === "LUCIFER_PASS_999") {
        const addAmount = parseInt(amount);
        db.prepare('UPDATE players SET chips = chips + ? WHERE name = ?').run(addAmount, targetName);
        Object.keys(rooms).forEach(rid => {
          const p = rooms[rid].players.find((pl: any) => pl.name === targetName);
          if (p) { p.chips += addAmount; io.to(rid).emit("gameState", rooms[rid]); }
        });
        socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
      }
    });

    socket.on("resetPlayerChips", ({ adminName, adminPassword, targetName }) => {
      if (adminName?.trim() === "LUCIFER_DEV_777" && adminPassword === "LUCIFER_PASS_999") {
        db.prepare('UPDATE players SET chips = 50000000 WHERE name = ?').run(targetName);
        Object.keys(rooms).forEach(rid => {
          const p = rooms[rid].players.find((pl: any) => pl.name === targetName);
          if (p) { p.chips = 50000000; io.to(rid).emit("gameState", rooms[rid]); }
        });
        socket.emit("adminStats", db.prepare('SELECT name, chips FROM players ORDER BY chips DESC').all());
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
