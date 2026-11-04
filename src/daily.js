import { DIFFICULTIES, createGame } from './game.js';
import { BEST_SCORE_KEY, bestScoreKey } from './best-score.js';

export const EPOCH_DATE = '2026-11-01';
export const STATS_KEY = 'memory-game.daily-stats';
export const TODAY_KEY = 'memory-game.daily-today';
export const HISTORY_KEY = 'memory-game.daily-history';
export const DATA_VERSION_KEY = 'memory-game.data-version';
export const DATA_VERSION = '2026-11-04-fresh';

export function resetGameData(storage, version = DATA_VERSION) {
  try {
    storage ??= globalThis.localStorage;
    if (storage.getItem(DATA_VERSION_KEY) === version) return false;
    for (const key of [STATS_KEY, TODAY_KEY, HISTORY_KEY, BEST_SCORE_KEY, bestScoreKey('hard')]) {
      storage.removeItem(key);
    }
    // Mark success only after every game key was removed, so a failed reset retries.
    storage.setItem(DATA_VERSION_KEY, version);
    return true;
  } catch {
    return false;
  }
}

export function utcDate(now = new Date()) {
  return `${String(now.getUTCFullYear()).padStart(4, '0')}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export const EASTERN_ZONE = 'America/New_York';
export const TIMEZONE_KEY = 'memory-game.timezone';
const dateFormatters = new Map();

function dateFormatter(zone) {
  if (typeof zone !== 'string') zone = EASTERN_ZONE;
  if (dateFormatters.has(zone)) return dateFormatters.get(zone);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    dateFormatters.set(zone, formatter);
    return formatter;
  } catch {
    return dateFormatter(EASTERN_ZONE);
  }
}

export function zoneDate(now = new Date(), zone = EASTERN_ZONE) {
  const parts = Object.fromEntries(dateFormatter(zone).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
}

export function resolveZone(choice) {
  if (choice === 'local') {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof zone === 'string' && zone) {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return zone;
      }
    } catch { /* Detection is optional; Eastern is always the default. */ }
  }
  return EASTERN_ZONE;
}

export function loadZoneChoice(storage) {
  try { return (storage ?? globalThis.localStorage).getItem(TIMEZONE_KEY) === 'eastern' ? 'eastern' : 'local'; }
  catch { return 'local'; }
}

export function saveZoneChoice(choice, storage) {
  const value = choice === 'local' ? 'local' : 'eastern';
  try { (storage ?? globalThis.localStorage).setItem(TIMEZONE_KEY, value); }
  catch { /* The app retains its selected choice for this page visit. */ }
  return value;
}

export function seedFor(date, difficulty) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(`${date}:${difficulty}`)) {
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  }
  return hash;
}

export function createSeededRandom(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function puzzleNumber(date) {
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${EPOCH_DATE}T00:00:00Z`)) / 86400000 + 1;
}

export function previousDate(date) {
  return utcDate(new Date(Date.parse(`${date}T00:00:00Z`) - 86400000));
}

const session = new Map();
const failed = new Set();

function read(key) {
  if (failed.has(key)) return session.get(key);
  let raw;
  try { raw = localStorage.getItem(key); }
  catch { return session.get(key); }
  let record;
  try { record = JSON.parse(raw); }
  catch { record = null; }
  session.set(key, record);
  return record;
}

function write(key, record) {
  session.set(key, record);
  try { localStorage.setItem(key, JSON.stringify(record)); }
  catch { failed.add(key); }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && utcDate(new Date(`${date}T00:00:00Z`)) === date;
}

function validScore(score, difficulty) {
  return object(score) && Object.hasOwn(DIFFICULTIES, difficulty)
    && Number.isSafeInteger(score.moves) && score.moves >= DIFFICULTIES[difficulty].pairs
    && Number.isSafeInteger(score.elapsedMs) && score.elapsedMs >= 0;
}

function validResult(entry, difficulty) {
  return validScore(entry, difficulty) && typeof entry.strip === 'string'
    && /^[mx]+$/.test(entry.strip) && entry.strip.length === entry.moves
    && [...entry.strip].filter(move => move === 'm').length === DIFFICULTIES[difficulty].pairs;
}

function validProgress(entry, difficulty, date) {
  if (!object(entry) || !Object.hasOwn(DIFFICULTIES, difficulty) || !validDate(date)
    || !Number.isSafeInteger(entry.moves) || entry.moves < 0
    || !Number.isSafeInteger(entry.elapsedMs) || entry.elapsedMs < 0
    || typeof entry.strip !== 'string' || !/^[mx]*$/.test(entry.strip) || entry.strip.length !== entry.moves
    || !Array.isArray(entry.matched) || entry.matched.length % 2 !== 0
    || entry.matched.length >= DIFFICULTIES[difficulty].pairs * 2
    || !Array.isArray(entry.selected) || entry.selected.length > 1
    || [...entry.strip].filter(move => move === 'm').length !== entry.matched.length / 2) return false;
  const game = createGame(createSeededRandom(seedFor(date, difficulty)), DIFFICULTIES[difficulty].pairs);
  const inRange = index => Number.isSafeInteger(index) && index >= 0 && index < game.tiles.length;
  if (!Array.from(entry.matched).every((index, i) => inRange(index) && (i === 0 || index > entry.matched[i - 1]))
    || !Array.from(entry.selected).every(index => inRange(index) && !entry.matched.includes(index))) return false;
  const counts = new Map();
  for (const index of entry.matched) {
    const pair = game.tiles[index].pair;
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return [...counts.values()].every(count => count === 2);
}

function emptyStats() {
  return { played: 0, streak: 0, longest: 0, lastDate: null, best: null };
}

export function loadDailyStats(difficulty) {
  const record = read(STATS_KEY);
  const stats = object(record) ? record[difficulty] : null;
  if (!object(stats) || !['played', 'streak', 'longest'].every(key => Number.isSafeInteger(stats[key]) && stats[key] >= 0)
    || stats.streak > stats.longest || stats.longest > stats.played
    || (stats.played === 0 ? stats.lastDate !== null || stats.best !== null || stats.longest !== 0
      : !validDate(stats.lastDate) || stats.streak < 1 || !validScore(stats.best, difficulty))) return emptyStats();
  return { played: stats.played, streak: stats.streak, longest: stats.longest, lastDate: stats.lastDate,
    best: stats.best === null ? null : { moves: stats.best.moves, elapsedMs: stats.best.elapsedMs } };
}

export function currentStreak(stats, today) {
  return stats.lastDate === today || stats.lastDate === previousDate(today) ? stats.streak : 0;
}

function todayRecord(date) {
  let record = read(TODAY_KEY);
  const today = { date };
  if (!object(record) || record.date !== date) {
    const history = read(HISTORY_KEY);
    record = object(history) && Object.hasOwn(history, date) ? history[date] : null;
  }
  if (!object(record) || record.date !== date) return today;
  for (const difficulty of ['easy', 'hard']) {
    const entry = record[difficulty];
    if (!object(entry)) continue;
    if (['playing', 'forfeited'].includes(entry.status) && validProgress(entry, difficulty, date)) {
      const { moves, strip, elapsedMs, matched, selected } = entry;
      today[difficulty] = { status: entry.status, moves, strip, elapsedMs, matched: [...matched], selected: [...selected] };
    }
    if (entry.status === 'done' && validResult(entry, difficulty)) {
      const { moves, elapsedMs, strip } = entry;
      today[difficulty] = { status: 'done', moves, elapsedMs, strip };
    }
  }
  return today;
}

function writeDailyRecord(record) {
  const previous = read(TODAY_KEY);
  if (object(previous) && validDate(previous.date) && previous.date !== record.date) {
    const history = read(HISTORY_KEY);
    write(HISTORY_KEY, { ...(object(history) ? history : {}), [previous.date]: todayRecord(previous.date) });
  }
  write(TODAY_KEY, record);
}

// Only an explicit time-zone change forfeits a playing official attempt.
// Keep its snapshot for history; later play on this slot is unscored practice.
export function forfeitDailyEntry(difficulty, date) {
  const record = todayRecord(date);
  if (record[difficulty]?.status !== 'playing') return;
  record[difficulty].status = 'forfeited';
  writeDailyRecord(record);
}

export function loadDailyEntry(difficulty, date) {
  return todayRecord(date)[difficulty] ?? null;
}

export function saveDailyProgress({ difficulty, date, moves, elapsedMs, strip, matched, selected }) {
  const progress = { moves, strip, elapsedMs, matched, selected };
  if (!validDate(date) || !validProgress(progress, difficulty, date)) return;
  const record = todayRecord(date);
  if (['done', 'forfeited'].includes(record[difficulty]?.status)) return;
  record[difficulty] = { status: 'playing', ...progress, matched: [...matched], selected: [...selected] };
  writeDailyRecord(record);
}

export function saveDailyResult({ difficulty, date, moves, elapsedMs, strip }) {
  const result = { moves, elapsedMs, strip };
  if (!validDate(date) || !validResult(result, difficulty)) return;
  const record = todayRecord(date);
  if (['done', 'forfeited'].includes(record[difficulty]?.status)) return;
  record[difficulty] = { status: 'done', ...result };
  writeDailyRecord(record);
  const stats = loadDailyStats(difficulty);
  if (stats.lastDate !== null && date <= stats.lastDate) return;
  const streak = stats.lastDate === previousDate(date) ? stats.streak + 1 : 1;
  const best = stats.best === null || moves < stats.best.moves
    || (moves === stats.best.moves && elapsedMs < stats.best.elapsedMs) ? { moves, elapsedMs } : stats.best;
  const allStats = { easy: loadDailyStats('easy'), hard: loadDailyStats('hard') };
  allStats[difficulty] = { played: stats.played + 1, streak, longest: Math.max(stats.longest, streak), lastDate: date, best };
  write(STATS_KEY, allStats);
}

export function formatResult({ date, difficulty, moves, elapsedMs, strip }) {
  const seconds = Math.floor(elapsedMs / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const rows = strip.match(/.{1,10}/g) ?? [];
  return `Memory · ${formatDay(date)} · ${difficulty === 'hard' ? 'Hard' : 'Easy'}\n${moves} moves · ${time}\n${rows.map(row => [...row].map(move => move === 'm' ? '✅' : '❌').join('')).join('\n')}`;
}

export function formatDay(date) {
  const day = new Date(`${date}T00:00:00Z`);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[day.getUTCMonth()]} ${day.getUTCDate()}`;
}

export function dailyLabel(date) {
  return `Daily #${puzzleNumber(date)} · ${formatDay(date)}`;
}

export function msUntilNextPuzzle(now = new Date(), zone = EASTERN_ZONE) {
  const today = zoneDate(now, zone);
  const start = now.getTime();
  // Bracket the next calendar date before searching for its first instant.
  // Civil days can exceed 25 hours, including Troll's 26-hour autumn day.
  let low = start;
  let high = start + 24 * 3600000;
  while (zoneDate(new Date(high), zone) === today) high += 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (zoneDate(new Date(middle), zone) === today) low = middle;
    else high = middle;
  }
  return high - start;
}

export function formatCountdown(ms) {
  return `${Math.floor(ms / 3600000)}h ${Math.floor(ms / 60000) % 60}m`;
}
