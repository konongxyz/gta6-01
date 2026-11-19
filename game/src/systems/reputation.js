// reputation.js (systems/) — Mari's standing in Port Solano: a respect score that
// rises with story jobs, fares, packages and race wins, and a ladder of titled
// ranks the HUD shows next to her name. The city notices what she does; this file
// keeps the tally and announces each promotion the moment it lands.

import { sfx } from '../audio/audio.js';

export const REP_RANKS = [
  { at: 0, title: 'Nobody' },
  { at: 50, title: 'Lookout' },
  { at: 120, title: 'Runner' },
  { at: 220, title: 'Wheelman' },
  { at: 350, title: 'Smuggler' },
  { at: 520, title: 'Shot Caller' },
  { at: 740, title: 'Fixer' },
  { at: 1000, title: 'Kingpin' },
  { at: 1350, title: 'Queen of the Hour' },
];

export function rankFor(rep) {
  let current = REP_RANKS[0];
  let next = null;
  for (let i = 0; i < REP_RANKS.length; i += 1) {
    if (rep >= REP_RANKS[i].at) {
      current = REP_RANKS[i];
      next = REP_RANKS[i + 1] ?? null;
    }
  }
  return { title: current.title, at: current.at, next };
}

export function addRep(game, points, why = '') {
  const player = game.player;
  const before = rankFor(player.rep ?? 0).title;
  player.rep = (player.rep ?? 0) + points;
  const now = rankFor(player.rep);
  if (now.title !== before) {
    game.toast(`Respect — the city calls you ${now.title} now`);
    sfx.success();
  } else if (why) {
    game.toast(`+${points} respect — ${why}`);
  }
  return player.rep;
}
