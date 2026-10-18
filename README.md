# Spinn: workout log for iPhone

An installable web app (PWA). Add it to your iPhone home screen and it opens full-screen and works offline like a regular app. No App Store or Mac needed.

- **Workout tab:** log body weight, add exercises, and enter weight × reps for each set, all on one screen. Each exercise shows what you did last time.
- **Progress tab:** pick an exercise and see **Avg Volume** (default), **First Set**, or **1 Rep Max** (estimated) over **1W / 1M / 3M / 1Y**, plus a body weight chart. Tap the chart to inspect a session.
- **History tab:** every past day, newest first. Tap a day to open it and view or edit it. The settings button (top right) has lb/kg, backup export/import, and delete-all.

## Put it on your iPhone

The phone has to load the app once from an `https://` address. After that it runs from the home screen, even offline.

1. Host this folder (both options are free):
   - **Netlify Drop:** go to <https://app.netlify.com/drop> and drag this folder onto the page. You get a URL like `https://something.netlify.app`.
   - **GitHub Pages:** push this folder to a GitHub repo, then go to *Settings → Pages → Deploy from branch → main / root*.
2. On the iPhone, open that URL in **Safari**.
3. Tap **Share**, then **Add to Home Screen**, then **Add**.
4. Open Spinn from the home screen icon from now on.

**Where your data lives:** workouts are saved on the phone, inside the home-screen app. They are not sent anywhere. The home-screen app and a regular Safari tab keep separate data, so always use the icon. To keep your data safe, use *History → settings → Export backup* now and then (you can save it to Files or iCloud Drive).

## Run it on your computer

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>.

## Updating the app

After you change any file, bump `CACHE` in `sw.js` (e.g. `spinn-v2`) and re-upload. The phone picks up the new version the second time you open the app.
