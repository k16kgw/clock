# Spec: Clock page

Approved 2026-11-08.

- **URL:** https://seminar.k16kgw.com/clock/
- **Repo:** `k16kgw/clock` (public), local `localdoc/github/Hobby/clock/`

## Purpose

Open quickly on a projector or phone during a seminar and read the current time at a glance.

## Display

- Large `HH:MM:SS`, 24-hour, updated every second without drift (re-synced to each second boundary rather than a plain `setInterval(1000)`).
- Date below in Japanese, e.g. `2026年11月8日（日）`.
- Always Japan time (`Asia/Tokyo`), regardless of the device timezone.
- Dark background, high-contrast digits, tabular (fixed-width) numerals so the layout does not jitter.
- Text scales to fill the screen in landscape and portrait, phone to projector.

## Interaction

- Click / tap / `F` toggles fullscreen. A small hint is shown on load and fades after a few seconds.
- No settings, alarms, or timers.

## Tech

- One static `index.html` with inline CSS/JS. No libraries, no build step.
- GitHub Pages from `main` branch root.
- **No `CNAME` file** in this repo: the custom domain `seminar.k16kgw.com` is inherited from the user site `k16kgw.github.io`; adding one here would break it.

## Non-goals

Server-time correction (the device clock is trusted), multiple timezones, analog face, countdown/timer.

## Done when

https://seminar.k16kgw.com/clock/ loads over HTTPS and shows the correct ticking time, verified in a browser.
