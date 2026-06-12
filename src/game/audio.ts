// Tiny WebAudio synth for sfx + bgm. No external assets.
let ctx: AudioContext | null = null;
let bgmOn = true; let sfxOn = true;
let bgmOsc: OscillatorNode | null = null;
let bgmGain: GainNode | null = null;
let bgmInterval: number | null = null;

function getCtx() {
  if (!ctx && typeof window !== "undefined") {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function setAudioFlags(b: boolean, s: boolean) {
  bgmOn = b; sfxOn = s;
  if (!bgmOn) stopBgm();
}

export function sfx(kind: "click"|"hit"|"crit"|"levelup"|"loot"|"boss"|"heal") {
  if (!sfxOn) return;
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  const now = c.currentTime;
  const map = {
    click:   { f: 800, t: 0.08, type: "square", v: 0.05 },
    hit:     { f: 220, t: 0.12, type: "sawtooth", v: 0.08 },
    crit:    { f: 660, t: 0.18, type: "square", v: 0.1 },
    levelup: { f: 880, t: 0.4,  type: "triangle", v: 0.12 },
    loot:    { f: 1320,t: 0.18, type: "sine", v: 0.08 },
    boss:    { f: 110, t: 0.5,  type: "sawtooth", v: 0.12 },
    heal:    { f: 520, t: 0.25, type: "sine", v: 0.08 },
  }[kind];
  o.type = map.type as OscillatorType;
  o.frequency.setValueAtTime(map.f, now);
  if (kind === "levelup") o.frequency.exponentialRampToValueAtTime(map.f*2, now+map.t);
  if (kind === "boss") o.frequency.exponentialRampToValueAtTime(40, now+map.t);
  g.gain.setValueAtTime(map.v, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + map.t);
  o.start(now); o.stop(now + map.t + 0.02);
}

export function startBgm() {
  if (!bgmOn) return;
  const c = getCtx(); if (!c) return;
  stopBgm();
  bgmGain = c.createGain(); bgmGain.gain.value = 0.03; bgmGain.connect(c.destination);
  const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
  let i = 0;
  const play = () => {
    if (!c || !bgmGain) return;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = notes[i % notes.length];
    o.connect(bgmGain);
    o.start();
    o.stop(c.currentTime + 0.5);
    i++;
  };
  play();
  bgmInterval = window.setInterval(play, 600);
}

export function stopBgm() {
  if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
  if (bgmGain) { try { bgmGain.disconnect(); } catch {} bgmGain = null; }
  if (bgmOsc) { try { bgmOsc.stop(); } catch {} bgmOsc = null; }
}
