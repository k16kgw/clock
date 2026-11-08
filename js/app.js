// Page wiring: view switching (#timer), fullscreen, keyboard shortcuts, idle UI.

import { startClock } from "./clock.js";
import { createTimer } from "./timer.js";

const IDLE_MS = 3000;
const body = document.body;
const views = {
  clock: document.getElementById("view-clock"),
  timer: document.getElementById("view-timer"),
};
const tabs = [...document.querySelectorAll(".tabs [data-view]")];

const currentView = () => body.dataset.view;

const clock = startClock({
  time: document.getElementById("clock-time"),
  date: document.getElementById("clock-date"),
  isActive: () => currentView() === "clock",
});
const timer = createTimer({ isActive: () => currentView() === "timer" });

// ---------- Views ----------
function showView(name, { updateUrl = true } = {}) {
  const view = name === "timer" ? "timer" : "clock";
  body.dataset.view = view;
  for (const [key, el] of Object.entries(views)) el.hidden = key !== view;
  for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.view === view));
  if (view === "clock") delete body.dataset.stage;
  if (updateUrl) {
    const url = view === "timer" ? "#timer" : location.pathname + location.search;
    history.replaceState(null, "", url);
  }
  (view === "timer" ? timer : clock).render();
}

for (const tab of tabs) {
  tab.addEventListener("click", (ev) => {
    ev.currentTarget.blur();
    showView(tab.dataset.view);
  });
}
window.addEventListener("hashchange", () => {
  showView(location.hash === "#timer" ? "timer" : "clock", { updateUrl: false });
});

// ---------- Fullscreen ----------
const root = document.documentElement;
const canFullscreen = Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
const fsBtn = document.getElementById("fs-btn");

function toggleFullscreen() {
  if (!canFullscreen) return;
  const current = document.fullscreenElement || document.webkitFullscreenElement;
  if (current) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    return;
  }
  const result = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  if (result && result.catch) result.catch(() => {});
}

if (canFullscreen) {
  fsBtn.addEventListener("click", (ev) => { ev.currentTarget.blur(); toggleFullscreen(); });
  views.clock.addEventListener("click", toggleFullscreen);
  const hint = document.getElementById("clock-hint");
  hint.hidden = false;
  setTimeout(() => hint.classList.add("fade"), 4000);
} else {
  fsBtn.hidden = true;
  views.clock.style.cursor = "default";
}

// ---------- Keyboard ----------
const NON_TEXT_INPUTS = ["checkbox", "radio", "range", "button"];

/** True while the user is typing text (shortcuts must not fire). */
function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return target.tagName === "INPUT" && !NON_TEXT_INPUTS.includes(target.type);
}

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
  if (e.repeat) { // holding a key must not flip start/pause or stack bells
    if (e.key === " ") e.preventDefault();
    return;
  }
  if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
  const key = e.key.toLowerCase();
  if (key === "f") {
    toggleFullscreen();
  } else if (currentView() !== "timer") {
    return;
  } else if (key === " ") {
    e.preventDefault(); // also stops Space from ticking a focused checkbox
    timer.toggle();
  } else if (key === "r") {
    timer.reset();
  } else if (key === "b") {
    timer.ringOnce();
  }
});

// ---------- Idle: hide the bar, buttons and cursor while presenting ----------
// While the timer runs and the controls are faded out, the first tap only
// brings them back; it must not press an invisible 一時停止 button.
let swallowClick = false;
document.addEventListener("pointerdown", (e) => {
  swallowClick = body.classList.contains("idle") && body.classList.contains("running") &&
    e.target instanceof Element && Boolean(e.target.closest("#bar, .controls"));
}, true);
document.addEventListener("click", (e) => {
  if (!swallowClick) return;
  swallowClick = false;
  e.preventDefault();
  e.stopPropagation();
}, true);

let idleTimer = 0;
function wake() {
  body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const editing = timer.isSettingsOpen() && currentView() === "timer";
    if (!editing && !isTyping(document.activeElement)) body.classList.add("idle");
  }, IDLE_MS);
}
for (const ev of ["mousemove", "mousedown", "touchstart", "keydown", "focusin"]) {
  document.addEventListener(ev, wake, { passive: true });
}

showView(location.hash === "#timer" ? "timer" : "clock", { updateUrl: false });
wake();

// ---------- Offline support ----------
// Cache the site so it opens and reloads without a network (see sw.js).
// Skipped on localhost so local edits are never hidden behind the cache.
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
if ("serviceWorker" in navigator && !isLocal) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* still works online */ });
}
