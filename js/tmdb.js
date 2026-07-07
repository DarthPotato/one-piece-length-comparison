// Minimal TMDB client. Entirely optional — the app works without it.
// The key is supplied by the visitor at runtime and kept in localStorage;
// it is never part of the deployed site. Accepts either a v3 API key or a
// v4 read access token (the long one starting with "eyJ").

const BASE = 'https://api.themoviedb.org/3';

async function tmdbFetch(path, params, key) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const opts = { headers: { Accept: 'application/json' } };
  if (key.startsWith('eyJ')) {
    opts.headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set('api_key', key);
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return res.json();
}

export async function searchTv(query, key) {
  const data = await tmdbFetch('/search/tv', { query, include_adult: 'false' }, key);
  return (data.results || []).slice(0, 5).map((r) => ({
    tmdbId: r.id,
    name: r.name,
    year: (r.first_air_date || '').slice(0, 4),
  }));
}

export async function tvDetails(tmdbId, key) {
  const d = await tmdbFetch(`/tv/${tmdbId}`, {}, key);
  // episode_run_time is often empty on newer shows; fall back to the most
  // recently aired episode's runtime, then to a marked 30-minute guess.
  const knownMin = d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || 0;
  const from = (d.first_air_date || '').slice(0, 4);
  const to = d.status === 'Ended' || d.status === 'Canceled' ? (d.last_air_date || '').slice(0, 4) : '';
  return {
    tmdbId: d.id,
    name: d.name,
    eps: d.number_of_episodes || 0,
    min: knownMin || 30,
    approx: !knownMin,
    years: from ? (to && to !== from ? `${from}–${to.slice(2)}` : `${from}–`) : '',
  };
}
