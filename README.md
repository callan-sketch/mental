# Competition Mindset app — base build + Week 1

A self-guided mental skills app for competition climbers. It's a static site for GitHub Pages, with a Google Sheets backend through Apps Script.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Home: week video, five-task checklist, recent entries |
| `login.html` | Sign-in screen with a developer-mode button (Firebase comes later) |
| `module1.html` | Week 1 Tasks 1–3: onboarding + Competition Profile (`#onboarding`), goals (`#goals`), comp video breakdown (`#breakdown`) |
| `session.html` | Task 4, used every week: session assessment |
| `pressure.html` | Task 5, used every week: pressure-climb log (Week 1 version, the 6-link chain) |
| `assets/app.js` | Shared code: settings, local storage, sync queue, form helpers, option lists |
| `assets/app.css` | Shared styles (light and dark) |
| `apps-script/Code.gs` | Paste into Apps Script. **Don't upload it to the website.** |

## 1. Set up the sheet

1. Create a new Google Sheet, e.g. "Competition Mindset — Data".
2. Go to **Extensions → Apps Script**. Delete what's there and paste in `Code.gs`.
3. Change `APP_KEY` to a random word or phrase.
4. Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL, which ends in `/exec`.

The tabs (`profile`, `goals`, `breakdown`, `sessions`, `pressure`) are created the first time data arrives. New fields become new columns automatically.

After changing `Code.gs`, use **Deploy → Manage deployments → Edit → New version**. That keeps the same URL.

## 2. Connect the app

Open `assets/app.js` and fill in `CONFIG` at the top:

- `SCRIPT_URL`: the `/exec` URL.
- `APP_KEY`: the same phrase you used in `Code.gs`.
- `VIDEOS`: the YouTube ID for Week 1, e.g. `{ 1: "dQw4w9WgXcQ" }`.
- `HELP_CONTACT`: the referral line shown on the home page.

## 3. Publish on GitHub Pages

1. Upload everything except the `apps-script` folder to a repo.
2. Go to **Settings → Pages → Deploy from branch**, then choose `main` and `/ (root)`.
3. Optional: add a custom domain such as `mindset.corelearning.co.za`.

## How data moves

- Every entry is saved on the phone first, so logging works without signal.
- It's then queued and sent to the sheet. The header shows "Synced", "Syncing…" or "X waiting to sync".
- Editing the profile, goals or breakdown updates the same row in the sheet instead of adding a new one.

## Before real athletes use it

- **Login:** developer mode has no password. Swap in Firebase Auth before the pilot.
- **Security:** `APP_KEY` sits in the public JavaScript, so it only stops casual misuse. Once Firebase is in, `Code.gs` should verify each athlete's Firebase ID token before writing. Don't collect real athletes' data, especially minors', until that's done (POPIA).
- **Consent:** the parent/guardian step is a basic tick box. Check the wording with whoever advises you on POPIA.

## Adding later weeks

- Add `module2.html` and so on, following `module1.html`.
- Add each week's extra steps to `pressure.html`, e.g. the dial from Week 2 and noise from Week 3.
- Add the week's tasks to `weekTasks()` in `app.js`, and raise `buildWeek` in `index.html`.
