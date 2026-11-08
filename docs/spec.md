# Spec: Clock page + conference timekeeper

- **URL:** https://seminar.k16kgw.com/clock/ (clock), https://seminar.k16kgw.com/clock/#timer (timekeeper)
- **Repo:** `k16kgw/clock` (public), local `localdoc/github/Hobby/clock/`

## 1. Clock (approved 2026-11-08)

### Purpose

Open quickly on a projector or phone during a seminar and read the current time at a glance.

### Display

- Large `HH:MM:SS`, 24-hour, updated every second without drift (re-synced to each second boundary rather than a plain `setInterval(1000)`).
- Date below in Japanese, e.g. `2026年11月8日（日）`.
- Always Japan time (`Asia/Tokyo`), regardless of the device timezone.
- Dark background, high-contrast digits, tabular (fixed-width) numerals so the layout does not jitter.
- Text scales to fill the screen in landscape and portrait, phone to projector.

### Interaction

- Click / tap on the clock or `F` toggles fullscreen. A small hint is shown on load and fades after a few seconds.

## 2. Conference timekeeper (approved 2026-11-08)

### Purpose

Run a talk's timing from a laptop at the side of the room: bells (1鈴/2鈴/3鈴) ring automatically at the set times, and the time is readable from the podium.

### Placement

- Same page as the clock, switched with a 時計 / タイマー tab. Direct link: `/clock/#timer`.

### Bells

- Three bells, each set in minutes:seconds (`10`, `10:00`, `0:45` accepted). Defaults: 1鈴 10:00, 2鈴 12:00, 3鈴 15:00 *(builder's call: typical 12 + 3 slot)*.
- 1鈴 rings once, 2鈴 twice, 3鈴 three times. Any bell can be switched off.
- Enabled bells must be in increasing order; otherwise an error is shown and Start is disabled.
- Sound is a synthesized desk-bell tone (Web Audio), no audio files *(builder's call)*.
- **Bells ring on time even when the tab is in the background (desktop browsers)**: at start/resume all remaining bells are pre-scheduled on the audio clock; pause/reset cancel bells that have not started (a bell already sounding finishes all its strikes). On phones (iOS Safari, Android Chrome) the page must stay in front.
- If the audio clock is suspended or interrupted (output device change, phone call, sleep), the schedule is rebuilt when audio resumes; a bell missed by up to 15 s rings immediately. While running without working audio, a visible "🔇 … タップして有効化" warning is shown.
- iPhone: requests the `playback` audio session (Safari 17+) so bells sound even with the silent switch on.
- Time is entered as `分:秒`; full-width input (`１５：００`) is accepted. Invalid fields block Start.
- Test button in settings, and manual "ring once" (`B` / 🔔 button).
- Volume slider.

### Display

- Count-up (elapsed) or count-down, selectable in settings.
  - Count-up: big elapsed time; sub-line shows the next bell and time left to it, then overtime after the last bell.
  - Count-down *(builder's call)*: 1鈴 is a warning only, so the countdown targets 2鈴 then 3鈴 (or 1鈴 when it is the only bell on). After the last target it shows `+M:SS` overtime. Sub-line shows elapsed.
- Bell indicator `● ● ○` (off bells struck through).
- Background colour by stage: normal → amber after 1鈴 → red after 2鈴 → dark red after 3鈴.

### Controls

- Start/Pause `Space`, Reset `R` (confirmation whenever elapsed > 0), ring `B`, fullscreen `F`. Key auto-repeat is ignored. Space works even when a settings checkbox has focus.
- Settings editable only while not running; saved in the browser (`localStorage`).
- Elapsed time is anchored to the wall clock and the run state is saved, so an accidental reload mid-talk resumes where it was (already-rung bells are not repeated).
- While running and idle, the first tap on faded controls only reveals them (it does not press 一時停止).
- Screen kept awake while running (Wake Lock API, where supported).
- While running, the top bar, buttons and cursor fade after 3 s without mouse movement (still clickable).

## 3. Offline (approved 2026-11-09)

- After the first visit, the page works with no network: it opens, reloads, and runs the clock, timer and bells offline.
- A service worker (`sw.js`, scope `/clock/`) pre-caches all files as one versioned set and serves them cache-first, so files from two deployments are never mixed.
- Updating: bump `VERSION` in `sw.js` on every change. The new version is picked up in the background and shown from the next load; the page never reloads by itself (a talk may be running).

## Tech

- Static `index.html`, `css/style.css`, `js/*.js` (ES modules). No libraries, no build step.
- GitHub Pages from `main` branch root, HTTPS enforced.
- **No `CNAME` file** in this repo: the custom domain `seminar.k16kgw.com` is inherited from the user site `k16kgw.github.io`.

## Non-goals

Installable app (PWA manifest), server-time correction (the device clock is trusted), multiple timezones, analog face, speaker lists / multi-talk sessions, syncing between devices, custom sound files.
