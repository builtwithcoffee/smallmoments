import { DIFFICULTIES } from './game.js';

export const BEST_SCORE_KEY = 'memory-game.best-score';
export const DIFFICULTY_KEY = 'memory-game.difficulty';

export function bestScoreKey(difficulty) {
  return difficulty === 'hard' ? `${BEST_SCORE_KEY}.hard` : BEST_SCORE_KEY;
}

export function loadDifficulty() {
  try {
    return localStorage.getItem(DIFFICULTY_KEY) === 'hard' ? 'hard' : 'easy';
  } catch {
    return 'easy';
  }
}

export function saveDifficulty(difficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
  } catch {
    // The app keeps the selected difficulty for this page session.
  }
}

function isValidScore(score, pairCount) {
  return score !== null && typeof score === 'object' && !Array.isArray(score)
    && Number.isSafeInteger(score.moves) && score.moves >= pairCount
    && Number.isSafeInteger(score.elapsedMs) && score.elapsedMs >= 0;
}

export function loadBestScore(difficulty = 'easy') {
  try {
    const score = JSON.parse(localStorage.getItem(bestScoreKey(difficulty)));
    return isValidScore(score, DIFFICULTIES[difficulty].pairs)
      ? { moves: score.moves, elapsedMs: score.elapsedMs } : null;
  } catch {
    return null;
  }
}

export function isBetterScore(score, best) {
  return best === null || score.moves < best.moves
    || (score.moves === best.moves && score.elapsedMs < best.elapsedMs);
}

export function saveBestScore(score, difficulty = 'easy') {
  try {
    localStorage.setItem(bestScoreKey(difficulty), JSON.stringify(score));
  } catch {
    // Keep the record in memory when browser storage is unavailable or full.
  }
}
