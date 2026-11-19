// police.js — the law in Port Solano: the wanted ladder, who counts as a witness,
// the Interceptors that hunt the player, the officers who chase on foot and shoot
// at high heat, and the bust meter that ends a chase badly. Crime is only crime
// when somebody sees it — a cop in sight, or a bystander close enough to call it
// in to a cop nearby.

import { TUNING, WORLD } from '../core/config.js';
import { clamp, distance } from '../core/random.js';
import { carHitsBuilding, isRoadPoint, lineBlocked, slideMove } from '../world/world.js';
import { createVehicle, forwardSpeed, speedOf, stepCar } from '../vehicles/vehicles.js';
import { createPed } from '../people/people.js';

const CRIME_POINTS = {
  stealCar: 22,
  hitPed: 16,
  killPed: 46,
  assault: 14,
  crash: 8,
  hitPoliceCar: 26,
  shotFired: 12,
  killCop: 70,
  missionHeat: 30,
};

const STAR_THRESHOLDS = [1, 25, 50, 90, 140];

export function createPoliceSystem() {
  return {
    points: 0,
    stars: 0,
    unseenTimer: 0,
    bustMeter: 0,
    lockedStars: 0, // a mission can hold the heat at a floor (the finale)
    spawnTimer: 0,
    roadblockTimer: 0,
    heli: null,

    reportCrime(game, kind, x, y) {
      const gained = CRIME_POINTS[kind] ?? 8;
      const againstPolice = kind === 'hitPoliceCar' || kind === 'killCop';
      let witnessed = againstPolice;
      if (!witnessed) {
        for (const unit of policeUnits(game)) {
          if (distance(unit.x, unit.y, x, y) < 540 && !lineBlocked(game.world, unit.x, unit.y, x, y)) {
            witnessed = true;
            break;
          }
        }
      }
      if (!witnessed) {
        // A bystander calls it in only if an officer is near enough to matter.
        let bystander = false;
        for (const ped of game.peds) {
          if (!ped.isCop && !ped.inCar && ped.state !== 'down' && distance(ped.x, ped.y, x, y) < 230) {
            bystander = true;
            break;
          }
        }
        if (bystander) {
          for (const unit of policeUnits(game)) {
            if (distance(unit.x, unit.y, x, y) < 880) { witnessed = true; break; }
          }
        }
      }
      if (!witnessed) return false;
      this.points += gained;
      this.refreshStars();
      return true;
    },

    refreshStars() {
      let stars = 0;
      for (const threshold of STAR_THRESHOLDS) if (this.points >= threshold) stars += 1;
      this.stars = Math.max(stars, this.lockedStars);
    },

    clear() {
      this.points = 0;
      this.lockedStars = 0;
      this.stars = 0;
      this.bustMeter = 0;
      this.unseenTimer = 0;
      this.roadblockTimer = 0;
      this.heli = null;
    },

    update(game, dt, rng) {
      const player = game.player;
      const focus = player.car ?? player;
      // Does any unit have eyes on the player right now?
      let seen = false;
      for (const unit of policeUnits(game)) {
        if (distance(unit.x, unit.y, focus.x, focus.y) < 480 && !lineBlocked(game.world, unit.x, unit.y, focus.x, focus.y)) {
          seen = true;
          break;
        }
      }
      if (!seen && this.heli && distance(this.heli.x, this.heli.y, focus.x, focus.y) < 640) seen = true;
      if (seen) this.unseenTimer = 0;
      else this.unseenTimer += dt;
      if (this.unseenTimer > TUNING.wantedDecaySeconds && this.points > 0 && this.lockedStars === 0) {
        this.points = Math.max(0, this.points - dt * 5);
        this.refreshStars();
      }
      if (this.stars === 0 && this.lockedStars === 0) this.points = 0;

      this.maintainUnits(game, dt, rng);
      this.updateUnits(game, dt, rng);
      this.updateBust(game, dt);
      this.updateRoadblocks(game, dt, rng);
      this.updateHelicopter(game, dt, rng);
    },

    maintainUnits(game, dt, rng) {
      this.spawnTimer -= dt;
      const wanted = TUNING.maxPoliceByStars[this.stars] ?? 0;
      const cars = game.vehicles.filter((v) => v.kind === 'police' && !v.roadblock);
      // Retire units that are far away when the heat is gone or low.
      for (const car of [...cars]) {
        const d = distance(car.x, car.y, game.player.x, game.player.y);
        if ((this.stars === 0 && d > 500) || d > 2100) {
          game.vehicles.splice(game.vehicles.indexOf(car), 1);
          if (car.driver && car.driver !== 'player') {
            const ped = car.driver;
            const at = game.peds.indexOf(ped);
            if (at >= 0) game.peds.splice(at, 1);
          }
        }
      }
      if (cars.length < wanted && this.spawnTimer <= 0) {
        this.spawnTimer = 1.6;
        this.spawnCar(game, rng);
      }
    },

    spawnCar(game, rng) {
      const player = game.player;
      for (let tries = 0; tries < 10; tries += 1) {
        const cx = WORLD.roadCenters[Math.floor(rng() * WORLD.roadCenters.length)];
        const cy = WORLD.roadCenters[Math.floor(rng() * WORLD.roadCenters.length)];
        const onX = rng() < 0.5;
        const x = onX ? cx + (rng() < 0.5 ? -820 : 820) : cx;
        const y = onX ? cy : cy + (rng() < 0.5 ? -820 : 820);
        if (x < 60 || y < 60 || x > WORLD.width - 60 || y > WORLD.height - 60) continue;
        if (distance(x, y, player.x, player.y) < 640) continue;
        const car = createVehicle('police', x, y, Math.atan2(player.y - y, player.x - x), 'police', rng);
        const cop = createPed(x, y, rng, true);
        cop.inCar = car;
        cop.state = 'driver';
        car.driver = cop;
        game.peds.push(cop);
        game.vehicles.push(car);
        return;
      }
    },

    updateUnits(game, dt, rng) {
      const player = game.player;
      const focus = player.car ?? player;
      for (const car of game.vehicles) {
        if (car.kind !== 'police') continue;
        if (car.wrecked) continue;
        if (car.driver === 'player') continue;
        const d = distance(car.x, car.y, focus.x, focus.y);
        if (!player.car && d < 110 && this.stars > 0) {
          // The officer gets out and comes for the player on foot.
          const cop = car.driver;
          if (cop && cop !== 'player') {
            car.driver = null;
            cop.inCar = null;
            cop.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
            cop.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
            cop.state = 'chase';
          }
          continue;
        }
        if (car.roadblock) {
          // A roadblock car holds its ground; its driver stays seated with it.
          if (car.driver && car.driver !== 'player') {
            car.driver.x = car.x;
            car.driver.y = car.y;
          }
          continue;
        }
        // Pursuit: aim at where the player will be, harder as the stars climb.
        const lead = clamp(d / 300, 0, 0.55) * (this.stars >= 3 ? 1 : 0.6);
        const tx = focus.x + (focus.vx ?? 0) * lead;
        const ty = focus.y + (focus.vy ?? 0) * lead;
        const desired = Math.atan2(ty - car.y, tx - car.x);
        let diff = desired - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const input = { throttle: 0, steer: clamp(diff * 2.6, -1, 1), handbrake: false };
        const fwd = forwardSpeed(car);
        const playerSpeed = player.car ? speedOf(player.car) : 0;
        if (d > 60) input.throttle = 1;
        else if (fwd > playerSpeed + 30) input.throttle = -0.7;
        if (Math.abs(diff) > 2.4 && d < 200) input.throttle = -0.8; // reverse to re-aim
        stepCar(game, car, dt, input);
        if (car.driver && car.driver !== 'player') {
          car.driver.x = car.x;
          car.driver.y = car.y;
        }
      }
      // Officers on foot.
      for (const cop of game.peds) {
        if (!cop.isCop || cop.inCar || cop.state === 'down') continue;
        if (cop.state !== 'chase') cop.state = 'chase';
        const d = distance(cop.x, cop.y, player.x, player.y);
        if (player.car && d > 480) {
          // The player drove off; the officer gives up and the car pool replaces him.
          game.peds.splice(game.peds.indexOf(cop), 1);
          continue;
        }
        if (d > 30) {
          const step = 172 * dt;
          const away = Math.atan2(player.y - cop.y, player.x - cop.x);
          cop.angle = away;
          slideMove(game.world, cop, Math.cos(away) * step, Math.sin(away) * step, 9);
          cop.walkPhase += dt * 9;
        }
        if (this.stars >= 3 && !player.car && d > 90 && d < 300 && !lineBlocked(game.world, cop.x, cop.y, player.x, player.y)) {
          cop.shootCooldown -= dt;
          if (cop.shootCooldown <= 0) {
            cop.shootCooldown = randRange(rng, 0.8, 1.5);
            game.combat.copShoot(game, cop, rng);
          }
        }
      }
    },

    updateBust(game, dt) {
      const player = game.player;
      if (this.stars === 0 || game.state !== 'play') {
        this.bustMeter = Math.max(0, this.bustMeter - dt * 0.8);
        return;
      }
      let pressure = false;
      const playerSpeed = player.car ? speedOf(player.car) : Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      if (playerSpeed < 46) {
        for (const unit of policeUnits(game)) {
          const reach = unit.spec ? TUNING.bustRadius + 26 : TUNING.bustRadius;
          if (distance(unit.x, unit.y, player.x, player.y) < reach) { pressure = true; break; }
        }
      }
      if (pressure) {
        this.bustMeter += dt / TUNING.bustFillSeconds;
        if (this.bustMeter >= 1) {
          this.bustMeter = 0;
          game.triggerBusted();
        }
      } else {
        this.bustMeter = Math.max(0, this.bustMeter - dt * 0.55);
      }
    },

    updateRoadblocks(game, dt, rng) {
      this.roadblockTimer -= dt;
      let blocks = game.vehicles.filter((v) => v.roadblock && !v.wrecked);
      // If the player has taken a roadblock car, it stops being a roadblock.
      blocks = blocks.filter((car) => {
        if (car.driver === 'player') {
          car.roadblock = false;
          return false;
        }
        return true;
      });
      const removeBlock = (car) => {
        const carAt = game.vehicles.indexOf(car);
        if (carAt >= 0) game.vehicles.splice(carAt, 1);
        if (car.driver && car.driver !== 'player') {
          const pedAt = game.peds.indexOf(car.driver);
          if (pedAt >= 0) game.peds.splice(pedAt, 1);
        }
      };
      if (this.stars < 3) {
        for (const car of [...blocks]) removeBlock(car);
        return;
      }
      const player = game.player;
      for (const car of [...blocks]) {
        if (distance(car.x, car.y, player.x, player.y) > 1100) {
          removeBlock(car);
          blocks.splice(blocks.indexOf(car), 1);
        }
      }
      if (blocks.length === 0 && player.car && this.roadblockTimer <= 0) {
        this.roadblockTimer = this.spawnRoadblock(game, rng) ? 16 : 4;
      }
    },

    spawnRoadblock(game, rng) {
      const player = game.player;
      if (!player.car) return false;
      const heading = player.car.angle;
      const ahead = {
        x: player.x + Math.cos(heading) * 760,
        y: player.y + Math.sin(heading) * 760,
      };
      let ncx = WORLD.roadCenters[0];
      let ncy = WORLD.roadCenters[0];
      for (const c of WORLD.roadCenters) {
        if (Math.abs(c - ahead.x) < Math.abs(ncx - ahead.x)) ncx = c;
        if (Math.abs(c - ahead.y) < Math.abs(ncy - ahead.y)) ncy = c;
      }
      let spots;
      if (Math.abs(ahead.x - ncx) <= Math.abs(ahead.y - ncy)) {
        spots = [
          { x: ncx - 38, y: ahead.y },
          { x: ncx + 38, y: ahead.y },
        ];
      } else {
        spots = [
          { x: ahead.x, y: ncy - 38 },
          { x: ahead.x, y: ncy + 38 },
        ];
      }
      const placed = spots.map((spot) => ({
        x: spot.x,
        y: spot.y,
        angle: Math.atan2(player.y - spot.y, player.x - spot.x),
      }));
      // Validate both spots before spawning either one.
      for (const spot of placed) {
        if (!(spot.x > 80 && spot.x < WORLD.width - 80)) return false;
        if (!(spot.y > 80 && spot.y < WORLD.height - 80)) return false;
        if (!(spot.x < WORLD.beachX - 40)) return false;
        if (!isRoadPoint(spot.x, spot.y)) return false;
        if (carHitsBuilding(game.world, spot.x, spot.y, spot.angle, 38, 18)) return false;
      }
      for (const spot of placed) {
        const car = createVehicle('police', spot.x, spot.y, spot.angle, 'police', rng);
        car.roadblock = true;
        const cop = createPed(spot.x, spot.y, rng, true);
        cop.inCar = car;
        cop.state = 'driver';
        car.driver = cop;
        game.peds.push(cop);
        game.vehicles.push(car);
      }
      game.toast('Roadblock ahead!');
      return true;
    },

    updateHelicopter(game, dt, rng) {
      const player = game.player;
      const focus = player.car ?? player;
      if (this.stars >= 4) {
        if (!this.heli) {
          const a = rng() * Math.PI * 2;
          this.heli = {
            x: focus.x + Math.cos(a) * 980,
            y: focus.y + Math.sin(a) * 980,
            angle: a,
            orbit: rng() * Math.PI * 2,
          };
          game.toast('SPD helicopter overhead — its light is on you');
        }
        const heli = this.heli;
        heli.orbit += dt * 0.25;
        const tx = focus.x + Math.cos(heli.orbit) * 120 + (focus.vx ?? 0) * 0.45;
        const ty = focus.y + Math.sin(heli.orbit) * 120 + (focus.vy ?? 0) * 0.45;
        const dx = tx - heli.x;
        const dy = ty - heli.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          const step = Math.min(dist, 430 * dt);
          heli.x += (dx / dist) * step;
          heli.y += (dy / dist) * step;
          heli.angle = Math.atan2(dy, dx);
        }
      } else if (this.heli) {
        const heli = this.heli;
        const dx = -300 - heli.x;
        const dy = -300 - heli.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          const step = Math.min(dist, 470 * dt);
          heli.x += (dx / dist) * step;
          heli.y += (dy / dist) * step;
          heli.angle = Math.atan2(dy, dx);
        }
        if (heli.x < 0 || heli.x > WORLD.width || heli.y < 0 || heli.y > WORLD.height
          || distance(heli.x, heli.y, player.x, player.y) > 1500) {
          this.heli = null;
        }
      }
    },
  };
}

export function policeUnits(game) {
  const units = [];
  for (const car of game.vehicles) if (car.kind === 'police' && !car.wrecked) units.push(car);
  for (const ped of game.peds) if (ped.isCop && !ped.inCar && ped.state !== 'down') units.push(ped);
  return units;
}

export function nearestPoliceDistance(game) {
  let best = Infinity;
  for (const unit of policeUnits(game)) {
    best = Math.min(best, distance(unit.x, unit.y, game.player.x, game.player.y));
  }
  return best;
}
