// Current-time clock, always shown in Japan time.

const TIME_ZONE = "Asia/Tokyo";

const timeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const partsOf = (fmt, date) =>
  Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));

/**
 * Start the clock.
 * @param {{time: HTMLElement, date: HTMLElement, isActive: () => boolean}} opts
 */
export function startClock({ time, date, isActive }) {
  const colon = '<span class="colon">:</span>';
  let lastDate = "";
  let timer = 0;

  function render() {
    const now = new Date();
    const t = partsOf(timeFmt, now);
    time.innerHTML = t.hour + colon + t.minute + colon + t.second;

    const d = partsOf(dateFmt, now);
    const dateText = `${d.year}年${d.month}月${d.day}日（${d.weekday}）`;
    if (dateText !== lastDate) {
      date.textContent = dateText;
      lastDate = dateText;
    }
    if (isActive()) document.title = `${t.hour}:${t.minute} 時計`;
  }

  // Re-sync to the next second boundary each tick so the display never drifts.
  function tick() {
    render();
    clearTimeout(timer);
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
  tick();
  return { render };
}
