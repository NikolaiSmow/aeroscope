# GitHub Pages for AeroScope

This repository uses GitHub Pages for static documentation only.

## How GitHub Pages works here

GitHub Pages serves files from a static publishing folder. In this repository,
GitHub Pages is configured to publish the `docs/` folder on the `main` branch.

The production AeroScope application is different: it is a Next.js app with API
routes and server-side secrets. GitHub Pages cannot run those routes because it
does not provide a Node.js server runtime. Keep the live app on a Node-capable
host and use Pages for the public documentation site.

## Enable it in GitHub

1. Push this repository to GitHub.
2. Open the repository settings.
3. Go to **Pages**.
4. Set **Build and deployment** to **Deploy from a branch**.
5. Select the `main` branch and the `/docs` folder.

After GitHub finishes publishing, it shows the Pages URL in the repository Pages
settings.

## Update the documentation page

Edit the static site files in `docs/`:

- `index.html` contains the visible documentation content.
- `styles.css` contains the visual system.
- `app.js` handles the active sidebar state and copy button.

Update this static page whenever the app setup, API routes, cache behavior, or
deployment assumptions change.
