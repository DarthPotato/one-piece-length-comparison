// TVMaze client — free, keyless, CORS-open (https://www.tvmaze.com/api).
// Rate limits apply per visitor IP (~20 requests / 10 s), which a debounced
// search box never approaches. Data is CC BY-SA, credited in the footer.

const BASE = 'https://api.tvmaze.com';

// The 1999 anime. A plain name search ranks the 2023 live-action first.
export const ONE_PIECE_TVMAZE_ID = 1505;

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`TVMaze request failed (${res.status})`);
  return res.json();
}

export async function searchShows(query) {
  const data = await get(`/search/shows?q=${encodeURIComponent(query)}`);
  return data.slice(0, 4).map(({ show }) => ({
    tvmazeId: show.id,
    name: show.name,
    year: (show.premiered || '').slice(0, 4),
    imdb: show.externals?.imdb || null,
  }));
}

export async function showDetails(tvmazeId) {
  const d = await get(`/shows/${tvmazeId}?embed=episodes`);
  const today = new Date().toISOString().slice(0, 10);
  const aired = (d._embedded?.episodes || []).filter((e) => e.airdate && e.airdate <= today);
  const runtimes = aired.map((e) => e.runtime).filter(Boolean).sort((a, b) => a - b);
  const median = runtimes.length ? runtimes[Math.floor(runtimes.length / 2)] : 0;
  const from = (d.premiered || '').slice(0, 4);
  const to = (d.ended || '').slice(0, 4);
  return {
    tvmazeId: d.id,
    imdb: d.externals?.imdb || null,
    name: d.name,
    eps: aired.length,
    // TVMaze often reports broadcast-slot length (ads included), so
    // TVMaze-sourced runtimes are always flagged as approximate.
    min: d.averageRuntime || median || 30,
    approx: true,
    years: from ? (to ? (to === from ? from : `${from}–${to.slice(2)}`) : `${from}–`) : '',
  };
}
