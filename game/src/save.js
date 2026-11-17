// save.js — the game's memory. One localStorage record holds the run: cash, story
// progress, weapons, found packages, the player's spot and the statistics the end
// screens quote. Saving is silent and frequent (mission ends, pickups, pauses), so
// closing the tab never loses more than a minute of play.

const SAVE_KEY = 'solano-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(game) {
  try {
    const player = game.player;
    const data = {
      cash: Math.round(player.cash),
      missionIndex: game.missions.index,
      storyDone: game.missions.storyDone,
      hasPistol: player.hasPistol,
      ammo: player.ammo,
      health: Math.round(player.health),
      x: Math.round(player.x),
      y: Math.round(player.y),
      packages: game.world.packages.filter((p) => p.taken).map((p) => p.id),
      stats: game.stats,
      savedAtMinute: Math.floor(game.clockMinutes),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // A browser that refuses storage simply starts fresh each visit.
  }
}

export function freshStats() {
  return {
    carsStolen: 0,
    distanceDriven: 0,
    distanceWalked: 0,
    faresDone: 0,
    missionsDone: 0,
    timesBusted: 0,
    timesWasted: 0,
    shotsFired: 0,
    packagesFound: 0,
  };
}
