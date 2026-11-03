export function createClock(now = () => performance.now()) {
  let started = false;
  let running = false;
  let startedAt;
  let accumulated = 0;

  return {
    start() {
      if (started) return;
      started = running = true;
      startedAt = now();
    },
    pause() {
      if (!running) return;
      accumulated += now() - startedAt;
      running = false;
    },
    resume() {
      if (!started || running) return;
      startedAt = now();
      running = true;
    },
    restore(elapsedMs) {
      started = true;
      running = false;
      accumulated = elapsedMs;
    },
    reset() {
      started = running = false;
      accumulated = 0;
    },
    elapsed() {
      return Math.floor(accumulated + (running ? now() - startedAt : 0));
    },
    get running() { return running; },
    get paused() { return started && !running; },
  };
}
