# Ember

Your personal journal, habit tracker, goal board, reading list, tasks and focus timer, all in one app. It has a dark graphite and orange, Apple-inspired design.

## Open it

- **Easiest:** double-click `index.html`. It opens in your browser and needs no install and no internet (apart from book search and the Inter font).
- **As an installable app:** run `node serve.js`, open http://localhost:5173 in Chrome or Edge, then choose **Install Ember** in the address bar. It then works offline and gets its own window.

## On your iPhone

**Quick try (same Wi-Fi, PC must stay on):**
1. On the PC run `node serve.js --lan`. It prints an address like `http://192.168.1.20:5173`. If Windows asks about the firewall, allow access.
2. On the iPhone, open that address in **Safari**, then tap **Share → Add to Home Screen**.

**For every day (works anywhere, even offline):** host the folder on free HTTPS hosting such as GitHub Pages, open the URL once in Safari, and tap **Share → Add to Home Screen**. Only the app code is online. Your entries stay on the phone.

Notes:
- The phone and the PC each keep their own data. To move data between them, use Settings → **Export backup** (on iPhone this opens the share sheet: Save to Files, iCloud Drive or AirDrop), then **Import backup** on the other device.
- iOS pauses the app when it's closed or the screen locks. The focus timer catches up when you come back, but it can't play the chime while the app is closed.

## Garmin (sleep, stress, Body Battery…)

The **Health** page shows sleep, sleep score, stress, Body Battery, resting heart rate, HRV and steps. It compares them with your focus time, finished tasks, habits and mood.

Garmin has no public connection for personal apps, so there are two ways to get the data in:

1. **Log by hand** (any device): Health → **Log**, and copy the numbers from the Garmin Connect app.
2. **Automatic download** (Windows PC):
   - Install Python once: `winget install Python.Python.3.12`
   - Double-click **`sync-garmin.cmd`**. The first time, sign in with your Garmin email and password in that window. They go only to Garmin, and the login is remembered on this PC (`~/.garminconnect`).
   - The first run downloads 180 days, later runs 30. For a full year, run `sync-garmin.cmd --days 365` in a terminal.
   - Then in Ember: Health → **Import file** → `garmin-export/ember-health-latest.json`.
   - **For the iPhone:** use **`sync-garmin-to-onedrive.cmd`** instead. It also saves a copy to `OneDrive\Ember`, which you can import from the Files app (with the OneDrive app installed).

The download uses the unofficial [`garminconnect`](https://github.com/cyberjunky/python-garminconnect) library, so it can break if Garmin changes their site. `garmin-export/` is in `.gitignore`, so your health data never ends up on GitHub.

CSV import also works. It needs a `date` column plus any of: `sleep` (minutes) or `sleep hours`, `sleep score`, `stress`, `body battery`, `resting hr`, `hrv`, `steps`. Commas or semicolons both work.

## What's inside

| Section | What it does |
|---|---|
| **Today** | Activity-style rings (habits, tasks, focus), mood check-in, today's habits and tasks, current book, goals in progress, quote of the day |
| **Journal** | Entries with mood, tags and favorites, autosave, writing prompts, calendar view, search (`#tag` works too) |
| **Habits** | Weekly check-in grid, counted habits (e.g. 8 glasses of water), custom days, streaks, heatmaps, archive |
| **Goals** | Board with Planned / In Progress / Achieved columns, drag and drop, categories, deadlines, milestones |
| **Tasks** | Reminders-style smart lists (Today, Scheduled, All, Flagged), your own lists, priorities, due dates |
| **Books** | Reading, Want to Read and Finished shelves, Open Library search with covers, page progress, ratings, notes, quotes, yearly reading challenge |
| **Focus** | Pomodoro timer with breaks, session log, ambient rain/brown/white noise, notifications |
| **Insights** | Mood trend, habit consistency, focus and reading charts, and automatic observations |
| **Spotlight** | `Ctrl K` searches everything and runs quick actions |

## Your data

Everything is stored privately in your browser's local storage on this computer. Nothing is sent anywhere. Book search is the one exception: it sends only your search text to Open Library.

**Back up now and then:** Settings → *Export backup* saves a `.json` file, and *Import backup* restores it. You can also use a backup to move your data to another browser or computer.

> Clearing your browser's site data erases Ember's data, so keep a backup.

## Keyboard shortcuts

`Ctrl K` search · `N` new item · `1`–`8` switch section · `Space` start/pause the timer on the Focus page · `Esc` close
