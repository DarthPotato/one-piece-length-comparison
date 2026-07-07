# What could you watch instead of One Piece?

A tiny static web app that makes One Piece's runtime (~470 hours and counting)
*feel* as long as it is. One Piece stands on one side of a shared time axis;
you stack up other shows on the other side and watch your pile climb toward —
and past — it.

**No build step, no backend, no API keys.** Plain HTML/CSS/JS, made for
GitHub Pages.

## Features

- **Built-in list of the top 1,000 TV shows** (by IMDb vote count) with
  episode counts and average runtimes — ~90 KB of static JSON-ish data,
  searched instantly in the browser, works offline.
- **Live search for everything else** via the [TVMaze API](https://www.tvmaze.com/api) —
  free, keyless, CORS-open, so every visitor can search any show without
  anyone providing credentials. TVMaze runtimes are often broadcast-slot
  lengths, so they're marked approximate (≈).
- **Self-updating One Piece count** — the aired-episode count syncs from
  TVMaze on page load (with a built-in fallback when offline). Editing the
  number in Settings pins your own version.
- **Posters everywhere** — the One Piece tower wears the show's key art and
  every stacked show gets its own poster tile. Images are hotlinked from
  TVMaze at runtime (nothing copyrighted lives in this repo) and degrade to
  solid colors offline.
- **Saga markers** — the One Piece tower is etched with saga boundaries
  (Alabasta → Final Saga); hovering reads out the episode + saga at any
  height, and the reach line shows where your stack lands on the voyage.
- **Themes** — Auto, Light, Dark, Wanted Poster (parchment), and Abyss
  (deep sea), persisted per browser.
- **Preset packs** — one click adds "Prestige TV starter pack", "Anime
  classics", "Fellow giants", etc.
- **Live comparison** — stat tiles, per-show tooltips, a
  "your stack reaches here" marker on the One Piece tower, and a full table
  of the receipts.
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

## The data

- `js/shows.js` — auto-generated top-1,000 list. Rebuild it whenever you like:

  ```sh
  # grab the three IMDb non-commercial datasets (https://datasets.imdbws.com/)
  mkdir -p /tmp/imdb && cd /tmp/imdb
  curl -sSO https://datasets.imdbws.com/title.ratings.tsv.gz
  curl -sSO https://datasets.imdbws.com/title.basics.tsv.gz
  curl -sSO https://datasets.imdbws.com/title.episode.tsv.gz

  python3 scripts/build_dataset.py /tmp/imdb
  ```

  Show ids are IMDb tconsts, so share links stay valid across rebuilds.

- `js/data.js` — One Piece defaults and the preset packs.
- Counts and runtimes are deliberately approximate averages — this is a bit,
  not a database.

## Credits

Built-in list: information courtesy of [IMDb](https://www.imdb.com). Used with
permission (IMDb non-commercial datasets). Live search and episode data by
[TVMaze](https://www.tvmaze.com) (CC BY-SA).
