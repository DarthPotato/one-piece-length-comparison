#!/usr/bin/env python3
"""Build js/shows.js — the top ~1000 TV series by IMDb vote count.

Usage:
    python3 scripts/build_dataset.py /path/to/imdb-datasets

The data dir must contain these files from https://datasets.imdbws.com/
(IMDb non-commercial datasets):
    title.ratings.tsv.gz   title.basics.tsv.gz   title.episode.tsv.gz

Output: js/shows.js (an ES module with the SHOWS array).

Per entry: id (IMDb tconst — stable across rebuilds, used in share links),
name, years, eps (episodes listed on IMDb), min (average minutes per
episode), v (votes, rounded — used to rank search results), and an approx
flag when the runtime had to be guessed.
"""

import csv
import gzip
import json
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

TOP_N = 1000
MIN_VOTES_PREFILTER = 1000
CANDIDATE_POOL = 1600  # ranked pool to draw from, before episode-count checks

# One Piece (1999 anime) is the thing being compared against, not a pick.
EXCLUDE = {'tt0388629'}

# Pack members must exist in the output even if they fall below the cutoff.
# Resolved by normalized primary title, highest vote count wins.
FORCE_TITLES = [
    'Breaking Bad', 'The Wire', 'The Sopranos', 'Mad Men', 'Succession',
    'Fullmetal Alchemist: Brotherhood', 'Cowboy Bebop', 'Death Note',
    'Steins;Gate', 'Neon Genesis Evangelion',
    'The Office', 'Parks and Recreation', 'Seinfeld', '30 Rock', 'Community',
    'Chernobyl', 'Band of Brothers', "The Queen's Gambit", 'Fleabag',
    'Mare of Easttown',
    'The Simpsons', 'Supernatural', 'Detective Conan', 'Doctor Who',
    'Naruto: Shippuden',
]


def norm(name):
    """lowercase, strip accents and punctuation — tolerant title matching
    (IMDb writes 'Steins; Gate', 'Naruto: Shippûden', …)."""
    ascii_name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    return ''.join(c for c in ascii_name if c.isalnum())


def tsv_rows(path):
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as f:
        reader = csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
        next(reader)  # header
        yield from reader


def main(data_dir):
    data = Path(data_dir)

    print('reading ratings…', file=sys.stderr)
    votes = {}
    for tc, _rating, nvotes in tsv_rows(data / 'title.ratings.tsv.gz'):
        v = int(nvotes)
        if v >= MIN_VOTES_PREFILTER:
            votes[tc] = v

    print('reading basics (pass 1: series)…', file=sys.stderr)
    series = {}
    for row in tsv_rows(data / 'title.basics.tsv.gz'):
        tc, ttype, primary, _orig, adult, sy, ey, rt, _genres = row
        if ttype not in ('tvSeries', 'tvMiniSeries') or adult == '1':
            continue
        v = votes.get(tc)
        if not v or tc in EXCLUDE:
            continue
        series[tc] = {
            'name': primary,
            'sy': None if sy == r'\N' else sy,
            'ey': None if ey == r'\N' else ey,
            'rt': None if rt == r'\N' else int(rt),
            'v': v,
        }

    ranked = sorted(series, key=lambda tc: -series[tc]['v'])
    pool = set(ranked[:CANDIDATE_POOL])

    # Resolve forced titles against the full series set (not just the pool).
    by_name = defaultdict(list)
    for tc, s in series.items():
        by_name[norm(s['name'])].append(tc)
    forced = {}
    for title in FORCE_TITLES:
        matches = by_name.get(norm(title), [])
        if not matches:
            print(f'!! forced title not found: {title}', file=sys.stderr)
            continue
        best = max(matches, key=lambda tc: series[tc]['v'])
        forced[title] = best
        pool.add(best)

    print('reading episodes…', file=sys.stderr)
    ep_count = Counter()
    ep_parent = {}
    for tc, parent, _s, _e in tsv_rows(data / 'title.episode.tsv.gz'):
        if parent in pool:
            ep_count[parent] += 1
            ep_parent[tc] = parent

    # Second basics pass only for episode runtimes of series lacking one.
    need_rt = {tc for tc in pool if series[tc]['rt'] is None or series[tc]['rt'] > 150}
    want_eps = {tc for tc, p in ep_parent.items() if p in need_rt}
    ep_runtimes = defaultdict(list)
    if want_eps:
        print(f'reading basics (pass 2: runtimes for {len(need_rt)} series)…', file=sys.stderr)
        for row in tsv_rows(data / 'title.basics.tsv.gz'):
            tc, _ttype, _primary, _orig, _adult, _sy, _ey, rt, _genres = row
            if tc in want_eps and rt != r'\N':
                ep_runtimes[ep_parent[tc]].append(int(rt))

    def finalize(tc):
        s = series[tc]
        eps = ep_count.get(tc, 0)
        if eps < 2:
            return None
        rt, approx = s['rt'], False
        if rt is None or rt > 150:
            med = statistics.median(ep_runtimes[tc]) if ep_runtimes.get(tc) else None
            if med and 5 <= med <= 150:
                rt = round(med)
            else:
                rt, approx = 30, True
        sy, ey = s['sy'], s['ey']
        if not sy:
            years = ''
        elif ey and ey != sy:
            years = f'{sy}–{ey[2:]}'
        elif ey:
            years = sy
        else:
            years = f'{sy}–'
        return {
            'id': tc, 'name': s['name'], 'years': years,
            'eps': eps, 'min': rt, 'v': round(s['v'], -3),
            **({'approx': True} if approx else {}),
        }

    out = []
    seen = set()
    for tc in ranked:
        if len(out) >= TOP_N:
            break
        if tc in pool and tc not in seen:
            entry = finalize(tc)
            if entry:
                out.append(entry)
                seen.add(tc)
    for title, tc in forced.items():
        if tc not in seen:
            entry = finalize(tc)
            if entry:
                out.append(entry)
                seen.add(tc)
            else:
                print(f'!! forced title has no usable episode data: {title}', file=sys.stderr)

    out.sort(key=lambda e: -e['v'])

    lines = [
        '// AUTO-GENERATED by scripts/build_dataset.py — do not edit by hand.',
        '// Top TV series by IMDb vote count. Episode counts/runtimes are approximate.',
        '// Information courtesy of IMDb (https://www.imdb.com). Used with permission.',
        'export const SHOWS = [',
    ]
    for e in out:
        lines.append('  ' + json.dumps(e, ensure_ascii=False, separators=(',', ':')) + ',')
    lines.append('];\n')

    dest = Path(__file__).resolve().parent.parent / 'js' / 'shows.js'
    dest.write_text('\n'.join(lines), encoding='utf-8')
    print(f'wrote {dest} with {len(out)} shows', file=sys.stderr)

    print('\npack member ids:', file=sys.stderr)
    for title, tc in forced.items():
        s = series[tc]
        print(f'  {title!r}: {tc} ({s["name"]}, {s["sy"]}, {s["v"]:,} votes, '
              f'{ep_count.get(tc, 0)} eps)', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
