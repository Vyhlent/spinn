# Spinn: workout log for iPhone

An installable web app (PWA). Add it to your iPhone home screen and it opens full-screen and works offline like a regular app. No App Store or Mac needed.

- **Workout tab:** switch each day between **Upper** and **Lower**. Any exercise you add joins that routine and shows up on every Upper (or Lower) day, with the same number of sets as last time. Log body weight and weight × reps per set on one screen. Each exercise shows last session's numbers, and **Repeat** fills them in with one tap. New days alternate Upper and Lower automatically. **Reorder** lets you drag exercises into the order you want, and that order is used on every day of that type.
- **Muscles tab:** shows the same day as the Workout tab. It has a front/back body map shaded by sets per muscle (switch between that day and the last 7 days), bars for each muscle worked that day (by sets or volume), and a last-7-days list against a weekly target (10–20 sets by default, adjustable in Settings). There are 18 muscle groups. Common exercises are tagged automatically with primary and secondary muscles, and secondary muscles count as ½ a set. For anything else, a picker opens when you add it. To change an exercise's muscles, tap the muscle line under its name on the Workout tab.
- **Progress tab:** pick an exercise and see **Avg Volume** (default), **First Set**, or **1 Rep Max** (estimated) over **1W / 1M / 3M / 1Y**, plus a body weight chart. Tap the chart to inspect a session.
- **History tab:** a month calendar with Upper (blue) and Lower (orange) workout days marked, and that month's workouts listed below. Use the arrows to change months, and tap any day to open it and view or edit it. The settings button (top right) has lb/kg, backup export/import, and delete-all.

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

After you change any file, bump `CACHE` in `sw.js` (e.g. `spinn-v3`) and re-upload. The app reloads itself with the new version a moment after you open it.
