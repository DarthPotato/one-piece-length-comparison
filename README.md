# What could you watch instead of One Piece?

A tiny static web app that makes One Piece's runtime (~470 hours and counting)
*feel* as long as it is. One Piece stands on one side of a shared time axis;
you stack up other shows on the other side and watch your pile climb toward —
and past — it.

**No build step, no backend, no dependencies.** Plain HTML/CSS/JS, made for
GitHub Pages.

## Features

- **Curated dataset** of ~130 shows (prestige drama, sitcoms, anime, minis,
  docs) with approximate episode counts and runtimes — works fully offline,
  no API key needed.
- **Preset packs** — one click adds "Prestige TV starter pack", "Anime
  classics", "Fellow giants", etc.
- **Optional TMDB search** — paste a [TMDB API key](https://www.themoviedb.org/settings/api)
  into Settings to search any show on Earth. The key lives only in your
  browser's localStorage; it is never part of the deployed site. Both v3 keys
  and v4 read tokens work.
- **Live comparison** — stat tiles, per-show tooltips, a
  "your stack reaches here" marker on the One Piece tower, and a full table
  of the receipts.
- **Adjustable assumptions** — One Piece keeps airing, so the episode count is
  editable (or synced from TMDB), and you can throw in the 15 films.
- **Share links** — "Copy link" encodes your stack in the URL hash.
- Light and dark mode (follows your system), keyboard-accessible, respects
  reduced motion.

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` won't work because the app uses
ES modules.)

## Deploy on GitHub Pages

1. Push this repo to GitHub (files live at the repo root — no build needed).
2. Repo **Settings → Pages → Build and deployment**: choose
   **Deploy from a branch**, pick your default branch and `/ (root)`.
3. Done. The site appears at `https://<user>.github.io/<repo>/`.

## Tweaking the data

Everything lives in [`js/data.js`](js/data.js):

- `ONE_PIECE_DEFAULTS` — default episode count / runtime for One Piece.
- `SHOWS` — the curated list (`eps` × `min` is all that matters).
- `PACKS` — the one-click preset bundles.

Counts and runtimes are deliberately approximate averages — this is a bit,
not a database.

## Credits

Optional search powered by [TMDB](https://www.themoviedb.org/). This product
uses the TMDB API but is not endorsed or certified by TMDB.
