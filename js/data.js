// The built-in show list lives in shows.js (auto-generated, top ~1000 TV
// series by IMDb vote count — rebuild with scripts/build_dataset.py).
import { SHOWS } from './shows.js';

export { SHOWS };

export const ONE_PIECE_DEFAULTS = {
  eps: 1175,       // fallback when TVMaze is unreachable — synced live on load
  min: 24,         // average minutes per episode
  moviesMinutes: 1425, // the 15 films, ~95 min each
  movieCount: 15,
};

// Preset packs — one click adds the whole set. Ids are IMDb tconsts.
export const PACKS = [
  {
    id: 'prestige',
    label: 'Prestige TV starter pack',
    shows: ['tt0903747', 'tt0306414', 'tt0141842', 'tt0804503', 'tt7660850'],
    // Breaking Bad, The Wire, The Sopranos, Mad Men, Succession
  },
  {
    id: 'anime-classics',
    label: 'Anime classics',
    shows: ['tt1355642', 'tt0213338', 'tt0877057', 'tt1910272', 'tt0112159'],
    // FMA: Brotherhood, Cowboy Bebop, Death Note, Steins;Gate, Evangelion
  },
  {
    id: 'sitcom-marathon',
    label: 'Sitcom marathon',
    shows: ['tt0386676', 'tt1266020', 'tt0098904', 'tt0496424', 'tt1439629'],
    // The Office (US), Parks and Rec, Seinfeld, 30 Rock, Community
  },
  {
    id: 'weekend-minis',
    label: 'Weekend miniseries',
    shows: ['tt7366338', 'tt0185906', 'tt10048342', 'tt5687612', 'tt10155688'],
    // Chernobyl, Band of Brothers, The Queen's Gambit, Fleabag, Mare of Easttown
  },
  {
    id: 'fellow-giants',
    label: 'Fellow giants',
    shows: ['tt0096697', 'tt0460681', 'tt0131179', 'tt0436992', 'tt0988824'],
    // The Simpsons, Supernatural, Detective Conan, Doctor Who (2005), Naruto: Shippuden
  },
];

export function findShow(id) {
  return SHOWS.find((s) => s.id === id);
}
