// garage.js (systems/) — Tito's Auto Works, the working kind: engine tunes and
// armour plating in two stages each, full repairs, and resprays that make the
// SPD's description of your car worthless. Everything applies to the car Mari is
// sitting in, paid from her wallet, and the menu the HUD draws is driven by the
// service table below.

import { CAR_COLORS } from '../core/config.js';
import { distance, pick } from '../core/random.js';
import { sfx } from '../audio/audio.js';
import { PLACES } from '../world/world.js';

export const GARAGE_SERVICES = [
  {
    id: 'engine', name: 'Engine tune', max: 2, costs: [300, 650],
    blurb: '+9% top speed and punch per stage',
  },
  {
    id: 'armour', name: 'Armour plating', max: 2, costs: [350, 700],
    blurb: '−18% damage taken per stage, +40 body per stage',
  },
  {
    id: 'repair', name: 'Full repair', max: 0, costs: [120],
    blurb: 'Every dent out, back to full health',
  },
  {
    id: 'respray', name: 'Respray', max: 0, costs: [150],
    blurb: 'A new colour — and the SPD loses your description',
  },
];

export function carTune(car) {
  if (!car.tune) car.tune = { engine: 0, armour: 0 };
  return car.tune;
}

export function nearGarage(game) {
  const player = game.player;
  return !!player.car
    && distance(player.x, player.y, PLACES.garage.x, PLACES.garage.y) < 130;
}

export function serviceState(game, service) {
  const car = game.player.car;
  if (!car) return { label: 'No car', enabled: false };
  const tune = carTune(car);
  if (service.id === 'engine' || service.id === 'armour') {
    const stage = tune[service.id];
    if (stage >= service.max) return { label: 'MAX', enabled: false, stage };
    const cost = service.costs[stage];
    return { label: `$${cost}`, enabled: game.player.cash >= cost, stage, cost };
  }
  if (service.id === 'repair') {
    if (car.health >= car.maxHealth) return { label: 'Mint', enabled: false };
    const cost = service.costs[0];
    return { label: `$${cost}`, enabled: game.player.cash >= cost, cost };
  }
  const cost = service.costs[0];
  return { label: `$${cost}`, enabled: game.player.cash >= cost, cost };
}

export function buyService(game, id) {
  const car = game.player.car;
  if (!car) return;
  const service = GARAGE_SERVICES.find((s) => s.id === id);
  if (!service) return;
  const state = serviceState(game, service);
  if (!state.enabled) {
    sfx.fail();
    if (state.cost !== undefined && game.player.cash < state.cost) game.toast('Not enough cash, Mari');
    return;
  }
  const tune = carTune(car);
  game.player.cash -= state.cost;
  if (id === 'engine') {
    tune.engine += 1;
    game.toast(`Engine tune stage ${tune.engine} — she pulls harder now`);
  } else if (id === 'armour') {
    tune.armour += 1;
    car.maxHealth += 40;
    car.health = Math.min(car.maxHealth, car.health + 40);
    game.toast(`Armour stage ${tune.armour} — the panels shrug off hits`);
  } else if (id === 'repair') {
    car.health = car.maxHealth;
    car.wrecked = false;
    game.toast('Good as new — Tito signs his work');
  } else if (id === 'respray') {
    let color = pick(game.rng, CAR_COLORS);
    if (color === car.color) color = CAR_COLORS[(CAR_COLORS.indexOf(color) + 3) % CAR_COLORS.length];
    car.color = color;
    if (game.police.lockedStars === 0) {
      game.police.points = 0;
      game.police.refreshStars();
    }
    game.toast('New colour, new car — as far as the SPD knows');
  }
  sfx.cash();
}
