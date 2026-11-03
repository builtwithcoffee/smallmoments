export const SOUND_KEY = 'memory-game.sound';

export function loadSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    // The player retains the preference for this page session.
  }
}

export function soundsFor(result) {
  switch (result) {
    case 'first':
    case 'mismatch': return ['flip'];
    case 'match': return ['flip', 'match'];
    case 'won': return ['flip', 'win'];
    default: return [];
  }
}

// Sine notes with short attacks and gentle fades, in seconds.
const melodies = {
  flip: { frequencies: [660], spacing: 0, duration: 0.07, gain: 0.04 },
  match: { frequencies: [523.25, 659.25], spacing: 0.12, duration: 0.16, gain: 0.06 },
  win: { frequencies: [523.25, 659.25, 783.99, 1046.5], spacing: 0.16, duration: 0.22, gain: 0.06 },
};

export function createSoundPlayer({ AudioContextClass, enabled = true } = {}) {
  let context;
  let generation = 0;
  const active = new Set();

  function release(voice) {
    active.delete(voice);
    // Cleanup must remain safe even after a partially failed audio setup.
    try { voice.oscillator?.disconnect(); } catch {}
    try { voice.gain?.disconnect(); } catch {}
  }

  function stop(voice) {
    try { voice.oscillator?.stop(); } catch {}
    release(voice);
  }

  function note(frequency, start, duration, peak) {
    const voice = {};
    try {
      voice.oscillator = context.createOscillator();
      voice.gain = context.createGain();
      voice.oscillator.type = 'sine';
      voice.oscillator.frequency.setValueAtTime(frequency, start);
      voice.gain.gain.setValueAtTime(0, start);
      voice.gain.gain.linearRampToValueAtTime(peak, start + 0.01);
      voice.gain.gain.linearRampToValueAtTime(0, start + duration);
      voice.oscillator.connect(voice.gain);
      voice.gain.connect(context.destination);
      voice.oscillator.onended = () => release(voice);
      active.add(voice);
      voice.oscillator.start(start);
      voice.oscillator.stop(start + duration);
    } catch (error) {
      stop(voice);
      throw error;
    }
  }

  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) {
        generation++;
        for (const voice of active) stop(voice);
      }
    },
    async play(name) {
      try {
        if (!enabled || !Object.hasOwn(melodies, name)) return;
        if (!context) {
          const Context = AudioContextClass === undefined
            ? globalThis.AudioContext ?? globalThis.webkitAudioContext : AudioContextClass;
          if (!Context) return;
          context = new Context();
        }
        const requestedGeneration = generation;
        if (context.state === 'suspended') await context.resume();
        // A mute while resume is pending cancels this sound, even if re-enabled.
        if (!enabled || requestedGeneration !== generation) return;
        const { frequencies, spacing, duration, gain } = melodies[name];
        const start = context.currentTime;
        frequencies.forEach((frequency, index) => note(frequency, start + index * spacing, duration, gain));
      } catch {
        // Unsupported or blocked audio must never interrupt play or reject.
      }
    },
  };
}
