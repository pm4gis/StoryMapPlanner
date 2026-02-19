# StoryMap Planner

StoryMap Planner is a small, polished planning app for shaping your Esri StoryMaps structure before building in Esri StoryMaps. It runs fully in the browser with no install and no build tools.

## What this tool does
- Plan your story as ordered section cards
- Add metadata (audience, goal, tone, CTA, etc.)
- Track story arc balance and completeness
- Save projects automatically in your browser (`localStorage`)
- Export/import one JSON file for backup/share
- Export clean Markdown and plain text outlines
- Print a storyboard layout (A4/A3 landscape)
- Optional AI Assist features on Cloudflare Pages

## Run locally (easiest)
You do **not** need to install anything.

1. Download or clone this repository.
2. Open the project folder.
3. Double-click `index.html`.
4. The app opens in your browser and works offline.

> In local `file://` mode, AI Assist is disabled by design with a clear message.

## Publish on GitHub Pages
1. Push this repo to GitHub.
2. In your GitHub repo, open **Settings → Pages**.
3. Under **Build and deployment**, set:
   - Source: **Deploy from a branch**
   - Branch: your main branch (usually `main`) and folder `/ (root)`
4. Save and wait for deployment.
5. Open your GitHub Pages URL.

> On GitHub Pages, the app works fully except AI Assist (no server-side function support there).

## Publish on Cloudflare Pages
1. Log in to Cloudflare.
2. Go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Select this repository.
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
5. Deploy.

### Enable Workers AI for AI Assist
Cloudflare Workers AI is available with a free allocation measured in **neurons** and works on the free plan.

To enable AI in this app on Cloudflare Pages:
1. Open your Pages project.
2. Go to **Settings → Bindings**.
3. Add a **Workers AI** binding named exactly: `AI`.
4. Save and redeploy.

The app calls `/api/ai` from a Pages Function (`functions/api/ai.js`) so model requests run server-side only.

## How export and import works
- **Export JSON**: full project data for backup or transfer.
- **Import JSON**: restore a project from a prior export.
- **Export Markdown**: clean planning outline with headings.
- **Export Plain Text**: readable no-markup version.

## localStorage notes
- Your project auto-saves in browser `localStorage` under one key.
- Data stays on your device/browser profile.
- If browser data is cleared, local projects are removed.
- Use JSON export as backup.

## AI Assist overview
AI features include:
- Generate outline from metadata + chosen style
- Improve section key message
- Draft section narrative text
- Suggest missing alt text
- Suggest CTA
- Quality check with issue list + fixes

AI is **optional** and fails gracefully:
- Local file mode: disabled
- GitHub Pages: disabled
- Cloudflare Pages + `AI` binding: enabled

## Files
- `index.html` – app structure
- `styles.css` – themes, layout, print styling
- `app.js` – app logic and storage/export/import/AI UI
- `templates.js` – starter templates
- `functions/api/ai.js` – Cloudflare Pages Function for Workers AI
- `LICENSE` – MIT

## License
MIT
