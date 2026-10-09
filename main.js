/* ===================== 配置 ===================== */
const SIZE = 16;
const MINE_COUNT = 30;
const HUMAN_PLAYER = 1;
const AI_PLAYER = 2;

/* ===================== 状态 ===================== */
let board = [];
let currentPlayer = 1;
let gameOver = false;
let exploredCount = 0;
let gameMode = 'pve';
let difficulty = 'medium';
let isAiThinking = false;
let lastMove = null;
let winLine = [];

/* ===================== DOM ===================== */
const boardEl = document.getElementById('board');
const turnChip = document.getElementById('turnChip');
const turnText = document.getElementById('turnText');
const mineCountEl = document.getElementById('mineCount');
const exploredEl = document.getElementById('explored');
const turnStat = document.getElementById('turnStat');
const restartBtn = document.getElementById('restart');
const diffSeg = document.getElementById('diffSeg');
const modeBtns = document.querySelectorAll('#modeSeg .seg-btn');
const diffBtns = document.querySelectorAll('#diffSeg .seg-btn');
const introOverlay = document.getElementById('introOverlay');
const introClose = document.getElementById('introClose');
const helpBtn = document.getElementById('helpBtn');
const resultOverlay = document.getElementById('resultOverlay');
const resultTitle = document.getElementById('resultTitle');
const resultDesc = document.getElementById('resultDesc');
const resultRestart = document.getElementById('resultRestart');

/* ===================== 棋盘数据 ===================== */
function createBoard() {
  board = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) {
      row.push({ isMine: false, revealed: false, player: null, number: 0 });
    }
    board.push(row);
  }
}

function placeMines() {
  const centerR = (SIZE - 1) / 2;
  const centerC = (SIZE - 1) / 2;
  const maxDist = Math.sqrt(centerR * centerR + centerC * centerC);

  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2);
      const norm = dist / maxDist;
      const weight = 1 + (1 - norm) * 0.5;
      cells.push({ r, c, weight });
    }
  }

  const placedSet = new Set();
  while (placedSet.size < MINE_COUNT) {
    let totalWeight = 0;
    for (const cell of cells) {
      if (placedSet.has(cell.r + ',' + cell.c)) continue;
      totalWeight += cell.weight;
    }
    let rand = Math.random() * totalWeight;
    let chosen = null;
    for (const cell of cells) {
      if (placedSet.has(cell.r + ',' + cell.c)) continue;
      rand -= cell.weight;
      if (rand <= 0) { chosen = cell; break; }
    }
    if (chosen) {
      board[chosen.r][chosen.c].isMine = true;
      placedSet.add(chosen.r + ',' + chosen.c);
    }
  }
}

function calculateNumbers() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc].isMine) count++;
        }
      }
      board[r][c].number = count;
    }
  }
}

/* ===================== 渲染 ===================== */
function isWinCell(r, c) {
  return winLine.some(([wr, wc]) => wr === r && wc === c);
}

function renderBoard() {
  boardEl.innerHTML = '';

  const corner = document.createElement('div');
  corner.className = 'coord';
  boardEl.appendChild(corner);

  for (let c = 0; c < SIZE; c++) {
    const lbl = document.createElement('div');
    lbl.className = 'coord';
    lbl.textContent = String.fromCharCode(65 + c);
    boardEl.appendChild(lbl);
  }

  for (let r = 0; r < SIZE; r++) {
    const rlbl = document.createElement('div');
    rlbl.className = 'coord';
    rlbl.textContent = r + 1;
    boardEl.appendChild(rlbl);

    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      const div = document.createElement('div');
      div.className = 'cell';

      if (cell.revealed) {
        div.classList.add('revealed');
        if (cell.isMine) {
          div.classList.add('mine');
          div.textContent = '✸';
        } else if (cell.player) {
          const stone = document.createElement('div');
          stone.className = 'stone ' + (cell.player === 1 ? 'black' : 'white');
          div.appendChild(stone);
        } else if (cell.number > 0) {
          div.textContent = cell.number;
          div.classList.add('num', 'n' + cell.number, 'empty');
        } else {
          div.classList.add('empty');
        }
      }

      if (isWinCell(r, c)) {
        div.classList.add('win-line');
      } else if (lastMove && lastMove.r === r && lastMove.c === c && cell.player) {
        div.classList.add('last-move');
      }

      div.addEventListener('click', () => handleCellClick(r, c));
      boardEl.appendChild(div);
    }
  }

  updateStatus();
}

function updateStatus() {
  exploredEl.textContent = exploredCount;

  if (isAiThinking) {
    turnChip.className = 'turn-chip thinking';
    turnText.textContent = '电脑思考中…';
    turnStat.textContent = '电脑';
    return;
  }

  turnChip.className = 'turn-chip p' + currentPlayer;

  if (gameMode === 'pve') {
    if (currentPlayer === HUMAN_PLAYER) {
      turnText.textContent = '你的回合';
      turnStat.textContent = '你';
    } else {
      turnText.textContent = '电脑回合';
      turnStat.textContent = '电脑';
    }
  } else {
    turnText.textContent = '玩家' + currentPlayer + ' 回合';
    turnStat.textContent = '玩家' + currentPlayer;
  }
}

/* ===================== 点击 ===================== */
function handleCellClick(r, c, isAi = false) {
  if (gameOver) return;
  if (!isAi && isAiThinking) return;
  if (!isAi && gameMode === 'pve' && currentPlayer !== HUMAN_PLAYER) return;

  const cell = board[r][c];
  if (cell.player) return;

  if (cell.isMine) {
    const exploded = handleMineExplosion(r, c);
    if (lastMove && exploded.some(([er, ec]) => er === lastMove.r && ec === lastMove.c)) {
      lastMove = null;
    }
    renderBoard();
    applyExplosionAnimation(exploded);
    triggerScreenShake();
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateStatus();
    maybeAiTurn();
    return;
  }

  const wasRevealed = cell.revealed;
  if (!wasRevealed) revealCell(r, c);
  placePiece(r, c, currentPlayer);
  lastMove = { r, c };

  const line = findWinLine(r, c, currentPlayer);
  if (line) {
    gameOver = true;
    winLine = line;
    renderBoard();
    updateStatus();
    showResult(currentPlayer);
    return;
  }

  renderBoard();
  updateStatus();
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateStatus();
  maybeAiTurn();
}

function placePiece(r, c, player) {
  board[r][c].player = player;
  board[r][c].revealed = true;
}

function revealCell(r, c) {
  if (board[r][c].number === 0) revealZeroArea(r, c);
  updateExploredCount();
}

function revealZeroArea(r, c) {
  const stack = [[r, c]];
  const visited = new Set();

  while (stack.length > 0) {
    const [cr, cc] = stack.pop();
    const key = cr + ',' + cc;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board[cr][cc];
    if (cell.isMine) continue;
    if (cell.revealed && !cell.player) continue;
    if (!cell.player) cell.revealed = true;

    if (cell.number === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
          const nb = board[nr][nc];
          if (!nb.revealed && !nb.isMine) stack.push([nr, nc]);
        }
      }
    }
  }
}

function updateExploredCount() {
  let count = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c].revealed) count++;
  exploredCount = count;
}

/* ===================== 爆炸 ===================== */
function handleMineExplosion(r, c) {
  const exploded = [];
  board[r][c].isMine = false;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      exploded.push([nr, nc]);
      const cell = board[nr][nc];
      cell.player = null;
      cell.revealed = true;
    }
  }

  calculateNumbers();
  updateExploredCount();
  return exploded;
}

function applyExplosionAnimation(positions) {
  for (const [r, c] of positions) {
    const idx = (r + 1) * (SIZE + 1) + c + 1;
    const el = boardEl.children[idx];
    if (el) {
      el.classList.add('exploding');
      setTimeout(() => el.classList.remove('exploding'), 850);
    }
  }
}

function triggerScreenShake() {
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 520);
}

/* ===================== 五子棋判定 ===================== */
function findWinLine(r, c, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line = [[r, c]];
    for (let s = 1; s < 5; s++) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      const cell = board[nr][nc];
      if (cell.player === player) line.push([nr, nc]); else break;
    }
    for (let s = 1; s < 5; s++) {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      const cell = board[nr][nc];
      if (cell.player === player) line.unshift([nr, nc]); else break;
    }
    if (line.length >= 5) return line;
  }
  return null;
}

/* ===================== 结果面板 ===================== */
function showResult(player) {
  resultTitle.classList.add('win');
  if (gameMode === 'pve') {
    if (player === HUMAN_PLAYER) {
      resultTitle.textContent = '🎉 你赢了！';
      resultDesc.textContent = '恭喜战胜电脑，连成五子。';
    } else {
      resultTitle.textContent = '💻 电脑获胜';
      resultDesc.textContent = '电脑连成五子，再接再厉。';
    }
  } else {
    resultTitle.textContent = '🎉 玩家' + player + ' 获胜';
    resultDesc.textContent = '连成五子，游戏结束。';
  }
  resultOverlay.classList.remove('hidden');
}

function hideResult() {
  resultOverlay.classList.add('hidden');
  resultTitle.classList.remove('win');
}

/* =========================================================
   AI 模块
   ---------------------------------------------------------
   相比上一版的核心修复：
     - 新增 getMovesNearPieces()：只保留已有棋子附近的可下位置。
       避免 AI 从整个棋盘盲选，下到远离战场的角落。
     - 所有难度（含简单）都使用该过滤器。
     - 未揭示的地雷对 AI 仍然不可见（不偷看）。
   ========================================================= */

/* ---------- 邻域过滤：只考虑棋子附近的可下位置 ---------- */
function getMovesNearPieces(allMoves, radius) {
  // 检查棋盘上是否已有任何棋子
  let anyPiece = false;
  for (let r = 0; r < SIZE && !anyPiece; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c].player !== null) { anyPiece = true; break; }
    }
  }

  // 空棋盘：只考虑中心区域
  if (!anyPiece) {
    const center = (SIZE - 1) / 2;
    const result = [];
    for (const m of allMoves) {
      if (Math.abs(m.r - center) <= 3 && Math.abs(m.c - center) <= 3) {
        result.push(m);
      }
    }
    return result.length > 0 ? result : allMoves;
  }

  // 有棋子：只保留棋子附近 radius 范围内的可下位置
  const result = [];
  for (const m of allMoves) {
    let near = false;
    for (let dr = -radius; dr <= radius && !near; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = m.r + dr, nc = m.c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (board[nr][nc].player !== null) { near = true; break; }
      }
    }
    if (near) result.push(m);
  }
  return result.length > 0 ? result : allMoves;
}

/* ---------- 五子棋扫描（只用已揭示的雷做障碍） ---------- */
function scanLineDirection(r, c, dr, dc, player) {
  let count = 1;
  let openEnds = 0;

  let s = 1;
  while (s < 5) {
    const nr = r + dr * s, nc = c + dc * s;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
    const cell = board[nr][nc];
    if (cell.isMine && cell.revealed) break;
    if (cell.player === player) { count++; s++; } else break;
  }
  {
    const nr = r + dr * s, nc = c + dc * s;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      const e = board[nr][nc];
      if (!e.player && !(e.isMine && e.revealed)) openEnds++;
    }
  }

  s = 1;
  while (s < 5) {
    const nr = r - dr * s, nc = c - dc * s;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
    const cell = board[nr][nc];
    if (cell.isMine && cell.revealed) break;
    if (cell.player === player) { count++; s++; } else break;
  }
  {
    const nr = r - dr * s, nc = c - dc * s;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      const e = board[nr][nc];
      if (!e.player && !(e.isMine && e.revealed)) openEnds++;
    }
  }

  return { count, openEnds };
}

function gomokuPatternValue(count, openEnds) {
  if (count >= 5) return 100000000;
  if (count === 4) {
    if (openEnds === 2) return 10000000;
    if (openEnds === 1) return 50000;
    return 0;
  }
  if (count === 3) {
    if (openEnds === 2) return 5000;
    if (openEnds === 1) return 200;
    return 0;
  }
  if (count === 2) {
    if (openEnds === 2) return 150;
    if (openEnds === 1) return 20;
    return 0;
  }
  if (count === 1) {
    if (openEnds === 2) return 5;
    if (openEnds === 1) return 1;
    return 0;
  }
  return 0;
}

function evaluateGomokuMove(r, c, player) {
  const cell = board[r][c];
  if ((cell.isMine && cell.revealed) || cell.player) {
    return { score: -Infinity, hasFive: false, openFour: 0, closedFour: 0, openThree: 0, closedThree: 0 };
  }

  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let score = 0;
  let hasFive = false;
  let openFour = 0, closedFour = 0, openThree = 0, closedThree = 0;

  for (const [dr, dc] of dirs) {
    const { count, openEnds } = scanLineDirection(r, c, dr, dc, player);
    if (count >= 5) hasFive = true;
    else if (count === 4) {
      if (openEnds === 2) openFour++;
      else if (openEnds === 1) closedFour++;
    } else if (count === 3) {
      if (openEnds === 2) openThree++;
      else if (openEnds === 1) closedThree++;
    }
    score += gomokuPatternValue(count, openEnds);
  }

  if (hasFive) {
    score = 100000000;
  } else {
    if (openFour >= 1) score += 50000000;
    if (openFour + closedFour >= 2) score += 5000000;
    if (openFour >= 1 && openThree >= 1) score += 3000000;
    if (openThree >= 2) score += 1000000;
    if (closedFour >= 1 && openThree >= 1) score += 500000;
  }

  return { score, hasFive, openFour, closedFour, openThree, closedThree };
}

function isWinAt(r, c, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let s = 1; s < 5; s++) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      const cell = board[nr][nc];
      if (cell.isMine && cell.revealed) break;
      if (cell.player === player) count++; else break;
    }
    for (let s = 1; s < 5; s++) {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      const cell = board[nr][nc];
      if (cell.isMine && cell.revealed) break;
      if (cell.player === player) count++; else break;
    }
    if (count >= 5) return true;
  }
  return false;
}

function estimatePieceValue(r, c, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let value = 0;
  for (const [dr, dc] of dirs) {
    let count = 1;
    let openEnds = 0;

    let s = 1;
    while (s < 5) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      const cell = board[nr][nc];
      if (cell.isMine && cell.revealed) break;
      if (cell.player === player) { count++; s++; } else break;
    }
    {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
        const e = board[nr][nc];
        if (!e.player && !(e.isMine && e.revealed)) openEnds++;
      }
    }

    s = 1;
    while (s < 5) {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      const cell = board[nr][nc];
      if (cell.isMine && cell.revealed) break;
      if (cell.player === player) { count++; s++; } else break;
    }
    {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
        const e = board[nr][nc];
        if (!e.player && !(e.isMine && e.revealed)) openEnds++;
      }
    }

    value += gomokuPatternValue(count, openEnds);
  }
  return value;
}

function evaluateBoardState() {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell.player === AI_PLAYER) {
        score += estimatePieceValue(r, c, AI_PLAYER) * 0.5;
      } else if (cell.player === HUMAN_PLAYER) {
        score -= estimatePieceValue(r, c, HUMAN_PLAYER) * 0.6;
      }
    }
  }
  return score;
}

/* ---------- 模拟落子 / 爆炸 ---------- */
function simulateMove(r, c, player) {
  const cell = board[r][c];

  if (cell.isMine) {
    const savedMine = cell.isMine;
    const savedCellPlayer = cell.player;
    const savedCellRevealed = cell.revealed;
    cell.isMine = false;
    cell.player = null;
    cell.revealed = true;

    const saved3x3 = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        const nb = board[nr][nc];
        saved3x3.push({ r: nr, c: nc, player: nb.player, revealed: nb.revealed });
        nb.player = null;
        nb.revealed = true;
      }
    }

    return function undo() {
      cell.isMine = savedMine;
      cell.player = savedCellPlayer;
      cell.revealed = savedCellRevealed;
      for (const s of saved3x3) {
        board[s.r][s.c].player = s.player;
        board[s.r][s.c].revealed = s.revealed;
      }
    };
  }

  const savedPlayer = cell.player;
  const savedRevealed = cell.revealed;
  cell.player = player;
  cell.revealed = true;

  return function undo() {
    cell.player = savedPlayer;
    cell.revealed = savedRevealed;
  };
}

/* ---------- 候选快速评分 ---------- */
function quickScore(r, c) {
  const aiEv = evaluateGomokuMove(r, c, AI_PLAYER);
  const humanEv = evaluateGomokuMove(r, c, HUMAN_PLAYER);
  if (aiEv.hasFive) return 1e12;
  if (humanEv.hasFive) return 1e11;
  return aiEv.score * 1.1 + humanEv.score * 0.9;
}

/* ---------- 雷区推理（超级地狱专用） ---------- */
function inferMineStatus() {
  const knownSafe = new Set();
  const knownMine = new Set();
  const probability = new Map();

  let unknownCount = 0;
  let minesLeft = MINE_COUNT;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell.revealed && cell.isMine) minesLeft--;
      else if (!cell.revealed) unknownCount++;
    }
  }
  const globalProb = unknownCount > 0 ? minesLeft / unknownCount : 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c].revealed) probability.set(r + ',' + c, globalProb);
    }
  }

  let changed = true;
  let iter = 0;
  while (changed && iter < 8) {
    changed = false;
    iter++;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = board[r][c];
        if (!cell.revealed || cell.isMine || cell.number === 0) continue;

        const unknowns = [];
        let knownMineCount = 0;

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
            const nb = board[nr][nc];
            if (!nb.revealed) unknowns.push([nr, nc]);
            else if (nb.isMine) knownMineCount++;
          }
        }

        if (unknowns.length === 0) continue;
        const remaining = cell.number - knownMineCount;

        if (remaining === 0) {
          for (const [nr, nc] of unknowns) {
            const key = nr + ',' + nc;
            if (!knownSafe.has(key)) {
              knownSafe.add(key);
              probability.set(key, 0);
              changed = true;
            }
          }
        } else if (remaining === unknowns.length) {
          for (const [nr, nc] of unknowns) {
            const key = nr + ',' + nc;
            if (!knownMine.has(key)) {
              knownMine.add(key);
              probability.set(key, 1);
              changed = true;
            }
          }
        } else {
          const localProb = remaining / unknowns.length;
          for (const [nr, nc] of unknowns) {
            const key = nr + ',' + nc;
            if (knownSafe.has(key) || knownMine.has(key)) continue;
            const current = probability.get(key) || 0;
            if (localProb > current) {
              probability.set(key, localProb);
              changed = true;
            }
          }
        }
      }
    }
  }

  return { knownSafe, knownMine, probability };
}

/* ---------- 多步搜索 ---------- */
function searchBestMove(depth, candidates) {
  const startTime = performance.now();
  const timeLimit = 450;

  const sorted = candidates.map(m => ({ ...m, score: quickScore(m.r, m.c) }));
  sorted.sort((a, b) => b.score - a.score);

  const topN = depth >= 3 ? 8 : 12;
  const top = sorted.slice(0, topN);
  if (top.length === 0) return null;

  let bestMove = top[0];
  let bestValue = -Infinity;

  for (const m of top) {
    if (performance.now() - startTime > timeLimit) break;
    const value = evaluateMoveDeep(m, depth, candidates);
    if (value > bestValue) {
      bestValue = value;
      bestMove = m;
    }
  }

  return bestMove;
}

function evaluateMoveDeep(move, depth, candidates) {
  const undo = simulateMove(move.r, move.c, AI_PLAYER);

  let result;
  if (isWinAt(move.r, move.c, AI_PLAYER)) {
    result = 1e15;
  } else if (depth <= 1) {
    result = evaluateBoardState();
  } else {
    result = findOpponentBestResponse(depth - 1, candidates);
  }

  undo();
  return result;
}

function findOpponentBestResponse(depth, candidates) {
  const oppMoves = candidates.filter(m => {
    const cell = board[m.r][m.c];
    if (cell.player) return false;
    if (cell.isMine && cell.revealed) return false;
    return true;
  });

  const scored = oppMoves.map(m => {
    const oppEv = evaluateGomokuMove(m.r, m.c, HUMAN_PLAYER);
    const aiEv = evaluateGomokuMove(m.r, m.c, AI_PLAYER);
    return { ...m, score: oppEv.score * 1.1 + aiEv.score * 0.9 };
  });
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, depth >= 2 ? 6 : 4);
  let worstForAI = Infinity;

  for (const opp of top) {
    const undoOpp = simulateMove(opp.r, opp.c, HUMAN_PLAYER);
    let value;
    if (isWinAt(opp.r, opp.c, HUMAN_PLAYER)) {
      value = -1e14;
    } else if (depth <= 1) {
      value = evaluateBoardState();
    } else {
      value = findAIBestResponse(candidates);
    }
    undoOpp();
    if (value < worstForAI) worstForAI = value;
  }

  return worstForAI === Infinity ? evaluateBoardState() : worstForAI;
}

function findAIBestResponse(candidates) {
  const aiMoves = candidates.filter(m => {
    const cell = board[m.r][m.c];
    if (cell.player) return false;
    if (cell.isMine && cell.revealed) return false;
    return true;
  });

  const scored = aiMoves.map(m => ({ ...m, score: quickScore(m.r, m.c) }));
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 4);
  let bestForAI = -Infinity;

  for (const m of top) {
    const undo = simulateMove(m.r, m.c, AI_PLAYER);
    let value;
    if (isWinAt(m.r, m.c, AI_PLAYER)) {
      value = 1e14;
    } else {
      value = evaluateBoardState();
    }
    undo();
    if (value > bestForAI) bestForAI = value;
  }

  return bestForAI === -Infinity ? evaluateBoardState() : bestForAI;
}

/* ---------- 超级地狱：爆炸评估（只对已知/推理出的雷） ---------- */
function findBestExplosionMove(candidates) {
  const beforeState = evaluateBoardState();
  const { knownMine } = inferMineStatus();

  let best = null;
  let bestGain = -Infinity;

  for (const m of candidates) {
    const cell = board[m.r][m.c];
    if (!cell.isMine) continue;
    if (cell.player) continue;

    const isKnown = cell.revealed || knownMine.has(m.r + ',' + m.c);
    if (!isKnown) continue;

    let hasPiece = false;
    for (let dr = -1; dr <= 1 && !hasPiece; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = m.r + dr, nc = m.c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (board[nr][nc].player) { hasPiece = true; break; }
      }
    }
    if (!hasPiece) continue;

    const undo = simulateMove(m.r, m.c, AI_PLAYER);
    const afterState = evaluateBoardState();
    undo();
    const gain = afterState - beforeState;

    if (gain > bestGain) {
      bestGain = gain;
      best = { r: m.r, c: m.c, gain };
    }
  }

  return best;
}

function findBestSafeMove(candidates) {
  const beforeState = evaluateBoardState();

  let best = null;
  let bestGain = -Infinity;

  for (const m of candidates) {
    const cell = board[m.r][m.c];
    if (cell.player) continue;
    if (cell.isMine && cell.revealed) continue;

    const undo = simulateMove(m.r, m.c, AI_PLAYER);
    const afterState = evaluateBoardState();
    undo();
    const gain = afterState - beforeState;

    if (gain > bestGain) {
      bestGain = gain;
      best = { r: m.r, c: m.c, gain };
    }
  }

  return best;
}

/* ===================== 各难度决策 ===================== */

/* ---------- 简单：邻域内随机 ---------- */
function chooseEasyMove(allMoves) {
  // 20% 概率看一步胜
  if (Math.random() < 0.2) {
    for (const m of allMoves) {
      const cell = board[m.r][m.c];
      if (cell.isMine && cell.revealed) continue;
      if (isWinAt(m.r, m.c, AI_PLAYER)) return m;
    }
  }

  // 80% 概率从邻域里随机（半径 2）
  const nearby = getMovesNearPieces(allMoves, 2);
  return nearby[Math.floor(Math.random() * nearby.length)];
}

/* ---------- 中档：棋型评分 + 邻域随机 ---------- */
function chooseMediumMove(allMoves) {
  // 1. 立即获胜
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    if (isWinAt(m.r, m.c, AI_PLAYER)) return m;
  }

  // 2. 阻挡对方立即获胜
  const oppThreats = [];
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    if (isWinAt(m.r, m.c, HUMAN_PLAYER)) oppThreats.push(m);
  }
  if (oppThreats.length > 0) {
    let best = oppThreats[0];
    let bestScore = -Infinity;
    for (const threat of oppThreats) {
      const myEv = evaluateGomokuMove(threat.r, threat.c, AI_PLAYER);
      if (myEv.score > bestScore) {
        bestScore = myEv.score;
        best = threat;
      }
    }
    return best;
  }

  // 3. 只在邻域内选择
  const nearby = getMovesNearPieces(allMoves, 2);

  // 60% 用棋型评分从邻域里选最优；40% 邻域内纯随机
  if (Math.random() < 0.6) {
    const scored = nearby.map(m => ({ ...m, score: quickScore(m.r, m.c) }));
    scored.sort((a, b) => b.score - a.score);
    const topN = Math.min(3, scored.length);
    return scored[Math.floor(Math.random() * topN)];
  } else {
    return nearby[Math.floor(Math.random() * nearby.length)];
  }
}

/* ---------- 困难：棋型 + 2 层搜索，邻域内 ---------- */
function chooseHardMove(allMoves) {
  // 立即获胜
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    if (isWinAt(m.r, m.c, AI_PLAYER)) return m;
  }

  // 阻挡对方立即获胜
  const oppThreats = [];
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    if (isWinAt(m.r, m.c, HUMAN_PLAYER)) oppThreats.push(m);
  }
  if (oppThreats.length > 0) {
    let best = oppThreats[0];
    let bestScore = -Infinity;
    for (const threat of oppThreats) {
      const myEv = evaluateGomokuMove(threat.r, threat.c, AI_PLAYER);
      if (myEv.score > bestScore) {
        bestScore = myEv.score;
        best = threat;
      }
    }
    return best;
  }

  // 我做活四
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    const ev = evaluateGomokuMove(m.r, m.c, AI_PLAYER);
    if (ev.openFour >= 1) return m;
  }

  // 邻域候选
  const nearby = getMovesNearPieces(allMoves, 2);

  // 85% 走搜索；15% 邻域随机
  if (Math.random() < 0.85) {
    const move = searchBestMove(2, nearby);
    if (move) return move;
  }
  return nearby[Math.floor(Math.random() * nearby.length)];
}

/* ---------- 超级地狱：完整策略 + 邻域 ---------- */
function chooseHellMove(allMoves) {
  // 1. 立即获胜
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    if (isWinAt(m.r, m.c, AI_PLAYER)) return m;
  }

  // 2. 阻挡对方立即获胜
  const oppThreats = [];
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    if (isWinAt(m.r, m.c, HUMAN_PLAYER)) oppThreats.push(m);
  }
  if (oppThreats.length > 0) {
    let best = oppThreats[0];
    let bestScore = -Infinity;
    for (const threat of oppThreats) {
      const myEv = evaluateGomokuMove(threat.r, threat.c, AI_PLAYER);
      if (myEv.score > bestScore) {
        bestScore = myEv.score;
        best = threat;
      }
    }
    return best;
  }

  // 3. 我做活四
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    const ev = evaluateGomokuMove(m.r, m.c, AI_PLAYER);
    if (ev.openFour >= 1) return m;
  }

  // 邻域候选
  const nearby = getMovesNearPieces(allMoves, 2);

  // 4. 主动利用「已知/推理雷」
  const bestExplosion = findBestExplosionMove(nearby);
  const bestSafe = findBestSafeMove(nearby);

  if (bestExplosion && bestSafe) {
    if (bestExplosion.gain > bestSafe.gain * 1.05) {
      return { r: bestExplosion.r, c: bestExplosion.c };
    }
  } else if (bestExplosion && !bestSafe) {
    return { r: bestExplosion.r, c: bestExplosion.c };
  }

  // 5. 阻挡对方活四
  for (const m of allMoves) {
    const cell = board[m.r][m.c];
    if (cell.isMine && cell.revealed) continue;
    const ev = evaluateGomokuMove(m.r, m.c, HUMAN_PLAYER);
    if (ev.openFour >= 1) return m;
  }

  // 6. 3 层搜索（只对邻域）
  const move = searchBestMove(3, nearby);
  return move || chooseHardMove(allMoves);
}

/* ===================== AI 入口 ===================== */
function isAiMode() { return gameMode === 'pve'; }

function maybeAiTurn() {
  if (gameOver || !isAiMode() || currentPlayer !== AI_PLAYER) return;

  isAiThinking = true;
  updateStatus();

  const base = difficulty === 'hell' ? 800 : 500;
  const delay = base + Math.random() * 400;

  setTimeout(() => {
    isAiThinking = false;
    if (gameOver || !isAiMode() || currentPlayer !== AI_PLAYER) {
      updateStatus();
      return;
    }
    const move = aiChooseCell();
    if (move) handleCellClick(move.r, move.c, true);
    else updateStatus();
  }, delay);
}

function aiChooseCell() {
  const allMoves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c].player) {
        allMoves.push({ r, c, isMine: board[r][c].isMine });
      }
    }
  }
  if (allMoves.length === 0) return null;

  if (difficulty === 'easy') return chooseEasyMove(allMoves);
  if (difficulty === 'medium') return chooseMediumMove(allMoves);
  if (difficulty === 'hard') return chooseHardMove(allMoves);
  return chooseHellMove(allMoves);
}

/* ===================== 重置 / 模式 ===================== */
function resetGame() {
  gameOver = false;
  isAiThinking = false;
  currentPlayer = 1;
  exploredCount = 0;
  lastMove = null;
  winLine = [];
  hideResult();

  createBoard();
  placeMines();
  calculateNumbers();
  renderBoard();
  updateStatus();
}

function updateModeUI() {
  modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === gameMode));
  diffSeg.style.display = isAiMode() ? 'flex' : 'none';
  diffBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.diff === difficulty));
}

modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (gameMode === btn.dataset.mode) return;
    gameMode = btn.dataset.mode;
    updateModeUI();
    resetGame();
  });
});

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const newDiff = btn.dataset.diff;
    if (newDiff === difficulty) return;

    if (newDiff === 'hell') {
      const ok = confirm(
        '【超级地狱】\n\n' +
        'AI 会进行完整的雷区推理与多层博弈搜索，\n' +
        '普通人几乎无法取胜。\n\n' +
        '你确定要挑战吗？'
      );
      if (!ok) return;
    }

    difficulty = newDiff;
    updateModeUI();
    resetGame();
  });
});

restartBtn.addEventListener('click', resetGame);
resultRestart.addEventListener('click', resetGame);

/* ===================== 玩法说明 ===================== */
if (sessionStorage.getItem('introSeen') === '1') {
  introOverlay.classList.add('hidden');
}
introClose.addEventListener('click', () => {
  introOverlay.classList.add('hidden');
  sessionStorage.setItem('introSeen', '1');
});
helpBtn.addEventListener('click', () => {
  introOverlay.classList.remove('hidden');
});

/* ===================== 启动 ===================== */
mineCountEl.textContent = MINE_COUNT;
updateModeUI();
resetGame();