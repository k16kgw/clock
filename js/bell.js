// Synthesized desk-bell ("チーン") using the Web Audio API.
// Strikes are scheduled on the audio clock, which keeps running on time even
// when the tab is in the background on desktop browsers (unlike setTimeout).

const BASE_FREQ = 1320; // Hz, bright desk-bell pitch
// [frequency ratio, relative amplitude, decay seconds]
const PARTIALS = [
  [1.0, 1.0, 2.4],
  [1.004, 0.5, 2.2], // slight detune -> natural beating
  [2.76, 0.42, 1.3],
  [5.4, 0.2, 0.6],
  [8.93, 0.1, 0.3],
];
const STRIKE_GAP = 0.45; // seconds between strikes when ringing 2 or 3 times
const PEAK_GAIN = 0.25;

/** One strike: a few decaying sine partials. Returns the created nodes. */
function strike(ctx, destination, when) {
  const nodes = [];
  for (const [ratio, amp, decay] of PARTIALS) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = BASE_FREQ * ratio;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN * amp, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + decay + 0.05);
    osc.onended = () => { try { gain.disconnect(); } catch { /* ignore */ } };
    nodes.push({ osc, gain });
  }
  return nodes;
}

export class BellPlayer {
  constructor(volume = 0.8) {
    this.ctx = null;
    this.master = null;
    this.volume = volume;
    this.groups = []; // scheduled bells: { start, nodes }
    this.onStateChange = null; // called with the AudioContext state
  }

  /** Create or resume the AudioContext. Call from a user gesture when possible. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // iPhone: play even when the ring/silent switch is on silent (Safari 17+).
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* ignore */ }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.ctx.onstatechange = () => {
        if (this.onStateChange) this.onStateChange(this.ctx.state);
      };
    }
    if (this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  get state() { return this.ctx ? this.ctx.state : "none"; }

  setVolume(volume) {
    this.volume = volume;
    if (this.master) this.master.gain.setValueAtTime(volume, this.ctx.currentTime);
  }

  /** Ring `count` strikes, starting `delay` seconds from now. */
  ring(count, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return null;
    const start = ctx.currentTime + Math.max(0.02, delay);
    const nodes = [];
    for (let i = 0; i < count; i += 1) {
      nodes.push(...strike(ctx, this.master, start + i * STRIKE_GAP));
    }
    return { start, nodes };
  }

  /** Like ring(), but the bell can be cancelled with cancelScheduled(). */
  schedule(count, delay, tag) {
    const group = this.ring(count, delay);
    if (group) this.groups.push({ ...group, tag });
  }

  /**
   * Cancel bells that have not started yet. A bell whose first strike has
   * already sounded is left to finish all its strikes.
   * @returns {Array} tags of the bells that had already started
   */
  cancelScheduled() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    const started = [];
    for (const group of this.groups) {
      if (group.start <= now) {
        started.push(group.tag);
        continue;
      }
      for (const { osc, gain } of group.nodes) {
        try { osc.stop(0); gain.disconnect(); } catch { /* already stopped */ }
      }
    }
    this.groups = [];
    return started;
  }
}
