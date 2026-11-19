// weapons.js (systems/) — Mari's arsenal: six weapons with distinct stats, an
// owned set she collects across the story and Anchor Arms' counter, per-type
// ammunition, and the selection the HUD's weapon wheel drives. Combat resolves
// the shots; this file owns what she holds, what it costs and what it eats.

import { sfx } from '../audio/audio.js';
import { distance } from '../core/random.js';
import { PLACES } from '../world/world.js';

export const WEAPONS = {
  fists: {
    id: 'fists', name: 'Fists', kind: 'melee',
    damage: 34, range: 46, rate: 0.34, knock: 10, price: 0,
  },
  pipe: {
    id: 'pipe', name: 'Lead Pipe', kind: 'melee',
    damage: 58, range: 56, rate: 0.44, knock: 22, price: 120,
  },
  pistol: {
    id: 'pistol', name: 'Anchor 9mm', kind: 'gun', ammoType: 'pistol',
    damage: 34, range: 560, rate: 0.24, pellets: 1, spread: 0.012, price: 0,
  },
  smg: {
    id: 'smg', name: 'Vesper SMG', kind: 'gun', ammoType: 'smg',
    damage: 15, range: 470, rate: 0.09, pellets: 1, spread: 0.055, price: 450,
  },
  shotgun: {
    id: 'shotgun', name: 'Breaker 12', kind: 'gun', ammoType: 'shotgun',
    damage: 13, range: 300, rate: 0.85, pellets: 5, spread: 0.17, price: 650,
  },
  rifle: {
    id: 'rifle', name: 'Kestrel AR', kind: 'gun', ammoType: 'rifle',
    damage: 62, range: 780, rate: 0.5, pellets: 1, spread: 0.006, price: 900,
  },
};

export const WEAPON_ORDER = ['fists', 'pipe', 'pistol', 'smg', 'shotgun', 'rifle'];

// What Anchor Arms sells over the counter, per ammunition type.
export const AMMO_PACKS = {
  pistol: { amount: 18, price: 40, label: '9mm rounds' },
  smg: { amount: 40, price: 55, label: 'SMG rounds' },
  shotgun: { amount: 10, price: 50, label: '12-gauge shells' },
  rifle: { amount: 24, price: 60, label: 'AR rounds' },
};

export function createArsenal() {
  return {
    current: 'fists',
    owned: ['fists'],
    ammo: { pistol: 0, smg: 0, shotgun: 0, rifle: 0 },
  };
}

export function ensureArsenal(player) {
  if (!player.arsenal) {
    // A save from before the arsenal existed: rebuild it from the old fields.
    player.arsenal = createArsenal();
    if (player.hasPistol) {
      player.arsenal.owned.push('pistol');
      player.arsenal.current = 'pistol';
      player.arsenal.ammo.pistol = player.ammo ?? 0;
    }
  }
  return player.arsenal;
}

export function currentWeapon(player) {
  const arsenal = ensureArsenal(player);
  return WEAPONS[arsenal.current] ?? WEAPONS.fists;
}

export function ownsWeapon(player, id) {
  return ensureArsenal(player).owned.includes(id);
}

export function grantWeapon(game, id) {
  const player = game.player;
  const arsenal = ensureArsenal(player);
  if (arsenal.owned.includes(id)) return false;
  arsenal.owned.push(id);
  if (id === 'pistol') player.hasPistol = true;
  game.toast(`${WEAPONS[id].name} — yours now. Tab opens the wheel, Q swaps`);
  sfx.pickup();
  return true;
}

export function selectWeapon(game, id) {
  const player = game.player;
  const arsenal = ensureArsenal(player);
  if (!arsenal.owned.includes(id)) return false;
  arsenal.current = id;
  player.hasPistol = arsenal.owned.includes('pistol');
  sfx.click();
  game.toast(WEAPONS[id].name);
  return true;
}

export function cycleWeapon(game, dir = 1) {
  const arsenal = ensureArsenal(game.player);
  const owned = WEAPON_ORDER.filter((id) => arsenal.owned.includes(id));
  if (owned.length < 2) return;
  const at = owned.indexOf(arsenal.current);
  const next = owned[(at + dir + owned.length) % owned.length];
  selectWeapon(game, next);
}

export function addAmmo(game, type, amount) {
  const arsenal = ensureArsenal(game.player);
  arsenal.ammo[type] = (arsenal.ammo[type] ?? 0) + amount;
  if (type === 'pistol') game.player.ammo = arsenal.ammo.pistol;
}

export function ammoOf(player, spec) {
  if (spec.kind !== 'gun') return Infinity;
  return ensureArsenal(player).ammo[spec.ammoType] ?? 0;
}

// The ammunition deal Anchor Arms offers right now: for the gun in her hands,
// or the pistol if she is holding a melee weapon.
export function ammoDeal(game) {
  const player = game.player;
  const arsenal = ensureArsenal(player);
  const spec = currentWeapon(player);
  let type = null;
  if (spec.kind === 'gun') type = spec.ammoType;
  else if (arsenal.owned.includes('pistol')) type = 'pistol';
  if (!type) return null;
  const pack = AMMO_PACKS[type];
  return { type, ...pack };
}

export function nearGunStore(game) {
  const player = game.player;
  return !player.car
    && distance(player.x, player.y, PLACES.gunStore.x, PLACES.gunStore.y) < 46;
}

// The next weapon on Anchor Arms' rack that Mari does not own yet.
export function nextWeaponForSale(game) {
  const arsenal = ensureArsenal(game.player);
  for (const id of WEAPON_ORDER) {
    if (id === 'fists') continue;
    if (!arsenal.owned.includes(id) && WEAPONS[id].price > 0) return WEAPONS[id];
  }
  return null;
}

export function buyNextWeapon(game) {
  const spec = nextWeaponForSale(game);
  if (!spec) {
    game.toast('Anchor Arms: the rack is empty — you own it all');
    return;
  }
  if (game.player.cash < spec.price) {
    game.toast(`${spec.name} — $${spec.price}. You are short.`);
    sfx.fail();
    return;
  }
  game.player.cash -= spec.price;
  sfx.cash();
  grantWeapon(game, spec.id);
  if (spec.kind === 'gun') addAmmo(game, spec.ammoType, AMMO_PACKS[spec.ammoType].amount);
}
