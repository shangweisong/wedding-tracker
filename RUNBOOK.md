# 🗒️ Wedding Day Runbook

A one-page checklist for the helpers running the guest tracker. Print it or pin it
at the reception desk.

## The day before

- [ ] **Wake the database.** The Supabase free tier pauses after ~1 week idle.
      Open the app and load the guest list once — if it's empty or won't load,
      click **Restore project** in the Supabase dashboard and wait a minute.
- [ ] **Check the guest list is loaded.** Import the CSV now, not on the day.
- [ ] **Take a backup.** Click **Backup** in the toolbar to download a
      `wedding-backup-*.json` file. Keep it somewhere safe (phone, email to self).
- [ ] **Confirm the access code works** on every helper's phone, on mobile data
      (not just the home WiFi).

## On the day — setup

- [ ] Share the **live URL** and the **access code** with helpers.
      (The access code is the helper-account password — see the README.)
- [ ] Each helper opens the URL and enters the access code once.
- [ ] Decide **one person owns the angbao amounts.** Two people editing the same
      red-packet amount can overwrite each other — keep it to one.
      *(Skip this if ang-bao tracking is turned off — `VITE_ENABLE_ANGBAO=false`;
      the 🧧 buttons and Angbao tab won't appear. See the README.)*

## During the event

- **Check-in:** tap the round button next to a guest's name. It turns green and
  records the arrival time.
- **Angbao** *(if enabled):* tap **🧧 Pending → Gave**, then type the amount. Wait
  a second after typing so it saves.
- **Made a mistake?** A toast with an **Undo** button appears after check-ins,
  angbao changes, and deletes — tap it to revert.
- **Hit Backup** once mid-event (e.g. after the bulk of guests arrive).

## If something looks wrong

- **A screen looks frozen or stale** — pull-to-refresh, or tap the **Refresh**
  button in the toolbar. Devices otherwise auto-sync every 5 seconds.
- **"Not saved — check connection"** — the venue WiFi blipped. Your last tap is
  still shown locally; it will reconcile once the connection returns. If unsure,
  re-tap once the toast clears.
- **Can't unlock** — re-type the access code carefully (it's case-sensitive). If
  it still fails, the helper account password may have changed in Supabase.
- **Everything is down** — fall back to the `wedding-backup-*.json` you saved, or
  the printed guest list. Don't panic; the data is in the backup.

## After the event

- [ ] Click **Export CSV** for the attendance + angbao report.
- [ ] Click **Backup** one last time for a lossless JSON copy.
