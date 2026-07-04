/*
 * Shared audio for all games. Everything is synthesized with WebAudio,
 * so there are no sound files to download or license.
 * Preferences persist in localStorage. Browsers only allow audio after
 * the first tap/click, so we unlock on the first pointer event.
 */

const CasinoAudio = (function () {
  let ctx = null;
  let unlocked = false;
  let soundOn = localStorage.getItem("gs_sound") !== "0";
  let musicOn = localStorage.getItem("gs_music") !== "0";
  let musicTimer = null;
  let musicGain = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (!ensureCtx()) return;
    if (musicOn) startMusic();
  }
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });

  /* --------------------------- tiny synth --------------------------- */

  function tone(freq, dur, type, vol, delay, endFreq) {
    if (!soundOn || !unlocked || !ensureCtx()) return;
    const t = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /* --------------------------- effects ------------------------------ */

  const fx = {
    click() { tone(700, 0.06, "square", 0.05); },
    spin() { tone(220, 0.25, "sawtooth", 0.05, 0, 440); },
    reelStop() { tone(170, 0.09, "sine", 0.12); tone(340, 0.05, "triangle", 0.05); },
    lose() { tone(200, 0.15, "sine", 0.04, 0, 150); },
    win(mult) {
      // small win: quick arpeggio; big win: longer fanfare
      const base = [523, 659, 784, 1047]; // C E G C
      base.forEach((f, i) => tone(f, 0.16, "triangle", 0.09, i * 0.09));
      if (mult >= 10) {
        [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, 0.45 + i * 0.11));
        [392, 494].forEach((f, i) => tone(f, 0.5, "sine", 0.07, 0.45 + i * 0.11));
      }
    },
    fanfare() {
      // free spins / feature trigger
      const seq = [523, 659, 784, 1047, 784, 1047, 1319];
      seq.forEach((f, i) => tone(f, 0.2, "triangle", 0.11, i * 0.12));
      tone(262, 1.0, "sine", 0.06, 0);
    },
  };

  /* ---------------------- background music loop --------------------- */
  // A quiet, endless lounge-style arpeggio. Placeholder-quality on
  // purpose — swap in a real licensed track later if wanted.

  const CHORDS = [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [130.81, 196.0, 261.63], // C
    [196.0, 246.94, 293.66], // G
  ];
  let chordIdx = 0;

  function scheduleBar() {
    if (!musicOn || !ctx) return;
    const t0 = ctx.currentTime + 0.05;
    const beat = 0.32; // ~94 bpm eighth notes
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;

    // soft bass note
    musicNote(chord[0] / 2, t0, beat * 8, "sine", 0.045);
    // arpeggio pattern
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    pattern.forEach((n, i) => {
      musicNote(chord[n] * 2, t0 + i * beat, beat * 0.9, "triangle", 0.028);
    });

    musicTimer = setTimeout(scheduleBar, beat * 8 * 1000 - 30);
  }

  function musicNote(freq, t, dur, type, vol) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  function startMusic() {
    if (!unlocked || !ensureCtx() || musicTimer) return;
    if (!musicGain) {
      musicGain = ctx.createGain();
      musicGain.gain.value = 1;
      musicGain.connect(ctx.destination);
    }
    scheduleBar();
  }

  function stopMusic() {
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }

  /* ---------------------------- controls ---------------------------- */

  function setSound(on) {
    soundOn = on;
    localStorage.setItem("gs_sound", on ? "1" : "0");
  }
  function setMusic(on) {
    musicOn = on;
    localStorage.setItem("gs_music", on ? "1" : "0");
    if (on) startMusic(); else stopMusic();
  }

  // wires the SOUND / MUSIC toggle buttons present on every game page
  function bindControls(soundBtn, musicBtn) {
    const sb = document.getElementById(soundBtn);
    const mb = document.getElementById(musicBtn);
    if (sb) {
      sb.classList.toggle("on", soundOn);
      sb.addEventListener("click", () => {
        setSound(!soundOn);
        sb.classList.toggle("on", soundOn);
        fx.click();
      });
    }
    if (mb) {
      mb.classList.toggle("on", musicOn);
      mb.addEventListener("click", () => {
        setMusic(!musicOn);
        mb.classList.toggle("on", musicOn);
      });
    }
  }

  return {
    click: fx.click, spin: fx.spin, reelStop: fx.reelStop,
    lose: fx.lose, win: fx.win, fanfare: fx.fanfare,
    bindControls,
  };
})();
