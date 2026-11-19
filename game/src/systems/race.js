// race.js (systems/) — the Marina Mile: a checkpoint street race that starts at
// the Boardwalk Stage, runs six gates around Port Solano against two rival
// drivers, and pays for position. The rivals steer for the same gates Mari does;
// the HUD objective, the timer and the running position all live here.

import { clamp, distance } from '../core/random.js';
import { sfx } from '../audio/audio.js';
import { createVehicle, speedOf, stepCar } from '../vehicles/vehicles.js';
import { PLACES } from '../world/world.js';
import { addRep } from './reputation.js';

export const RACE_ENTRY = 50;
export const RACE_PRIZES = [400, 150, 0];
export const RACE_START = { x: PLACES.boardwalk.x, y: PLACES.boardwalk.y, name: 'Boardwalk Stage' };

const CHECKPOINTS = [
  { x: 2880, y: 2240, label: 'the marina bend' },
  { x: 1600, y: 2240, label: 'the downtown crossing' },
  { x: 960, y: 1600, label: 'Anchor Arms corner' },
  { x: 1600, y: 960, label: 'the hospital hill' },
  { x: 2880, y: 960, label: 'the Azahar straight' },
  { x: PLACES.boardwalk.x, y: PLACES.boardwalk.y, label: 'the finish at the Boardwalk Stage' },
];

export function createRace() {
  return {
    active: false,
    phase: 'idle', // countdown | running | done
    countdown: 0,
    timer: 0,
    cpIndex: 0,
    position: 1,
    rivals: [],
    footTimer: 0,
    label: '',
    targetX: 0,
    targetY: 0,
  };
}

export function raceStartAvailable(game) {
  const race = game.race;
  const player = game.player;
  return race && !race.active && player.car && !game.missions.active && !game.missions.fare
    && distance(player.x, player.y, RACE_START.x, RACE_START.y) < 80;
}

export function startRace(game) {
  const player = game.player;
  if (player.cash < RACE_ENTRY) {
    game.toast(`The Marina Mile costs $${RACE_ENTRY} to enter`);
    sfx.fail();
    return false;
  }
  player.cash -= RACE_ENTRY;
  const race = game.race;
  race.active = true;
  race.phase = 'countdown';
  race.countdown = 3;
  race.timer = 0;
  race.cpIndex = 0;
  race.position = 1;
  race.footTimer = 0;
  race.rivals = [];
  const rivalTypes = ['coupe', 'sport'];
  for (let i = 0; i < 2; i += 1) {
    const car = createVehicle(rivalTypes[i], RACE_START.x - 60 - i * 90, RACE_START.y + 54, 0, 'race', game.rng);
    car.driver = 'rival';
    car.raceCp = 0;
    car.raceStuck = 0;
    car.raceReverse = 0;
    game.vehicles.push(car);
    race.rivals.push(car);
  }
  game.stats.racesRun = (game.stats.racesRun ?? 0) + 1;
  sfx.phone();
  game.toast('The Marina Mile — six gates, two rivals, no rules');
  syncRaceObjective(game);
  return true;
}

function progressOf(car, cpIndex) {
  const cp = CHECKPOINTS[Math.min(cpIndex, CHECKPOINTS.length - 1)];
  return cpIndex * 100000 - distance(car.x, car.y, cp.x, cp.y);
}

function syncRaceObjective(game) {
  const race = game.race;
  const cp = CHECKPOINTS[Math.min(race.cpIndex, CHECKPOINTS.length - 1)];
  race.targetX = cp.x;
  race.targetY = cp.y;
  const t = Math.max(0, race.timer);
  const clock = `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
  if (race.phase === 'countdown') {
    race.label = `Marina Mile — ${Math.ceil(race.countdown)}…`;
  } else {
    const place = ['1st', '2nd', '3rd'][race.position - 1] ?? `${race.position}th`;
    race.label = `Marina Mile · gate ${Math.min(race.cpIndex + 1, CHECKPOINTS.length)}/${CHECKPOINTS.length} · ${place} · ${clock} — ${cp.label}`;
  }
}

function releaseRivals(game) {
  for (const car of game.race.rivals) {
    if (car.driver === 'rival') car.driver = null;
    if (car.kind === 'race') car.kind = 'traffic';
    car.axis = 'x';
    car.dir = 1;
    car.laneCenter = 1600;
  }
  game.race.rivals = [];
}

function endRace(game, finished) {
  const race = game.race;
  if (finished) {
    const prize = RACE_PRIZES[race.position - 1] ?? 0;
    if (race.position === 1) {
      game.player.cash += prize;
      game.stats.racesWon = (game.stats.racesWon ?? 0) + 1;
      addRep(game, 50);
      sfx.success();
      game.toast(`Marina Mile — FIRST. $${prize} and the boardwalk remembers`);
    } else if (race.position === 2) {
      game.player.cash += prize;
      addRep(game, 15);
      sfx.cash();
      game.toast(`Marina Mile — second. $${prize} for the effort`);
    } else {
      addRep(game, 5);
      sfx.fail();
      game.toast('Marina Mile — third. The Mile keeps your entry fee');
    }
  } else {
    sfx.fail();
    game.toast('Race abandoned — the Mile keeps your entry fee');
  }
  race.active = false;
  race.phase = 'idle';
  race.label = '';
  releaseRivals(game);
}

function rivalInput(game, car, dt) {
  const cp = CHECKPOINTS[Math.min(car.raceCp, CHECKPOINTS.length - 1)];
  const input = { throttle: 0, steer: 0, handbrake: false };
  if (game.race.phase === 'countdown') return input;
  const desired = Math.atan2(cp.y - car.y, cp.x - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.steer = clamp(diff * 2.6, -1, 1);
  const speed = speedOf(car);
  if (car.raceReverse > 0) {
    car.raceReverse -= dt;
    input.throttle = -0.9;
    input.steer = clamp(-diff * 2.6, -1, 1);
    return input;
  }
  input.throttle = 1;
  if (Math.abs(diff) > 2.2 && speed > 130) input.throttle = -0.5;
  if (speed < 26) {
    car.raceStuck += dt;
    if (car.raceStuck > 1.8) {
      car.raceStuck = 0;
      car.raceReverse = 0.7;
    }
  } else {
    car.raceStuck = 0;
  }
  if (distance(car.x, car.y, cp.x, cp.y) < 95 && car.raceCp < CHECKPOINTS.length) {
    car.raceCp += 1;
  }
  return input;
}

export function updateRace(game, dt) {
  const race = game.race;
  if (!race || !race.active) return;
  const player = game.player;

  if (!player.car) {
    race.footTimer += dt;
    if (race.footTimer > 8) {
      endRace(game, false);
      return;
    }
  } else {
    race.footTimer = 0;
    if (player.car.wrecked) {
      endRace(game, false);
      return;
    }
  }

  if (race.phase === 'countdown') {
    race.countdown -= dt;
    if (race.countdown <= 0) {
      race.phase = 'running';
      sfx.pickup();
      game.toast('GO!');
    }
  } else {
    race.timer += dt;
  }

  for (const car of race.rivals) {
    if (car.wrecked) continue;
    stepCar(game, car, dt, rivalInput(game, car, dt));
  }

  // Running order: checkpoints cleared first, then closeness to the next gate.
  const mine = progressOf(player.car ?? player, race.cpIndex);
  let ahead = 0;
  for (const car of race.rivals) {
    if (!car.wrecked && progressOf(car, car.raceCp) > mine) ahead += 1;
  }
  race.position = ahead + 1;

  if (race.phase === 'running' && player.car) {
    const cp = CHECKPOINTS[race.cpIndex];
    if (cp && distance(player.car.x, player.car.y, cp.x, cp.y) < 95) {
      race.cpIndex += 1;
      if (race.cpIndex >= CHECKPOINTS.length) {
        endRace(game, true);
        return;
      }
      sfx.pickup();
      game.toast(`Gate ${race.cpIndex} of ${CHECKPOINTS.length} — ${CHECKPOINTS[race.cpIndex].label}`);
    }
  }
  syncRaceObjective(game);
}
