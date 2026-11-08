// Conference timekeeper: 1鈴 / 2鈴 / 3鈴 with automatic bells.

import { BellPlayer } from "./bell.js";
import {
  loadSettings, saveSettings, loadRunState, saveRunState, parseTime, formatTime,
  validateBells, stageAt, nextBell, countdownState,
} from "./settings.js";

const $ = (sel) => document.querySelector(sel);
const TICK_MS = 200;
const LATE_WINDOW = 15; // s: a bell missed by audio interruption still rings if this late

export function createTimer({ isActive }) {
  const settings = loadSettings();
  const bell = new BellPlayer(settings.volume);
  const els = {
    main: $("#timer-main"),
    sub: $("#timer-sub"),
    warn: $("#timer-audio-warn"),
    start: $("#timer-start"),
    reset: $("#timer-reset"),
    ring: $("#timer-ring"),
    settingsBtn: $("#timer-settings-btn"),
    form: $("#timer-settings"),
    error: $("#timer-error"),
    volume: $("#timer-volume"),
    test: $("#timer-test"),
    marks: [...document.querySelectorAll(".bell-mark")],
  };

  // Elapsed time is anchored to the wall clock so it stays right across
  // device sleep and page reloads.
  let running = false;
  let baseElapsed = 0; // seconds accumulated before the current run
  let startedAtEpoch = 0; // Date.now() when the current run started
  let tickTimer = 0;
  const played = new Set(); // bells that have already sounded this run

  const elapsed = () =>
    running ? baseElapsed + (Date.now() - startedAtEpoch) / 1000 : baseElapsed;
  const persist = () => saveRunState({ running, baseElapsed, startedAtEpoch });

  // ---------- Bells ----------
  /** (Re)build the audio schedule from the current elapsed time. */
  function scheduleBells() {
    for (const n of bell.cancelScheduled()) played.add(n);
    const e = elapsed();
    for (const b of settings.bells) {
      if (!b.on || played.has(b.n)) continue;
      if (b.t > e) {
        bell.schedule(b.n, b.t - e, b.n);
      } else if (e - b.t < LATE_WINDOW) {
        bell.schedule(b.n, 0, b.n); // missed while audio was interrupted: ring now
      } else {
        played.add(b.n);
      }
    }
  }

  bell.onStateChange = (state) => {
    if (running && state === "running") scheduleBells();
    render();
  };

  // ---------- Wake lock (keep the screen on while running) ----------
  let wakeLock = null;
  let wakeToken = 0;
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator) || wakeLock || document.hidden) return;
    const token = ++wakeToken;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (token !== wakeToken || !running) {
        sentinel.release().catch(() => {});
        return;
      }
      wakeLock = sentinel;
      sentinel.addEventListener("release", () => { if (wakeLock === sentinel) wakeLock = null; });
    } catch { /* not allowed - ignore */ }
  }
  function releaseWakeLock() {
    wakeToken += 1;
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  // ---------- Controls ----------
  const hasInvalidField = () => Boolean(els.form.querySelector('[aria-invalid="true"]'));
  const canStart = () => !hasInvalidField() && !validateBells(settings.bells);

  function start() {
    if (running || !canStart()) return;
    bell.ensure(); // unlock audio inside the user gesture
    startedAtEpoch = Date.now();
    running = true;
    persist();
    scheduleBells();
    acquireWakeLock();
    setSettingsOpen(false);
    loop();
  }

  function pause() {
    if (!running) return;
    baseElapsed = elapsed();
    running = false;
    persist();
    for (const n of bell.cancelScheduled()) played.add(n);
    releaseWakeLock();
    render();
  }

  function toggle() { running ? pause() : start(); }

  function reset() {
    if ((running || baseElapsed > 0) && !window.confirm("タイマーをリセットしますか？")) return;
    running = false;
    baseElapsed = 0;
    persist();
    bell.cancelScheduled();
    played.clear();
    releaseWakeLock();
    render();
  }

  function ringOnce() { bell.ring(1); }

  function loop() {
    render();
    clearTimeout(tickTimer);
    if (running) tickTimer = setTimeout(loop, TICK_MS);
  }

  // ---------- Rendering ----------
  function mainAndSub(e) {
    const bells = settings.bells;
    if (settings.mode === "down") {
      const cd = countdownState(bells, e);
      if (!cd.target) return [formatTime(e), "鈴が設定されていません", false];
      if (cd.overtime > 0) {
        return [`+${formatTime(cd.overtime)}`, `${cd.target.n}鈴から超過 · 経過 ${formatTime(e)}`, true];
      }
      return [formatTime(Math.ceil(cd.remaining - 1e-6)), `${cd.target.n}鈴まで · 経過 ${formatTime(e)}`, false];
    }
    const next = nextBell(bells, e);
    const lastOn = [...bells].reverse().find((b) => b.on);
    if (next) {
      return [formatTime(e), `次: ${next.n}鈴（${formatTime(next.t)}）まで ${formatTime(Math.ceil(next.t - e - 1e-6))}`, false];
    }
    if (lastOn) return [formatTime(e), `${lastOn.n}鈴から +${formatTime(e - lastOn.t)} 超過`, false];
    return [formatTime(e), "鈴が設定されていません", false];
  }

  function audioWarning() {
    if (settings.volume === 0) return "🔇 音量が 0 です";
    if (!running) return "";
    if (bell.state === "none" && !(window.AudioContext || window.webkitAudioContext)) {
      return "🔇 このブラウザでは鈴が鳴りません";
    }
    return bell.state === "running" ? "" : "🔇 音が止まっています — タップして有効化";
  }

  function render() {
    const e = elapsed();
    const bells = settings.bells;
    if (isActive()) document.body.dataset.stage = String(stageAt(bells, e));

    const [mainText, subText, over] = mainAndSub(e);
    els.main.textContent = mainText;
    els.main.classList.toggle("overtime", over);
    els.sub.textContent = subText;

    const warning = audioWarning();
    els.warn.textContent = warning;
    els.warn.hidden = !warning;

    els.marks.forEach((mark, i) => {
      const b = bells[i];
      mark.classList.toggle("off", !b.on);
      mark.classList.toggle("rung", b.on && e >= b.t);
      mark.title = b.on ? `${b.n}鈴 ${formatTime(b.t)}` : `${b.n}鈴 オフ`;
    });

    els.start.textContent = running ? "一時停止" : baseElapsed > 0 ? "再開" : "開始";
    els.start.disabled = !running && !canStart();
    els.settingsBtn.disabled = running;
    document.body.classList.toggle("running", running);
    if (isActive()) document.title = `${running ? "▶" : "⏸"} ${mainText} タイマー`;
  }

  // ---------- Settings form ----------
  function setSettingsOpen(open) {
    els.form.hidden = !open;
    els.settingsBtn.setAttribute("aria-expanded", String(open));
  }

  function fillForm() {
    for (const b of settings.bells) {
      els.form.querySelector(`[data-bell-on="${b.n}"]`).checked = b.on;
      els.form.querySelector(`[data-bell-time="${b.n}"]`).value = formatTime(b.t);
    }
    els.form.querySelector(`input[name="mode"][value="${settings.mode}"]`).checked = true;
    els.volume.value = String(settings.volume);
  }

  function onFormInput(ev) {
    const t = ev.target;
    if (t.dataset.bellOn) {
      settings.bells[Number(t.dataset.bellOn) - 1].on = t.checked;
    } else if (t.dataset.bellTime) {
      const sec = parseTime(t.value);
      t.setAttribute("aria-invalid", String(sec === null));
      if (sec !== null) {
        settings.bells[Number(t.dataset.bellTime) - 1].t = sec;
        if (ev.type === "change") t.value = formatTime(sec); // "12" -> "12:00" on blur
      }
    } else if (t.name === "mode") {
      settings.mode = t.value;
    } else if (t === els.volume) {
      settings.volume = Number(t.value);
      bell.setVolume(settings.volume);
    }
    const err = hasInvalidField()
      ? "時間は「分:秒」で入力してください（例 12:00）"
      : validateBells(settings.bells);
    els.error.textContent = err;
    els.error.hidden = !err;
    saveSettings(settings);
    render();
  }

  // ---------- Wiring ----------
  const click = (el, fn) => el.addEventListener("click", (ev) => {
    ev.currentTarget.blur(); // keep Space/R/B shortcuts from re-triggering the button
    fn();
  });
  click(els.start, toggle);
  click(els.reset, reset);
  click(els.ring, ringOnce);
  click(els.settingsBtn, () => setSettingsOpen(els.form.hidden));
  click(els.test, () => { bell.setVolume(settings.volume); bell.ring(1); });
  click(els.warn, () => {
    if (settings.volume === 0 && !running) setSettingsOpen(true);
    else bell.ensure();
  });
  els.form.addEventListener("input", onFormInput);
  els.form.addEventListener("change", onFormInput);
  els.form.addEventListener("submit", (ev) => ev.preventDefault());

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !running) return;
    bell.ensure();
    scheduleBells(); // resync in case the audio clock stalled while hidden
    acquireWakeLock(); // the lock is dropped when the tab is hidden
    loop();
  });

  // ---------- Restore after a reload ----------
  fillForm();
  const saved = loadRunState();
  if (saved) {
    baseElapsed = saved.baseElapsed;
    if (saved.running) {
      running = true;
      startedAtEpoch = saved.startedAtEpoch;
    }
    const e = elapsed();
    for (const b of settings.bells) if (b.on && b.t <= e) played.add(b.n); // don't re-ring
    if (running) {
      bell.ensure(); // likely suspended until the first tap; the warning asks for it
      scheduleBells();
      acquireWakeLock();
      loop();
    }
  }
  render();

  return { toggle, reset, ringOnce, render, isSettingsOpen: () => !els.form.hidden };
}
