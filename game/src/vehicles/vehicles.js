// vehicles.js — every car in Port Solano: the arcade driving model (throttle,
// steering, handbrake drift, damage), the traffic that follows the road grid in
// right-hand lanes and turns at intersections, parked cars, and the collisions
// between cars, buildings and people. Police driving lives in police.js but uses
// the same stepCar physics from here.

import { VEHICLE_TYPES, CAR_COLORS, WORLD, TUNING } from '../core/config.js';
import { clamp, distance, pick, randRange } from '../core/random.js';
import { carHitsBuilding } from '../world/world.js';
import { sfx } from '../audio/audio.js';

let nextVehicleId = 1;

export function createVehicle(type, x, y, angle, kind, rng) {
  const spec = VEHICLE_TYPES[type];
  return {
    id: nextVehicleId += 1,
    type, kind, spec,
    x, y, angle,
    vx: 0, vy: 0,
    steer: 0,
    throttle: 0,
    color: kind === 'police' ? '#eef1f4' : pick(rng, CAR_COLORS),
    health: spec.health,
    maxHealth: spec.health,
    driver: null, // a ped, the string 'player', or null when parked
    wrecked: false,
    // traffic route state
    axis: 'x', dir: 1, laneCenter: 0, cruise: randRange(rng, 168, 226),
    stuckTimer: 0, honkTimer: 0,
    smokeTimer: 0,
    missionMark: null,
  };
}

export function speedOf(car) {
  return Math.sqrt(car.vx * car.vx + car.vy * car.vy);
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

// One physics step. input = {throttle -1..1, steer -1..1, handbrake bool}.
export function stepCar(game, car, dt, input) {
  const spec = car.spec;
  const fwd = forwardSpeed(car);
  // A garage tune (systems/garage.js) stretches the spec it was paid for.
  const tuneMul = car.tune ? 1 + car.tune.engine * 0.09 : 1;
  const maxFwd = spec.topSpeed * tuneMul * (car.health < 25 ? 0.55 : 1);
  const maxRev = -spec.topSpeed * 0.32;

  if (input.throttle > 0 && fwd < maxFwd) {
    const force = spec.accel * tuneMul * input.throttle * (1 - Math.max(0, fwd) / (maxFwd * 1.25));
    car.vx += Math.cos(car.angle) * force * dt;
    car.vy += Math.sin(car.angle) * force * dt;
  } else if (input.throttle < 0) {
    if (fwd > 12) {
      // braking
      car.vx -= Math.cos(car.angle) * spec.accel * 1.5 * dt;
      car.vy -= Math.sin(car.angle) * spec.accel * 1.5 * dt;
    } else if (fwd > maxRev) {
      car.vx += Math.cos(car.angle) * spec.accel * 0.55 * input.throttle * dt;
      car.vy += Math.sin(car.angle) * spec.accel * 0.55 * input.throttle * dt;
    }
  }

  // Rolling drag and air drag.
  const drag = input.handbrake ? 1.6 : 0.55;
  car.vx -= car.vx * drag * dt * 0.55;
  car.vy -= car.vy * drag * dt * 0.55;

  // Steering: turns the nose; the velocity follows through the tyres' grip, and a
  // handbrake cuts that grip so the car slides.
  const steerAuthority = clamp(Math.abs(fwd) / 120, 0, 1) * (fwd < 0 ? -1 : 1);
  car.angle += input.steer * spec.grip * 0.42 * steerAuthority * dt * (input.handbrake ? 1.25 : 1);
  const grip = input.handbrake ? 2.1 : 9.5;
  const hx = Math.cos(car.angle);
  const hy = Math.sin(car.angle);
  const along = car.vx * hx + car.vy * hy;
  const sideX = car.vx - along * hx;
  const sideY = car.vy - along * hy;
  const keep = Math.exp(-grip * dt);
  car.vx -= sideX * (1 - keep);
  car.vy -= sideY * (1 - keep);

  // Surface: sand slows everything down.
  const surface = game.world && car.x > WORLD.beachX ? 0.45 : 0;
  if (surface) {
    car.vx -= car.vx * surface * dt;
    car.vy -= car.vy * surface * dt;
  }

  const nx = car.x + car.vx * dt;
  const ny = car.y + car.vy * dt;
  const halfL = spec.length / 2;
  const halfW = spec.width / 2;
  if (!carHitsBuilding(game.world, nx, ny, car.angle, halfL, halfW)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Hit something solid: crunch, bounce a little, take damage by impact speed.
    const impact = speedOf(car);
    if (impact > 90) {
      damageCar(game, car, (impact - 80) * 0.16, 'wall');
      if (car.driver === 'player' || game.player.car === car) sfx.crash(clamp(impact / 420, 0.2, 1));
      game.effects.push({ kind: 'spark', x: car.x + hx * halfL, y: car.y + hy * halfL, ttl: 0.25, max: 0.25 });
    }
    car.vx *= -0.22;
    car.vy *= -0.22;
    // Try sliding along the wall on each axis.
    if (!carHitsBuilding(game.world, nx, car.y, car.angle, halfL, halfW)) car.x = nx;
    else if (!carHitsBuilding(game.world, car.x, ny, car.angle, halfL, halfW)) car.y = ny;
  }

  if (car.health < 45 && car.health > 0) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.09;
      game.effects.push({ kind: 'smoke', x: car.x + hx * halfL * 0.7, y: car.y + hy * halfL * 0.7, ttl: 0.8, max: 0.8, rise: -14 });
    }
  }
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    game.effects.push({ kind: 'smoke', x: car.x, y: car.y, ttl: 1.6, max: 1.6, rise: -22 });
  }
}

export function damageCar(game, car, amount, cause) {
  if (car.wrecked) return;
  // Armour plating (systems/garage.js) eats a share of every hit.
  if (car.tune) amount *= 1 - car.tune.armour * 0.18;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    if (car.driver && car.driver !== 'player') {
      // The driver bails out of a dead car and becomes a pedestrian again.
      const ped = car.driver;
      car.driver = null;
      ped.inCar = null;
      ped.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      ped.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      ped.state = 'flee';
      ped.threatX = car.x;
      ped.threatY = car.y;
    }
    if (game.player.car === car) {
      // The player is never trapped in a wreck; they climb out scorched.
      game.player.car = null;
      game.player.x = car.x + 30;
      game.player.y = car.y + 10;
    }
  }
}

// Car against car: circles at the bumpers. Pushes both apart and trades momentum;
// a hard enough hit damages both and, if the player caused it, the law notices.
export function collideCars(game, dt) {
  const cars = game.vehicles;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = (a.spec.length + b.spec.length) * 0.32;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const rel = Math.abs((a.vx - b.vx) * ux + (a.vy - b.vy) * uy);
      const exchange = 0.4;
      a.vx -= ux * rel * exchange;
      a.vy -= uy * rel * exchange;
      b.vx += ux * rel * exchange;
      b.vy += uy * rel * exchange;
      if (rel > 130) {
        damageCar(game, a, rel * 0.05, 'car');
        damageCar(game, b, rel * 0.05, 'car');
        if (a.driver === 'player' || b.driver === 'player') {
          sfx.crash(clamp(rel / 380, 0.2, 1));
          const other = a.driver === 'player' ? b : a;
          if (other.kind === 'police') game.police.reportCrime(game, 'hitPoliceCar', other.x, other.y);
          else game.police.reportCrime(game, 'crash', other.x, other.y);
        }
      }
    }
  }
}

// Traffic: follow the lane, slow for whatever is ahead, turn at some intersections.
export function trafficInput(game, car, dt, rng) {
  const input = { throttle: 0, steer: 0, handbrake: false };
  if (car.wrecked) return input;
  const centers = WORLD.roadCenters;
  // The car's lane: on its axis road, offset to the right of its direction.
  const laneOffset = WORLD.roadHalfWidth * 0.45;
  let targetX;
  let targetY;
  if (car.axis === 'x') {
    targetY = car.laneCenter + (car.dir > 0 ? laneOffset : -laneOffset);
    targetX = car.x + car.dir * 220;
    // Near an intersection, maybe turn onto the crossing avenue.
    for (const c of centers) {
      if (Math.abs(car.x - c) < 26 && Math.abs(car.y - car.laneCenter) < WORLD.roadHalfWidth) {
        if (rng() < 0.012) {
          car.axis = 'y';
          car.laneCenter = c;
          car.dir = rng() < 0.5 ? 1 : -1;
        }
        break;
      }
    }
    if (car.x > WORLD.beachX - 60 && car.dir > 0) { car.dir = -1; }
    if (car.x < 60 && car.dir < 0) { car.dir = 1; }
  } else {
    targetX = car.laneCenter + (car.dir > 0 ? -laneOffset : laneOffset);
    targetY = car.y + car.dir * 220;
    for (const c of centers) {
      if (Math.abs(car.y - c) < 26 && Math.abs(car.x - car.laneCenter) < WORLD.roadHalfWidth) {
        if (rng() < 0.012) {
          car.axis = 'x';
          car.laneCenter = c;
          car.dir = rng() < 0.5 ? 1 : -1;
        }
        break;
      }
    }
    if (car.y > WORLD.height - 80 && car.dir > 0) { car.dir = -1; }
    if (car.y < 60 && car.dir < 0) { car.dir = 1; }
  }

  const desired = Math.atan2(targetY - car.y, targetX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.steer = clamp(diff * 2.4, -1, 1);

  // Something ahead? A car, the player on foot, a pedestrian: slow or stop.
  const ahead = 108;
  const fx = car.x + Math.cos(car.angle) * ahead;
  const fy = car.y + Math.sin(car.angle) * ahead;
  let blocked = false;
  for (const other of game.vehicles) {
    if (other === car) continue;
    if (distance(fx, fy, other.x, other.y) < 52) { blocked = true; break; }
  }
  if (!blocked && game.player.car !== car) {
    if (distance(fx, fy, game.player.x, game.player.y) < 40) blocked = true;
  }
  if (!blocked) {
    for (const ped of game.peds) {
      if (ped.inCar || ped.state === 'down') continue;
      if (distance(fx, fy, ped.x, ped.y) < 38) { blocked = true; break; }
    }
  }

  const fwd = forwardSpeed(car);
  if (blocked) {
    input.throttle = fwd > 8 ? -1 : 0;
    car.stuckTimer += dt;
    if (car.stuckTimer > 2.6 && car.honkTimer <= 0) {
      car.honkTimer = 3;
      if (distance(car.x, car.y, game.player.x, game.player.y) < 380) sfx.horn();
    }
  } else {
    car.stuckTimer = 0;
    input.throttle = fwd < car.cruise ? 0.75 : 0;
    if (fwd > car.cruise * 1.25) input.throttle = -0.6;
  }
  car.honkTimer -= dt;
  return input;
}

// Running people over is the darkest part of the physics: a car moving fast enough
// knocks a pedestrian down; the law hears about it from anyone who saw it.
export function collideCarsWithPeople(game) {
  for (const car of game.vehicles) {
    const speed = speedOf(car);
    if (speed < 40) continue;
    const targets = [...game.peds];
    if (!game.player.car) targets.push(game.player);
    for (const person of targets) {
      if (person.inCar || person.state === 'down') continue;
      const rr = car.spec.length * 0.42 + 12;
      if (distance(car.x, car.y, person.x, person.y) > rr) continue;
      const fromPlayer = car.driver === 'player' || game.player.car === car;
      if (person === game.player) {
        if (!fromPlayer) {
          game.combat.damagePlayer(game, speed * 0.06, 'run over');
          game.player.x += car.vx * 0.04;
          game.player.y += car.vy * 0.04;
        }
        continue;
      }
      person.health -= speed * 0.24;
      person.state = person.health <= 0 ? 'down' : 'flee';
      person.threatX = car.x;
      person.threatY = car.y;
      person.x += car.vx * 0.05;
      person.y += car.vy * 0.05;
      if (fromPlayer) {
        game.police.reportCrime(game, person.health <= 0 ? 'killPed' : 'hitPed', person.x, person.y);
        sfx.crash(0.3);
      }
    }
  }
}

export function spawnTraffic(game, rng) {
  const types = ['sedan', 'hatch', 'coupe', 'taxi', 'truck', 'van', 'sedan', 'hatch'];
  const cars = [];
  for (let i = 0; i < TUNING.trafficCars; i += 1) {
    const onX = rng() < 0.5;
    const center = pick(rng, WORLD.roadCenters);
    const along = randRange(rng, 200, WORLD.width - 400);
    const dir = rng() < 0.5 ? 1 : -1;
    const laneOffset = WORLD.roadHalfWidth * 0.45;
    const x = onX ? along : center + (dir > 0 ? -laneOffset : laneOffset);
    const y = onX ? center + (dir > 0 ? laneOffset : -laneOffset) : along;
    if (distance(x, y, game.player.x, game.player.y) < 420) continue;
    const car = createVehicle(pick(rng, types), x, y, onX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'traffic', rng);
    car.axis = onX ? 'x' : 'y';
    car.dir = dir;
    car.laneCenter = center;
    cars.push(car);
  }
  for (const spot of game.world.parkingSpots) {
    if (cars.length >= TUNING.trafficCars + TUNING.parkedCars) break;
    if (rng() < 0.42) continue;
    if (distance(spot.x, spot.y, game.player.x, game.player.y) < 200) continue;
    const car = createVehicle(pick(rng, types), spot.x, spot.y, spot.angle, 'parked', rng);
    cars.push(car);
  }
  return cars;
}
