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
  {
    id: 'sci-fi-odyssey',
    label: 'Sci-fi odyssey',
    shows: ['tt3230854', 'tt0407362', 'tt0106179', 'tt2085059', 'tt11280740', 'tt9253284'],
    // The Expanse, Battlestar Galactica, The X-Files, Black Mirror, Severance, Andor
  },
  {
    id: 'shonen-gauntlet',
    label: 'Shonen gauntlet',
    shows: ['tt2098220', 'tt2560140', 'tt12343534', 'tt9335498', 'tt4508902'],
    // Hunter x Hunter, Attack on Titan, Jujutsu Kaisen, Demon Slayer, One Punch Man
  },
  {
    id: 'british-comedy',
    label: 'British comedy hour',
    shows: ['tt0072500', 'tt0096548', 'tt0487831', 'tt0387764', 'tt7120662'],
    // Fawlty Towers, Blackadder Goes Forth, The IT Crowd, Peep Show, Derry Girls
  },
  {
    id: 'cozy-rewatch',
    label: 'Cozy rewatch',
    shows: ['tt0238784', 'tt3526078', 'tt1826940', 'tt2467372', 'tt10986410'],
    // Gilmore Girls, Schitt's Creek, New Girl, Brooklyn Nine-Nine, Ted Lasso
  },
  {
    id: 'gone-too-soon',
    label: 'Gone too soon',
    shows: ['tt0303461', 'tt0193676', 'tt3718778', 'tt0098936', 'tt5290382'],
    // Firefly, Freaks and Geeks, Over the Garden Wall, Twin Peaks, Mindhunter
  },
];

export function findShow(id) {
  return SHOWS.find((s) => s.id === id);
}

// Anime saga boundaries — approximate first episode of each saga.
export const SAGAS = [
  { ep: 1, name: 'East Blue' },
  { ep: 62, name: 'Alabasta' },
  { ep: 136, name: 'Sky Island' },
  { ep: 207, name: 'Water 7' },
  { ep: 326, name: 'Thriller Bark' },
  { ep: 385, name: 'Summit War' },
  { ep: 517, name: 'Fish-Man Island' },
  { ep: 575, name: 'Dressrosa' },
  { ep: 751, name: 'Whole Cake Island' },
  { ep: 892, name: 'Wano Country' },
  { ep: 1086, name: 'Final Saga' },
];

export function sagaFor(ep) {
  let current = SAGAS[0];
  for (const s of SAGAS) {
    if (ep >= s.ep) current = s;
  }
  return current;
}
