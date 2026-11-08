// Timekeeper settings: defaults, persistence, parsing and pure timing helpers.

const STORAGE_KEY = "clock.timer.v1";

export const DEFAULT_SETTINGS = Object.freeze({
  bells: [
    { n: 1, on: true, t: 600 }, // 10:00 warning
    { n: 2, on: true, t: 720 }, // 12:00 end of talk
    { n: 3, on: true, t: 900 }, // 15:00 end of Q&A
  ],
  mode: "up", // "up" = elapsed, "down" = remaining
  volume: 0.8,
});

const clone = (s) => JSON.parse(JSON.stringify(s));

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_SETTINGS);
    const s = JSON.parse(raw);
    const ok =
      Array.isArray(s.bells) && s.bells.length === 3 &&
      s.bells.every((b, i) => b.n === i + 1 && typeof b.on === "boolean" && Number.isFinite(b.t) && b.t > 0) &&
      (s.mode === "up" || s.mode === "down") &&
      Number.isFinite(s.volume);
    return ok ? s : clone(DEFAULT_SETTINGS);
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode etc.) - settings just won't persist */
  }
}

// ---------- Run state (survives an accidental reload mid-talk) ----------
const RUN_KEY = "clock.timer.run.v1";
const MAX_RESTORE_SECONDS = 12 * 3600; // ignore stale state from another day

/** @returns {{running: boolean, baseElapsed: number, startedAtEpoch: number} | null} */
export function loadRunState() {
  try {
    const s = JSON.parse(localStorage.getItem(RUN_KEY) || "null");
    if (!s || typeof s.running !== "boolean" || !Number.isFinite(s.baseElapsed) ||
        !Number.isFinite(s.startedAtEpoch)) return null;
    const elapsed = s.running ? s.baseElapsed + (Date.now() - s.startedAtEpoch) / 1000 : s.baseElapsed;
    return elapsed >= 0 && elapsed < MAX_RESTORE_SECONDS ? s : null;
  } catch {
    return null;
  }
}

export function saveRunState(state) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(state));
  } catch { /* storage unavailable - state just won't survive a reload */ }
}

/** "10" -> 600, "10:30" -> 630, "0:45" -> 45. Returns null when invalid. */
export function parseTime(text) {
  // NFKC turns full-width input from a Japanese IME ("１５：００") into ASCII.
  const m = /^\s*(\d{1,3})(?:\s*:\s*(\d{1,2}))?\s*$/.exec(String(text).normalize("NFKC"));
  if (!m) return null;
  const min = Number(m[1]);
  const sec = m[2] === undefined ? 0 : Number(m[2]);
  if (sec >= 60) return null;
  const total = min * 60 + sec;
  return total > 0 ? total : null;
}

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Error message if enabled bells are not in strictly increasing order, else "". */
export function validateBells(bells) {
  const on = bells.filter((b) => b.on);
  for (let i = 1; i < on.length; i += 1) {
    if (on[i].t <= on[i - 1].t) {
      return `${on[i].n}鈴は ${on[i - 1].n}鈴より後の時間にしてください`;
    }
  }
  return "";
}

/** Highest bell number already reached (0 = none). Drives the colour stage. */
export function stageAt(bells, elapsed) {
  return bells.reduce((stage, b) => (b.on && elapsed >= b.t ? b.n : stage), 0);
}

/** Next enabled bell after `elapsed`, or null. */
export function nextBell(bells, elapsed) {
  return bells.find((b) => b.on && b.t > elapsed) || null;
}

/**
 * What the countdown counts towards.
 * 1鈴 is treated as a warning only: when 2鈴 or 3鈴 is enabled the countdown
 * targets those (end of talk, then end of Q&A). After the last target it
 * reports overtime measured from that target.
 * @returns {{target: object|null, remaining: number, overtime: number}}
 */
export function countdownState(bells, elapsed) {
  const on = bells.filter((b) => b.on);
  const main = on.some((b) => b.n >= 2) ? on.filter((b) => b.n >= 2) : on;
  if (main.length === 0) return { target: null, remaining: 0, overtime: 0 };
  const target = main.find((b) => b.t > elapsed);
  if (target) return { target, remaining: target.t - elapsed, overtime: 0 };
  const last = main[main.length - 1];
  return { target: last, remaining: 0, overtime: elapsed - last.t };
}
