// people.js — the pedestrians of Port Solano and the player character. Peds stroll
// the sidewalks and the boardwalk, run from danger, and a few fight back; a driver
// pulled from his car becomes a ped again mid-scene. The player, Mari Voss, is the
// same kind of body with a wallet, a gun (once the story gives her one) and a name.

import { TUNING, WORLD } from './config.js';
import { clamp, distance, pick, randRange } from './random.js';
import { isRoadPoint, slideMove } from './world.js';
import { sfx } from './audio.js';

const SHIRTS = ['#e15f78', '#4bcffa', '#f2b134', '#58b368', '#e8e4da', '#a55eea', '#fd9644', '#25c2a0'];
const PANTS = ['#2f3542', '#57606f', '#747d8c', '#3b3b98', '#82589f', '#2e5e4e'];

let nextPedId = 1;

export function createPed(x, y, rng, isCop = false) {
  return {
    id: nextPedId += 1,
    x, y,
    angle: randRange(rng, 0, Math.PI * 2),
    speed: 0,
    health: isCop ? 70 : 40,
    maxHealth: isCop ? 70 : 40,
    isCop,
    state: 'walk', // walk | flee | fight | down | passenger | waiting
    targetX: x, targetY: y,
    retargetTimer: randRange(rng, 0, 4),
    shirt: isCop ? '#274b73' : pick(rng, SHIRTS),
    pants: isCop ? '#1d2f47' : pick(rng, PANTS),
    skin: pick(rng, ['#f2c79b', '#c68863', '#8d5524', '#ffdbac', '#6b4423']),
    inCar: null,
    threatX: 0, threatY: 0,
    attackCooldown: 0,
    shootCooldown: randRange(rng, 0.4, 1.4),
    walkPhase: randRange(rng, 0, 6),
    fareMark: false,
  };
}

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    radius: TUNING.playerRadius,
    health: 100,
    maxHealth: 100,
    cash: 120,
    car: null, // the vehicle being driven, or null on foot
    hasPistol: false,
    ammo: 0,
    walkPhase: 0,
    punchTimer: 0,
    fireTimer: 0,
    hurtTimer: 0,
    name: 'Mari Voss',
  };
}

function pickWalkTarget(game, ped, rng) {
  // Stroll along the sidewalks: choose a point near a road's edge, or along the
  // beach promenade, biased to stay within a few blocks of where the ped lives.
  for (let tries = 0; tries < 8; tries += 1) {
    const alongRoad = rng() < 0.8;
    let tx;
    let ty;
    if (alongRoad) {
      const center = pick(rng, WORLD.roadCenters);
      const along = clamp(ped.x + randRange(rng, -700, 700), 40, WORLD.width - 40);
      const side = rng() < 0.5 ? -1 : 1;
      if (rng() < 0.5) {
        tx = along;
        ty = center + side * (WORLD.roadHalfWidth + 16);
      } else {
        tx = center + side * (WORLD.roadHalfWidth + 16);
        ty = along;
      }
    } else {
      tx = WORLD.beachX + randRange(rng, 30, 200);
      ty = clamp(ped.y + randRange(rng, -600, 600), 40, WORLD.height - 40);
    }
    if (distance(ped.x, ped.y, tx, ty) > 60) {
      ped.targetX = tx;
      ped.targetY = ty;
      return;
    }
  }
}

export function updatePed(game, ped, dt, rng) {
  if (ped.state === 'down') return;
  if (ped.inCar) {
    // A rider is glued to the passenger side of their car.
    const car = ped.inCar;
    ped.x = car.x + Math.cos(car.angle + Math.PI / 2) * 12;
    ped.y = car.y + Math.sin(car.angle + Math.PI / 2) * 12;
    ped.angle = car.angle;
    return;
  }
  ped.attackCooldown -= dt;
  ped.retargetTimer -= dt;
  const player = game.player;
  const playerDist = distance(ped.x, ped.y, player.x, player.y);

  if (ped.state === 'walk') {
    if (ped.retargetTimer <= 0 || distance(ped.x, ped.y, ped.targetX, ped.targetY) < 16) {
      ped.retargetTimer = randRange(rng, 3, 7);
      pickWalkTarget(game, ped, rng);
    }
    moveToward(game, ped, ped.targetX, ped.targetY, 62, dt);
  } else if (ped.state === 'flee') {
    const away = Math.atan2(ped.y - ped.threatY, ped.x - ped.threatX);
    const tx = ped.x + Math.cos(away) * 240;
    const ty = ped.y + Math.sin(away) * 240;
    moveToward(game, ped, tx, ty, 178, dt);
    if (playerDist > 340 && distance(ped.x, ped.y, ped.threatX, ped.threatY) > 320) {
      ped.state = 'walk';
      ped.retargetTimer = 0;
    }
  } else if (ped.state === 'fight') {
    if (player.car || playerDist > 420 || game.state !== 'play') {
      ped.state = 'flee';
      ped.threatX = player.x;
      ped.threatY = player.y;
      return;
    }
    if (playerDist > 26) {
      moveToward(game, ped, player.x, player.y, 148, dt);
    } else {
      ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
      if (ped.attackCooldown <= 0) {
        ped.attackCooldown = randRange(rng, 0.7, 1.2);
        game.combat.damagePlayer(game, ped.isCop ? 9 : 6, 'a punch');
        sfx.punch();
      }
    }
  }
  ped.walkPhase += dt * (ped.speed > 4 ? 9 : 2);
}

function moveToward(game, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 4) {
    ped.speed = 0;
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = speed;
  // On a road, hurry: nobody strolls across traffic.
  const step = (isRoadPoint(ped.x, ped.y) ? speed * 1.5 : speed) * dt;
  slideMove(game.world, ped, (dx / d) * step, (dy / d) * step, 10);
}

export function spawnPeds(game, rng) {
  const peds = [];
  for (let i = 0; i < TUNING.pedestrians; i += 1) {
    // Cluster around the lively districts: downtown, the boardwalk, the marina.
    const hubs = [
      { x: 1600, y: 1600, r: 800 }, { x: 3150, y: 1900, r: 500 },
      { x: 3050, y: 2900, r: 600 }, { x: 900, y: 900, r: 700 },
      { x: 2300, y: 2300, r: 800 },
    ];
    const hub = pick(rng, hubs);
    let x = hub.x + randRange(rng, -hub.r, hub.r);
    let y = hub.y + randRange(rng, -hub.r, hub.r);
    x = clamp(x, 40, WORLD.beachX + 160);
    y = clamp(y, 40, WORLD.height - 40);
    if (distance(x, y, game.player.x, game.player.y) < 120) continue;
    peds.push(createPed(x, y, rng));
  }
  return peds;
}

// A crowd refresh: keep the streets alive near the player by teleporting the
// farthest strolling peds to sidewalks a few blocks away, out of sight.
export function recyclePeds(game, rng) {
  for (const ped of game.peds) {
    if (ped.isCop || ped.inCar || ped.state === 'down' || ped.fareMark) continue;
    if (distance(ped.x, ped.y, game.player.x, game.player.y) < 1500) continue;
    const center = pick(rng, WORLD.roadCenters);
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) {
      ped.x = clamp(game.player.x + randRange(rng, -1000, 1000), 40, WORLD.width - 40);
      ped.y = center + side * (WORLD.roadHalfWidth + 16);
    } else {
      ped.x = center + side * (WORLD.roadHalfWidth + 16);
      ped.y = clamp(game.player.y + randRange(rng, -1000, 1000), 40, WORLD.height - 40);
    }
    ped.state = 'walk';
    ped.health = ped.maxHealth;
    ped.retargetTimer = 0;
  }
}
