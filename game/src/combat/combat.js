// combat.js — Mari's arsenal at work: the player's attacks with whatever weapon
// is in her hands (systems/weapons.js owns the stats), hitscan shots with
// tracers, the damage people and the player take, and officers returning fire.
// Everything violent in the game is resolved here so the wanted system hears
// about each act exactly once.

import { clamp, distance } from '../core/random.js';
import { buildingAt } from '../world/world.js';
import { damageCar } from '../vehicles/vehicles.js';
import { sfx } from '../audio/audio.js';
import { ammoOf, currentWeapon, ensureArsenal } from '../systems/weapons.js';

const SHOT_RANGE = 560;

export function createCombat() {
  return {
    // The player swings or shoots toward the aim point (world coordinates),
    // with the weapon the wheel last put in her hands.
    playerAttack(game, aimX, aimY) {
      const player = game.player;
      if (player.car) return;
      player.angle = Math.atan2(aimY - player.y, aimX - player.x);
      const spec = currentWeapon(player);
      if (spec.kind === 'gun') {
        if (player.fireTimer > 0) return;
        if (ammoOf(player, spec) <= 0) {
          player.fireTimer = 0.3;
          sfx.dryFire();
          game.toast(`${spec.name} is empty — Q swaps weapon, Anchor Arms sells rounds`);
          return;
        }
        player.fireTimer = spec.rate;
        ensureArsenal(player).ammo[spec.ammoType] -= 1;
        if (spec.ammoType === 'pistol') player.ammo = ensureArsenal(player).ammo.pistol;
        game.stats.shotsFired += 1;
        sfx.shot();
        for (let pellet = 0; pellet < spec.pellets; pellet += 1) {
          const spreadAngle = player.angle + (game.rng() * 2 - 1) * spec.spread;
          this.fireHitscan(game, player.x, player.y, spreadAngle, true, spec.damage, spec.range);
        }
        game.police.reportCrime(game, 'shotFired', player.x, player.y);
      } else {
        if (player.punchTimer > 0) return;
        player.punchTimer = spec.rate;
        sfx.swing();
        // A swing lands on the nearest person inside the arc and the range.
        let best = null;
        let bestDist = spec.range;
        for (const ped of game.peds) {
          if (ped.inCar || ped.state === 'down') continue;
          const d = distance(player.x, player.y, ped.x, ped.y);
          if (d > bestDist) continue;
          const ang = Math.atan2(ped.y - player.y, ped.x - player.x);
          let diff = Math.abs(ang - player.angle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < 1.1) { best = ped; bestDist = d; }
        }
        if (best) {
          sfx.punch();
          this.damagePed(game, best, spec.damage, true);
          best.x += Math.cos(player.angle) * spec.knock;
          best.y += Math.sin(player.angle) * spec.knock;
        }
      }
    },

    // One hitscan round from (x, y) along angle. People first, then cars, then the
    // wall that stops the tracer. byPlayer marks whose crime it is.
    fireHitscan(game, x, y, angle, byPlayer, damage = 34, range = SHOT_RANGE) {
      let endX = x + Math.cos(angle) * range;
      let endY = y + Math.sin(angle) * range;
      let hitDist = range;
      let hitPed = null;
      let hitCar = null;
      for (const ped of game.peds) {
        if (ped.inCar || ped.state === 'down') continue;
        const t = rayCircle(x, y, angle, ped.x, ped.y, 13, range);
        if (t !== null && t < hitDist) { hitDist = t; hitPed = ped; hitCar = null; }
      }
      if (!game.player.car && !byPlayer) {
        const t = rayCircle(x, y, angle, game.player.x, game.player.y, 13, range);
        if (t !== null && t < hitDist) { hitDist = t; hitPed = null; hitCar = null; hitDist = t; endX = game.player.x; endY = game.player.y; }
      }
      for (const car of game.vehicles) {
        if (car.driver === 'player') continue;
        const t = rayCircle(x, y, angle, car.x, car.y, car.spec.length * 0.46, range);
        if (t !== null && t < hitDist) { hitDist = t; hitCar = car; hitPed = null; }
      }
      // Buildings stop the round early.
      for (let d = 24; d < hitDist; d += 24) {
        const px = x + Math.cos(angle) * d;
        const py = y + Math.sin(angle) * d;
        if (buildingAt(game.world, px, py, 0)) { hitDist = d; hitPed = null; hitCar = null; break; }
      }
      endX = x + Math.cos(angle) * hitDist;
      endY = y + Math.sin(angle) * hitDist;
      game.effects.push({ kind: 'tracer', x1: x, y1: y, x2: endX, y2: endY, ttl: 0.07, max: 0.07 });
      game.effects.push({ kind: 'spark', x: endX, y: endY, ttl: 0.16, max: 0.16 });
      if (hitPed) this.damagePed(game, hitPed, damage, byPlayer);
      else if (hitCar) {
        damageCar(game, hitCar, 9, 'shot');
        if (hitCar.driver && hitCar.driver !== 'player' && hitCar.kind !== 'police') {
          hitCar.driver.state = 'flee';
        }
      }
    },

    damagePed(game, ped, amount, byPlayer) {
      if (ped.state === 'down') return;
      ped.health -= amount;
      if (ped.health <= 0) {
        ped.health = 0;
        ped.state = 'down';
        if (ped.inCar) {
          ped.inCar.driver = null;
          ped.inCar = null;
        }
        if (byPlayer) {
          game.police.reportCrime(game, ped.isCop ? 'killCop' : 'killPed', ped.x, ped.y);
          if (ped.isCop) game.toast('Officer down — the heat jumps');
        }
        if (ped.isCop && !ped.inCar) {
          // A downed officer drops ammunition Mari can use.
          game.drops.push({ kind: 'ammo', x: ped.x + 14, y: ped.y, amount: 6, ttl: 45 });
        }
        return;
      }
      if (byPlayer) {
        game.police.reportCrime(game, 'assault', ped.x, ped.y);
        // Civilians mostly run; a stubborn few swing back. Officers always engage.
        if (ped.isCop) ped.state = 'chase';
        else if (game.rng() < 0.3) ped.state = 'fight';
        else {
          ped.state = 'flee';
          ped.threatX = game.player.x;
          ped.threatY = game.player.y;
        }
      }
    },

    damagePlayer(game, amount, cause) {
      const player = game.player;
      if (game.state !== 'play') return;
      if (player.car) {
        // Shots and blows land on the car first; the driver feels a share.
        damageCar(game, player.car, amount * 0.8, 'attack');
        player.health -= amount * 0.25;
      } else {
        player.health -= amount;
      }
      player.hurtTimer = 0.35;
      if (player.health <= 0) {
        player.health = 0;
        game.triggerWasted(cause);
      }
    },

    // An officer fires at the player: accuracy falls with distance, and a shot at a
    // moving car mostly finds the car.
    copShoot(game, cop, rng) {
      const player = game.player;
      const target = player.car ?? player;
      const d = distance(cop.x, cop.y, target.x, target.y);
      const angle = Math.atan2(target.y - cop.y, target.x - cop.x);
      sfx.shot();
      const hitChance = clamp(0.62 - d / 620, 0.12, 0.55);
      if (rng() < hitChance) {
        game.effects.push({ kind: 'tracer', x1: cop.x, y1: cop.y, x2: target.x, y2: target.y, ttl: 0.07, max: 0.07 });
        this.damagePlayer(game, 5 + rng() * 6, 'shot by the SPD');
      } else {
        const missX = target.x + (rng() - 0.5) * 130;
        const missY = target.y + (rng() - 0.5) * 130;
        game.effects.push({ kind: 'tracer', x1: cop.x, y1: cop.y, x2: missX, y2: missY, ttl: 0.07, max: 0.07 });
        game.effects.push({ kind: 'spark', x: missX, y: missY, ttl: 0.14, max: 0.14 });
      }
    },
  };
}

function rayCircle(x, y, angle, cx, cy, radius, range = SHOT_RANGE) {
  const dx = cx - x;
  const dy = cy - y;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (along < 0 || along > range) return null;
  const side = -dx * Math.sin(angle) + dy * Math.cos(angle);
  if (Math.abs(side) > radius) return null;
  return along;
}
