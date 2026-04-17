# Microsoft Store (Windows) — submission checklist

ArtVision Pro is a **Progressive Web App (PWA)**. The usual path to the Microsoft Store is **package the hosted PWA** (not a separate native codebase) via **PWABuilder** or Partner Center flows documented for Edge PWAs.

## Before you package

1. **Production URL**  
   Use a stable **HTTPS** origin (for example your Vercel app). The Store app opens this URL in an app window; `OPENAI_API_KEY` and API routes must work for that origin (same host or `VITE_CRITIQUE_API_URL` if the UI is hosted separately).

2. **Verify installability in Microsoft Edge (Windows)**  
   - Open the production URL in Edge.  
   - Confirm **App available** / install prompt appears and the installed app launches.  
   - Exercise **New critique**, **Studio**, **Glossary** from the app’s jump list (shortcuts come from the web manifest).

3. **Manifest**  
   Built by `vite-plugin-pwa` from `vite.config.ts` (name, icons, `display: standalone`, `shortcuts` for desktop integration). After `npm run build`, confirm generated assets under `dist/` (or use Edge **Application** tab → Manifest).

4. **Screenshots & listing copy**  
   Partner Center needs store screenshots (recommended **1920×1080** or Microsoft’s current guidance), short/long description, age rating questionnaire, and privacy policy URL.

5. **Privacy**  
   This repo ships a static policy at **`/privacy.html`** (also **`/privacy`** on Vercel via `vercel.json`). After deploy, your **privacy policy URL** is:
   `https://<your-production-host>/privacy.html`  
   Replace the “Contact” placeholder in `public/privacy.html` with your legal name and support email before store submission, then redeploy.

6. **Developer account**  
   Enroll in the **Microsoft Partner Center** / Windows developer program, pay any registration fee Microsoft requires, and reserve the app identity (name, package family).

## Package and submit

1. Go to [PWABuilder](https://www.pwabuilder.com/) (or follow [Publish a PWA to the Microsoft Store](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store)).  
2. Enter your **production** app URL and address any reported manifest / service worker issues.  
3. Generate the **Microsoft Store** package (typically `.msixbundle` / related bundles).  
4. In Partner Center, create the submission, upload packages, add screenshots and metadata, complete certification questionnaires, and submit for review.

## Optional: launch URLs

Shortcuts and manual links can open a specific main tab with:

`https://your-app.example/#/?tab=studio`  
Allowed `tab` values: `home`, `studio`, `benchmarks`, `glossary`, `profile`.

## Ongoing

After each production deploy, re-run PWABuilder or your packaging step if Microsoft or your tooling requires a refreshed package for updates.
