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
    pingTimeout: 60000,
    pingInterval: 25000
  });
  const PORT = 3000;

  const rooms: any = {};
  const turnTimers: any = {};
  const autoStartTimers: any = {};

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
    if (turnTimers[rid]) clearTimeout(turnTimers[rid]);
    emitGameState(rid);
    setTimeout(() => checkAutoStart(rid), 3000);
  }

  function startTurnTimer(rid: string) {
    if (turnTimers[rid]) clearTimeout(turnTimers[rid]);
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    turnTimers[rid] = setTimeout(() => {
      const g = rooms[rid];
      if (!g || !g.gameStarted) return;
      const player = g.players[g.currentTurn];
      if (player) {
        player.isFolded = true;
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
      emitGameState(rid);
      setTimeout(() => checkAutoStart(rid), 3000);
      return;
    }
    const oldTurn = game.currentTurn;
    do { game.currentTurn = (game.currentTurn + 1) % game.players.length; } 
    while (game.players[game.currentTurn].isFolded);
    if (game.currentTurn <= oldTurn) game.roundCount++;
    if (game.roundCount >= 5) return resolveShowdown(rid);
    emitGameState(rid);
    startTurnTimer(rid);
    if (game.players[game.currentTurn].isBot) handleBotTurn(rid);
  }

  function handleBotTurn(rid: string) {
    const game = rooms[rid];
    if (!game || !game.gameStarted) return;
    setTimeout(() => {
      if (!game.gameStarted) return;
      const currentPlayer = game.players[game.currentTurn];
      if (!currentPlayer || !currentPlayer.isBot) return;
      const bet = currentPlayer.isBlind ? game.lastBet : game.lastBet * 2;
      if (currentPlayer.chips < bet) currentPlayer.isFolded = true;
      else { currentPlayer.chips -= bet; game.pot += bet; }
      nextTurn(rid);
    }, 2000);
  }

  function checkAutoStart(rid: string) {
    const game = rooms[rid];
    if (!game || game.gameStarted) return;
    if (game.players.length >= 2) {
      game.autoStartIn = 5;
      if (autoStartTimers[rid]) clearInterval(autoStartTimers[rid]);
      autoStartTimers[rid] = setInterval(() => {
        game.autoStartIn--;
        if (game.autoStartIn <= 0) { clearInterval(autoStartTimers[rid]); startGame(rid); }
        else emitGameState(rid);
      }, 1000);
    }
  }

  function startGame(rid: string) {
    const game = rooms[rid];
    if (game && game.players.length >= 2) {
      game.gameStarted = true; game.pot = 0; game.lastBet = 50000; game.winner = null; game.roundCount = 0;
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const deck: Card[] = [];
      for (const suit of suits) for (const rank of ranks) deck.push({ suit, rank });
      const shuffled = deck.sort(() => Math.random() - 0.5);
      game.players.forEach((p: any) => {
        p.hand = [shuffled.pop(), shuffled.pop(), shuffled.pop()];
        p.isFolded = false; p.isBlind = true; p.chips -= 50000; game.pot += 50000;
        if (!p.isBot) updatePlayerChips(p.name, p.chips);
      });
      game.currentTurn = 0; emitGameState(rid);
      startTurnTimer(rid);
      if (game.players[game.currentTurn].isBot) handleBotTurn(rid);
    }
  }

  io.on("connection", (socket) => {
    socket.on("joinRoom", ({ roomId, name }) => {
      let rid = (roomId || "main-table").trim().toLowerCase();
      if (!rooms[rid]) rooms[rid] = { players: [{ id: "bot1", name: "😈 Lucifer Bot 1", chips: 500000000, hand: [], isFolded: false, isBlind: true, isBot: true }], pot: 0, currentTurn: 0, lastBet: 50000, gameStarted: false, winner: null, roundCount: 0 };
      socket.join(rid);
      rooms[rid].players.push({ id: socket.id, name: name || "Player", chips: getPlayerChips(name), hand: [], isFolded: false, isBlind: true, isBot: false });
      emitGameState(rid);
      checkAutoStart(rid);
    });

    socket.on("startGame", (rid) => startGame(rid.trim().toLowerCase()));

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
        game.lastBet += (amount || 100000);
        const bet = player.isBlind ? game.lastBet : game.lastBet * 2;
        player.chips -= bet; game.pot += bet;
      } else if (action === "see") { player.isBlind = false; return emitGameState(rid); }
      if (!player.isBot) updatePlayerChips(player.name, player.chips);
      nextTurn(rid);
    });

    socket.on("disconnect", () => {
      Object.keys(rooms).forEach(rid => {
        rooms[rid].players = rooms[rid].players.filter((p: any) => p.id !== socket.id || p.isBot);
        emitGameState(rid);
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Lucifer Server live on port ${PORT}`));
}

startServer();
