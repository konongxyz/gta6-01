// shots.js — staged scenes for the entry's screenshots. The kit's own shots.json
// pattern: open the game with ?shot=<name>&seed=<n> and it sets up a real, playable
// scene from the game's own systems — the same cars, police, HUD and missions a
// player gets — frozen at a photogenic moment. Nothing here draws anything itself;
// it only places the pieces, and the normal loop renders them.

import { PLACES } from './world.js';
import { createVehicle } from './vehicles.js';
import { createPed } from './people.js';
import { STORY } from './missions.js';

export function stageShot(game, name) {
  const rng = game.rng;
  game.state = 'play';
  game.vehicles.length = 0;
  game.peds.length = 0;
  game.toasts.length = 0;
  const player = game.player;

  const putCar = (type, x, y, angle, kind = 'traffic') => {
    const car = createVehicle(type, x, y, angle, kind, rng);
    game.vehicles.push(car);
    return car;
  };
  const putPed = (x, y, isCop = false) => {
    const ped = createPed(x, y, rng, isCop);
    game.peds.push(ped);
    return ped;
  };
  const putCopCar = (x, y, angle) => {
    const car = putCar('police', x, y, angle, 'police');
    const cop = putPed(x, y, true);
    cop.inCar = car;
    cop.state = 'driver';
    car.driver = cop;
    return car;
  };

  if (name === 'cover') {
    // The cover: a three-star chase down the coastal avenue, a delivery on the
    // clock, the minimap lit with police — the whole game in one frame.
    game.clockMinutes = 16 * 60 + 24;
    const car = putCar('sport', 2880, 1560, Math.PI / 2, 'traffic');
    car.color = '#d94f3d';
    player.car = car;
    car.driver = 'player';
    player.x = car.x;
    player.y = car.y;
    car.vx = 0;
    car.vy = 250;
    putCopCar(2880, 1330, Math.PI / 2);
    putCopCar(2810, 1180, Math.PI / 2 + 0.14);
    putCopCar(2960, 1420, Math.PI / 2 - 0.1);
    putCar('sedan', 2796, 1980, Math.PI / 2);
    putCar('taxi', 2964, 2090, -Math.PI / 2);
    putCar('coupe', 2880, 760, Math.PI / 2);
    for (let i = 0; i < 7; i += 1) putPed(2985 + (i % 3) * 26, 1450 + i * 90);
    for (let i = 0; i < 4; i += 1) putPed(2780, 1750 + i * 110);
    game.police.points = 62;
    game.police.refreshStars();
    player.cash = 1240;
    game.missions.index = 3;
    game.missions.active = { def: STORY[3], stepIndex: 1, timerLeft: 231, targetCar: null, passenger: null };
    game.toast('Drop 1 of 3 — the heat is watching');
  } else if (name === 'onfoot') {
    // Downtown on foot: Mari in the crowd, Dex on the phone, the next job marked.
    game.clockMinutes = 11 * 60 + 5;
    player.x = 1560;
    player.y = 1748;
    player.angle = 0.4;
    player.hasPistol = true;
    player.ammo = 18;
    player.cash = 640;
    for (let i = 0; i < 9; i += 1) putPed(1470 + (i % 3) * 90, 1660 + Math.floor(i / 3) * 110);
    putCar('sedan', 1600, 1560, 0);
    putCar('hatch', 1450, 1684, Math.PI);
    putCar('truck', 2240, 1830, Math.PI / 2);
    game.missions.index = 1;
    game.dialogue = {
      lines: [['Dex', 'The gold Aurelia GT is sitting in the Azahar lot, Mari. Tito wants it tonight — and tonight I mean before the owner finishes dinner.']],
      at: 0,
      lineAt: -10,
      onDone: () => {},
    };
  } else if (name === 'mission') {
    // A fare on the clock: passenger aboard, destination marked, city rolling by.
    game.clockMinutes = 14 * 60 + 42;
    const car = putCar('taxi', 1180, 990, 0, 'traffic');
    player.car = car;
    car.driver = 'player';
    player.x = car.x;
    player.y = car.y;
    car.vx = 210;
    car.vy = 0;
    const passenger = putPed(car.x, car.y);
    passenger.inCar = car;
    passenger.state = 'passenger';
    game.missions.fare = {
      ped: passenger, phase: 'drive',
      destX: PLACES.hotelLot.x, destY: PLACES.hotelLot.y,
      fare: 86, elapsed: 34, par: 96,
    };
    putCar('sedan', 1600, 876, 0);
    putCar('van', 960, 1150, Math.PI / 2);
    putCar('coupe', 1980, 1044, Math.PI);
    for (let i = 0; i < 6; i += 1) putPed(1330 + i * 70, 1090 + (i % 2) * 130);
    player.cash = 890;
    game.toast('Fare aboard — the Azahar Hotel, and step on it');
  } else if (name === 'chase') {
    // Five stars at dusk: the intersection is full of Interceptors and Mari's
    // coupe is still rolling — for now. The bust meter says otherwise.
    game.clockMinutes = 18 * 60 + 38;
    const car = putCar('coupe', 1600, 1620, 0.5, 'traffic');
    car.color = '#4bcffa';
    car.health = 58;
    player.car = car;
    car.driver = 'player';
    player.x = car.x;
    player.y = car.y;
    car.vx = 130;
    car.vy = 60;
    putCopCar(1600, 1330, Math.PI / 2);
    putCopCar(1790, 1560, 2.6);
    putCopCar(1660, 1830, -1.2);
    putCopCar(1330, 1605, 0);
    const cop = putPed(1705, 1700, true);
    cop.state = 'chase';
    for (let i = 0; i < 5; i += 1) {
      const ped = putPed(1500 + i * 55, 1900 + (i % 2) * 60);
      ped.state = 'flee';
      ped.threatX = car.x;
      ped.threatY = car.y;
    }
    game.police.points = 165;
    game.police.refreshStars();
    game.police.bustMeter = 0.42;
    player.cash = 1730;
    game.effects.push({ kind: 'smoke', x: car.x - 20, y: car.y - 10, ttl: 0.8, max: 0.8, rise: -16 });
  }
  game.camera.x = player.x;
  game.camera.y = player.y;
}
