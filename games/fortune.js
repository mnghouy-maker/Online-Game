/*
 * Fortune God — 5x3 video slot engine (server side).
 *
 * - 5 reels x 3 rows, 10 fixed paylines, wins pay left to right.
 * - WILD (the Fortune God) appears on reels 2-4 and substitutes for
 *   everything except the scatter.
 * - 3+ scatter coins anywhere pay a bonus and start 8 free spins;
 *   free-spin wins are doubled and can retrigger.
 * - Pays are expressed as a multiple of the TOTAL bet.
 *
 * Tuned by simulation (see README): RTP ~93% overall.
 */

const crypto = require("crypto");

// per-reel symbol weights; W = wild, S = scatter, M1..M4 = themed picture
// symbols (ingot, red envelope, firecracker, jade), A/K/Q/J = card symbols
const REEL_WEIGHTS = [
  { M1: 5, M2: 6, M3: 7, M4: 8, A: 10, K: 11, Q: 12, J: 13, S: 2 },
  { W: 3, M1: 5, M2: 6, M3: 7, M4: 8, A: 10, K: 11, Q: 12, J: 13, S: 2 },
  { W: 3, M1: 5, M2: 6, M3: 7, M4: 8, A: 10, K: 11, Q: 12, J: 13, S: 2 },
  { W: 3, M1: 5, M2: 6, M3: 7, M4: 8, A: 10, K: 11, Q: 12, J: 13, S: 2 },
  { M1: 5, M2: 6, M3: 7, M4: 8, A: 10, K: 11, Q: 12, J: 13, S: 2 },
];

// row index on each reel, left to right
const PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 1, 1, 2],
];

// line pays as multiple of total bet, for 3 / 4 / 5 in a row
const PAYTABLE = {
  M1: { 3: 7,   4: 30,  5: 100 },
  M2: { 3: 5,   4: 18,  5: 70 },
  M3: { 3: 3.5, 4: 14,  5: 45 },
  M4: { 3: 3.5, 4: 10,  5: 30 },
  A:  { 3: 2,   4: 5.5, 5: 18 },
  K:  { 3: 2,   4: 5,   5: 15 },
  Q:  { 3: 1,   4: 3.5, 5: 10 },
  J:  { 3: 1,   4: 3,   5: 9 },
};

// scatter pays (anywhere on screen), multiple of total bet
const SCATTER_PAY = { 3: 3, 4: 10, 5: 50 };
const FREE_SPINS_AWARD = 8;
const FREE_SPIN_MULTIPLIER = 2;

const ALLOWED_BETS = [10, 25, 50, 100];

// precompute cumulative weight tables per reel
const REEL_TABLES = REEL_WEIGHTS.map((weights) => {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  return { entries, total };
});

function randInt(max) {
  // unbiased integer in [0, max) from crypto bytes
  let r;
  do {
    r = crypto.randomBytes(4).readUInt32BE(0);
  } while (r >= 4294967296 - (4294967296 % max));
  return r % max;
}

function drawSymbol(reelIdx) {
  const { entries, total } = REEL_TABLES[reelIdx];
  let r = randInt(total);
  for (const [sym, w] of entries) {
    if (r < w) return sym;
    r -= w;
  }
  return entries[0][0]; // unreachable
}

// grid[reel][row]
function spinGrid() {
  const grid = [];
  for (let reel = 0; reel < 5; reel++) {
    grid.push([drawSymbol(reel), drawSymbol(reel), drawSymbol(reel)]);
  }
  return grid;
}

function evaluate(grid, bet, multiplier) {
  const lineWins = [];
  let total = 0;

  PAYLINES.forEach((line, lineIdx) => {
    const syms = line.map((row, reel) => grid[reel][row]);
    // the line pays on its first non-wild symbol (wilds fill in)
    let base = null;
    for (const s of syms) {
      if (s !== "W") { base = s; break; }
    }
    if (base === null || base === "S" || !PAYTABLE[base]) return;
    let count = 0;
    for (const s of syms) {
      if (s === base || s === "W") count++;
      else break;
    }
    const pay = PAYTABLE[base][count];
    if (pay) {
      const win = Math.round(bet * pay * multiplier);
      total += win;
      lineWins.push({ line: lineIdx, symbol: base, count, win });
    }
  });

  let scatters = 0;
  for (let reel = 0; reel < 5; reel++) {
    for (let row = 0; row < 3; row++) {
      if (grid[reel][row] === "S") scatters++;
    }
  }
  let scatterWin = 0;
  if (scatters >= 3) {
    scatterWin = Math.round(bet * SCATTER_PAY[Math.min(scatters, 5)] * multiplier);
    total += scatterWin;
  }

  return { total, lineWins, scatters, scatterWin, freeSpinsWon: scatters >= 3 ? FREE_SPINS_AWARD : 0 };
}

// One spin. state = user's saved free-spin state ({spins, bet}) or null.
// Returns everything the API needs; caller applies balance changes.
function play(bet, state) {
  const inFreeSpins = state && state.spins > 0;
  const effectiveBet = inFreeSpins ? state.bet : bet;
  const multiplier = inFreeSpins ? FREE_SPIN_MULTIPLIER : 1;

  const grid = spinGrid();
  const result = evaluate(grid, effectiveBet, multiplier);

  let nextState = state ? { spins: state.spins, bet: state.bet } : { spins: 0, bet: 0 };
  if (inFreeSpins) nextState.spins -= 1;
  if (result.freeSpinsWon) {
    nextState.spins += result.freeSpinsWon;
    if (!inFreeSpins) nextState.bet = effectiveBet;
  }
  if (nextState.spins === 0) nextState.bet = 0;

  return {
    grid,
    bet: effectiveBet,
    cost: inFreeSpins ? 0 : effectiveBet,
    win: result.total,
    lineWins: result.lineWins,
    scatters: result.scatters,
    scatterWin: result.scatterWin,
    freeSpinsWon: result.freeSpinsWon,
    wasFreeSpin: inFreeSpins,
    multiplier,
    state: nextState,
  };
}

module.exports = {
  play,
  ALLOWED_BETS,
  PAYLINES,
  PAYTABLE,
  SCATTER_PAY,
  FREE_SPINS_AWARD,
  FREE_SPIN_MULTIPLIER,
};
