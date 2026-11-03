import { iconNames, tileIcon } from './icons.js';
import { DIFFICULTIES, createGame, restoreGame, selectTile, hideMismatch, canPause, pauseGame, resumeGame } from './game.js';
import { createClock } from './clock.js';
import { utcDate, seedFor, createSeededRandom, dailyLabel, msUntilNextPuzzle, formatCountdown, loadDailyEntry, saveDailyProgress, saveDailyResult, loadDailyStats, currentStreak, formatResult } from './daily.js';
import { loadBestScore, isBetterScore, saveBestScore, loadDifficulty, saveDifficulty } from './best-score.js';
import { createSoundPlayer, loadSoundEnabled, saveSoundEnabled, soundsFor } from './sound.js';

// Keep the images alive and request every fruit once, before the first flip.
const fruitImages = iconNames.map(name => {
  const image = new Image();
  image.src = `src/icons/noto/${name.toLowerCase()}.svg`;
  return image;
});

const board = document.querySelector('#board');
const status = document.querySelector('#status');
const moves = document.querySelector('#moves');
const pairs = document.querySelector('#pairs');
const time = document.querySelector('#time');
const bestMoves = document.querySelector('#best-moves');
const bestTime = document.querySelector('#best-time');
const pairTotal = document.querySelector('#pair-total');
const pairSummary = document.querySelector('#pair-summary');
const bestDifficulty = document.querySelector('#best-difficulty');
const bestScoreLine = document.querySelector('.best-score');
const dailyInfo = document.querySelector('#daily-info');
const nextPuzzle = document.querySelector('#next-puzzle');
const restartButton = document.querySelector('#restart');
const gameControls = document.querySelector('.game-controls');
const resultCard = document.querySelector('#result-card');
const dailyStats = document.querySelector('#daily-stats');
const resultText = document.querySelector('#result-text');
const copyResult = document.querySelector('#copy-result');
const copyStatus = document.querySelector('#copy-status');
const soundToggle = document.querySelector('#sound-toggle');
const pauseToggle = document.querySelector('#pause-toggle');
const soundPlayer = createSoundPlayer({ enabled: loadSoundEnabled() });
const difficultyButtons = {
  easy: document.querySelector('#difficulty-easy'),
  hard: document.querySelector('#difficulty-hard'),
};
const modeButtons = {
  random: document.querySelector('#mode-random'),
  daily: document.querySelector('#mode-daily'),
};
let difficulty = loadDifficulty();
let mode = 'daily';
const bestScores = {};
let gameDate;
let slot;
let strip;
let game;
const clock = createClock();
let timer;
let countdownTimer;
let pendingFlip;
let flipDeadline;
let flipRemaining;
let resumeStatus;
let resultVersion = 0;

function formatTime(elapsedMs) {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateTime() {
  time.textContent = formatTime(clock.elapsed());
}

function render() {
  pauseToggle.disabled = !game.paused && !canPause(game);
  pauseToggle.textContent = game.paused ? 'Resume' : 'Pause';
  pauseToggle.setAttribute('aria-pressed', String(game.paused));
  board.setAttribute('data-paused', String(game.paused));
  moves.textContent = game.moves;
  pairs.textContent = game.pairs;
  const bestScore = bestScores[difficulty] ?? null;
  bestMoves.textContent = bestScore === null ? '—' : bestScore.moves;
  bestTime.textContent = bestScore === null ? '—' : formatTime(bestScore.elapsedMs);
  [...board.children].forEach((button, index) => {
    const tile = game.tiles[index];
    const revealed = !game.paused && (tile.matched || game.selected.includes(index));
    button.classList.toggle('revealed', revealed);
    button.classList.toggle('matched', !game.paused && tile.matched);
    button.innerHTML = tileIcon(revealed ? tile.name : 'face-down');
    button.setAttribute('aria-label', `Tile ${index + 1}: ${revealed ? tile.name : 'face down'}${!game.paused && tile.matched ? ', matched' : ''}`);
    button.setAttribute('aria-disabled', String(game.paused || tile.matched || game.locked || revealed));
  });
}

function scheduleFlip() {
  flipDeadline = performance.now() + flipRemaining;
  pendingFlip = setTimeout(() => {
    pendingFlip = undefined;
    hideMismatch(game);
    render();
    status.textContent = 'Pick another pair.';
  }, flipRemaining);
}

function choose(index) {
  const result = selectTile(game, index);
  for (const sound of soundsFor(result)) soundPlayer.play(sound);
  if (result === 'ignored') return;
  if (result === 'match' || result === 'won') strip += 'm';
  if (result === 'mismatch') strip += 'x';
  if (!clock.running) {
    clock.start();
    timer = setInterval(updateTime, 250);
  }
  if (result === 'first') status.textContent = 'Now find its partner.';
  if (result === 'match') status.textContent = 'A lovely little match. Keep going!';
  if (result === 'mismatch') {
    status.textContent = 'Not a pair. Remember these for next time.';
    flipRemaining = 1000;
    scheduleFlip();
  }
  if (result === 'won') {
    clearInterval(timer);
    const score = { moves: game.moves, elapsedMs: clock.elapsed() };
    time.textContent = formatTime(score.elapsedMs);
    if (mode === 'daily') {
      saveDailyResult({ date: gameDate, difficulty, ...score, strip });
      slot = 'done';
      clock.restore(score.elapsedMs);
      renderDaily();
      countdownTimer = setInterval(updateCountdown, 60000);
    } else if (isBetterScore(score, bestScores[difficulty])) {
      bestScores[difficulty] = score;
      saveBestScore(score, difficulty);
    }
    status.textContent = `All ${difficulty === 'easy' ? 'eight' : 'eighteen'} pairs! ${game.moves} moves in ${time.textContent}. A moment well spent.`;
  }
  saveProgress();
  render();
}

function saveProgress() {
  if (mode !== 'daily' || slot === 'done' || !game || (slot === 'new' && game.selected.length === 0)) return;
  slot = 'playing';
  saveDailyProgress({ difficulty, date: gameDate, moves: game.moves, elapsedMs: clock.elapsed(), strip,
    matched: game.tiles.flatMap((tile, index) => tile.matched ? [index] : []),
    selected: game.locked ? [] : [...game.selected] });
}

function updateCountdown() {
  nextPuzzle.textContent = utcDate() > gameDate ? 'A new puzzle is ready. Reload to play it.'
    : `Next puzzle in ${formatCountdown(msUntilNextPuzzle())}`;
}

function renderDaily() {
  resultVersion++;
  copyStatus.textContent = '';
  const daily = mode === 'daily';
  dailyInfo.hidden = dailyStats.hidden = !daily;
  restartButton.hidden = daily;
  gameControls.setAttribute('data-mode', mode);
  bestScoreLine.hidden = daily;
  const entry = daily ? loadDailyEntry(difficulty, gameDate) : null;
  resultCard.hidden = !daily || slot !== 'done';
  resultText.textContent = entry?.status === 'done' ? formatResult({ date: gameDate, difficulty, ...entry }) : '';
  copyResult.hidden = resultCard.hidden;
  nextPuzzle.hidden = !daily || slot !== 'done';
  if (!nextPuzzle.hidden) updateCountdown();
  const stats = loadDailyStats(difficulty);
  dailyStats.textContent = `Streak ${currentStreak(stats, utcDate())} · Longest ${stats.longest} · Played ${stats.played} · Best ${stats.best === null ? '—' : `${stats.best.moves} moves · ${formatTime(stats.best.elapsedMs)}`}`;
}

function restart() {
  clearTimeout(pendingFlip);
  clearInterval(timer);
  clearInterval(countdownTimer);
  pendingFlip = undefined;
  flipRemaining = 0;
  clock.reset();
  const { pairs: pairCount, columns } = DIFFICULTIES[difficulty];
  gameDate = utcDate();
  const entry = mode === 'daily' ? loadDailyEntry(difficulty, gameDate) : null;
  slot = entry?.status ?? 'new';
  strip = entry?.strip ?? '';
  if (mode !== 'daily' && !Object.hasOwn(bestScores, difficulty)) bestScores[difficulty] = loadBestScore(difficulty);
  game = createGame(mode === 'daily' ? createSeededRandom(seedFor(gameDate, difficulty)) : Math.random, pairCount);
  if (entry) {
    restoreGame(game, entry.status === 'done' ? {
      matched: game.tiles.map((_, index) => index), selected: [], moves: entry.moves,
    } : entry);
    clock.restore(entry.elapsedMs);
    game.paused = entry.status === 'playing';
  }
  resumeStatus = game.selected.length ? 'Now find its partner.' : 'Pick another pair.';
  modeButtons.daily.textContent = dailyLabel(gameDate);
  renderDaily();
  if (mode === 'daily' && slot === 'done') countdownTimer = setInterval(updateCountdown, 60000);
  for (const [value, button] of Object.entries(modeButtons)) {
    button.setAttribute('aria-pressed', String(value === mode));
  }
  board.setAttribute('data-difficulty', difficulty);
  board.setAttribute('aria-label', `${columns} by ${columns} board, ${game.tiles.length} tiles`);
  pairTotal.textContent = pairCount;
  pairSummary.textContent = `${pairCount} PAIRS. ONE SMALL MOMENT.`;
  bestDifficulty.textContent = difficulty === 'easy' ? 'Easy' : 'Hard';
  for (const [value, button] of Object.entries(difficultyButtons)) {
    button.setAttribute('aria-pressed', String(value === difficulty));
  }
  board.replaceChildren(...game.tiles.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.addEventListener('click', () => choose(index));
    return button;
  }));
  updateTime();
  render();
  status.textContent = game.paused ? 'Paused. Press Resume to continue.'
    : mode === 'daily' && slot === 'done' ? "Today's puzzle is done. Come back tomorrow, or try Free play." : 'Pick any tile to begin.';
}

board.addEventListener('keydown', event => {
  const index = [...board.children].indexOf(document.activeElement);
  const { columns } = DIFFICULTIES[difficulty];
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
  if (index < 0 || delta === undefined) return;
  event.preventDefault();
  board.children[(index + delta + game.tiles.length) % game.tiles.length].focus();
});
for (const [value, button] of Object.entries(difficultyButtons)) {
  button.addEventListener('click', () => {
    if (value === difficulty) return;
    saveProgress();
    difficulty = value;
    saveDifficulty(difficulty);
    restart();
  });
}
restartButton.addEventListener('click', () => {
  if (mode === 'random') restart();
});
globalThis.addEventListener('pagehide', saveProgress);
for (const [value, button] of Object.entries(modeButtons)) {
  button.addEventListener('click', () => {
    if (value === mode) return;
    saveProgress();
    mode = value;
    restart();
  });
}
copyResult.addEventListener('click', async () => {
  if (resultCard.hidden) return;
  const version = resultVersion;
  let message;
  try {
    await navigator.clipboard.writeText(resultText.textContent);
    message = 'Result copied.';
  } catch {
    message = 'Could not copy. Select the text above and copy it.';
  }
  if (version === resultVersion) copyStatus.textContent = message;
});
pauseToggle.addEventListener('click', () => {
  if (game.paused) {
    resumeGame(game);
    clock.resume();
    timer = setInterval(updateTime, 250);
    if (game.locked) scheduleFlip();
    status.textContent = resumeStatus;
  } else {
    if (!pauseGame(game)) return;
    clock.pause();
    clearInterval(timer);
    updateTime();
    if (game.locked) {
      flipRemaining = Math.max(0, flipDeadline - performance.now());
      clearTimeout(pendingFlip);
      pendingFlip = undefined;
    }
    resumeStatus = status.textContent;
    status.textContent = 'Paused. Press Resume to continue.';
    saveProgress();
  }
  render();
});
function renderSoundToggle() {
  soundToggle.textContent = soundPlayer.enabled ? 'Sound on' : 'Sound off';
  soundToggle.setAttribute('aria-pressed', String(soundPlayer.enabled));
}
soundToggle.addEventListener('click', () => {
  soundPlayer.setEnabled(!soundPlayer.enabled);
  saveSoundEnabled(soundPlayer.enabled);
  renderSoundToggle();
});
renderSoundToggle();
restart();
