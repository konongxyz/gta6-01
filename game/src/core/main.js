// main.js — Solano Heat's conductor: it builds the city and the cast, runs the
// loop, moves Mari on foot and behind the wheel, answers the mouse on every menu,
// and decides what happens when the law wins or the hospital does. Every other
// file owns one system; this one owns the whole and wires them together.

import { TUNING, WORLD } from './config.js';
import { makeRng, clamp, distance } from './random.js';
import { attachInput, endFrameInput, keys, mouse, moveAxis, pressed } from './input.js';
import { initAudio, setEngine, setSiren, sfx, toggleMute, updateMusic } from '../audio/audio.js';
import { buildWorld, slideMove, PLACES } from '../world/world.js';
import { createPlayer, spawnPeds, updatePed, recyclePeds } from '../people/people.js';
import { createPoliceSystem, nearestPoliceDistance } from '../police/police.js';
import { createCombat } from '../combat/combat.js';
import { createMissionSystem, STORY } from '../missions/missions.js';
import { collideCars, collideCarsWithPeople, spawnTraffic, speedOf, stepCar, trafficInput } from '../vehicles/vehicles.js';
import { drawScene } from '../world/render.js';
import { drawEndScreen, drawHUD, drawPause, drawTitle, wheelSlotAt } from '../ui/hud.js';
import { clearSave, freshStats, loadSave, storeSave } from './save.js';
import { stageShot, stageShowcase } from '../showcase/scenes.js';
import { WEAPON_ORDER, ammoDeal, buyNextWeapon, cycleWeapon, ensureArsenal, nearGunStore, nextWeaponForSale, selectWeapon } from '../systems/weapons.js';
import { createRadio, cycleStation, updateRadio } from '../systems/radio.js';
import { buyService, nearGarage } from '../systems/garage.js';
import { RACE_ENTRY, createRace, raceStartAvailable, startRace, updateRace } from '../systems/race.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();
attachInput(canvas);

const game = {
  state: 'title',
  time: 0,
  clockMinutes: TUNING.startMinute,
  world: null,
  player: null,
  vehicles: [],
  peds: [],
  drops: [],
  effects: [],
  toasts: [],
  police: createPoliceSystem(),
  combat: createCombat(),
  missions: createMissionSystem(),
  camera: { x: 0, y: 0, zoom: 1 },
  rng: makeRng((Date.now() % 2147483647) + 7),
  stats: freshStats(),
  dialogue: null,
  prompt: '',
  uiButtons: [],
  mouse,
  pressed,
  hasSave: false,
  showHelp: false,
  lastFine: 0,
  wastedCause: '',
  saveTimer: 0,
  wheelOpen: false,
  garageOpen: false,
  showcase: false,
  radio: createRadio(),
  race: createRace(),

  toast(text) {
    this.toasts.push({ text, ttl: 3.6 });
    if (this.toasts.length > 3) this.toasts.shift();
    if (statusLine) statusLine.textContent = text;
  },

  screenToWorld(sx, sy) {
    return {
      x: (sx - canvas.width / 2) / this.camera.zoom + this.camera.x,
      y: (sy - canvas.height / 2) / this.camera.zoom + this.camera.y,
    };
  },

  triggerBusted() {
    if (this.state !== 'play') return;
    const fine = Math.min(this.player.cash, 60 + this.police.stars * 45);
    this.lastFine = fine;
    this.player.cash -= fine;
    this.stats.timesBusted += 1;
    sfx.busted();
    this.releasePlayer(PLACES.police, 80);
    this.state = 'busted';
  },

  triggerWasted(cause) {
    if (this.state !== 'play') return;
    this.wastedCause = cause;
    const fine = Math.min(this.player.cash, 90);
    this.lastFine = fine;
    this.player.cash -= fine;
    this.stats.timesWasted += 1;
    sfx.fail();
    this.releasePlayer(PLACES.hospital, 60);
    this.state = 'wasted';
  },

  // Shared by the cell and the hospital: Mari walks out poorer, the heat is gone,
  // the job she was on is blown, and the law's cars go back to their patrols.
  releasePlayer(place, health) {
    if (this.player.car) {
      this.player.car.driver = null;
      this.player.car = null;
    }
    this.player.x = place.x;
    this.player.y = place.y + 26;
    this.player.health = health;
    this.player.vx = 0;
    this.player.vy = 0;
    if (this.missions.active) this.missions.fail(this, 'it ended in handcuffs and paperwork');
    this.missions.fare = null;
    this.police.clear();
    for (const car of [...this.vehicles]) {
      if (car.kind === 'police') this.vehicles.splice(this.vehicles.indexOf(car), 1);
    }
    for (const ped of [...this.peds]) {
      if (ped.isCop) this.peds.splice(this.peds.indexOf(ped), 1);
    }
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    storeSave(this);
  },

  triggerStoryComplete() {
    this.state = 'complete';
  },
};

function initRun(save) {
  game.world = buildWorld();
  game.player = createPlayer(PLACES.start.x, PLACES.start.y);
  game.missions = createMissionSystem();
  game.police = createPoliceSystem();
  game.stats = freshStats();
  game.vehicles = [];
  game.peds = [];
  game.drops = [];
  game.effects = [];
  game.toasts = [];
  game.dialogue = null;
  game.wheelOpen = false;
  game.garageOpen = false;
  game.showcase = false;
  game.race = createRace();
  game.clockMinutes = TUNING.startMinute;
  game.vehicles = spawnTraffic(game, game.rng);
  game.peds = spawnPeds(game, game.rng);
  if (save) {
    game.player.cash = save.cash;
    game.player.hasPistol = !!save.hasPistol;
    game.player.ammo = save.ammo ?? 0;
    game.player.rep = save.rep ?? 0;
    if (save.arsenal) game.player.arsenal = save.arsenal;
    ensureArsenal(game.player);
    game.player.health = clamp(save.health ?? 100, 20, 100);
    game.player.x = save.x ?? PLACES.start.x;
    game.player.y = save.y ?? PLACES.start.y;
    game.missions.index = clamp(save.missionIndex ?? 0, 0, STORY.length);
    game.missions.storyDone = !!save.storyDone;
    if (game.missions.index >= STORY.length) game.missions.storyDone = true;
    game.stats = { ...freshStats(), ...(save.stats ?? {}) };
    for (const pack of game.world.packages) {
      if ((save.packages ?? []).includes(pack.id)) pack.taken = true;
    }
    game.toast('Welcome back to Port Solano');
  } else {
    game.toast('Port Solano — find Dex at the Marina Café');
  }
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.camera.zoom = 1;
}

// ---- Per-frame updates --------------------------------------------------------

function updatePlayer(dt) {
  const player = game.player;
  player.punchTimer -= dt;
  player.fireTimer -= dt;
  player.hurtTimer -= dt;

  // The weapon wheel freezes the street while Mari chooses.
  if (pressed.has('Tab')) {
    game.wheelOpen = !game.wheelOpen;
    return;
  }
  if (game.wheelOpen) {
    for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
      if (pressed.has(`Digit${i + 1}`) && selectWeapon(game, WEAPON_ORDER[i])) {
        game.wheelOpen = false;
        return;
      }
    }
    if (mouse.clicked) {
      const slot = wheelSlotAt(mouse.x - canvas.width / 2, mouse.y - canvas.height / 2);
      if (slot >= 0 && selectWeapon(game, WEAPON_ORDER[slot])) game.wheelOpen = false;
    }
    return;
  }
  if (pressed.has('KeyQ')) cycleWeapon(game);

  if (player.car) {
    const car = player.car;
    const input = { throttle: 0, steer: 0, handbrake: keys.has('Space') };
    if (keys.has('KeyW') || keys.has('ArrowUp')) input.throttle += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) input.throttle -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) input.steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) input.steer += 1;
    stepCar(game, car, dt, input);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    game.stats.distanceDriven += speedOf(car) * dt;
    setEngine(true, clamp(speedOf(car) / car.spec.topSpeed, 0, 1), car.health < 30);
    if (pressed.has('KeyR')) cycleStation(game);
    if (pressed.has('KeyE')) {
      if (speedOf(car) < 95) exitCar();
      else game.toast('Too fast to bail out');
    }
    return;
  }

  setEngine(false);
  const axis = moveAxis();
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = running ? TUNING.playerRunSpeed : TUNING.playerWalkSpeed;
  const moving = axis.x !== 0 || axis.y !== 0;
  if (moving) {
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
    const dx = (axis.x / len) * speed * dt;
    const dy = (axis.y / len) * speed * dt;
    player.vx = dx / dt;
    player.vy = dy / dt;
    const before = { x: player.x, y: player.y };
    slideMove(game.world, player, dx, dy, player.radius);
    player.angle = Math.atan2(dy, dx);
    player.walkPhase += dt * (running ? 13 : 9);
    game.stats.distanceWalked += distance(before.x, before.y, player.x, player.y);
  } else {
    player.vx = 0;
    player.vy = 0;
  }

  if (pressed.has('KeyE')) {
    const car = nearestEnterableCar();
    if (car) enterCar(car);
  }
  if (pressed.has('KeyB') && nearGunStore(game)) buyNextWeapon(game);
  if (mouse.clicked || mouse.down || pressed.has('KeyF')) {
    const aim = game.screenToWorld(mouse.x, mouse.y);
    game.combat.playerAttack(game, aim.x, aim.y);
  }
}

function nearestEnterableCar() {
  const player = game.player;
  let best = null;
  let bestDist = TUNING.enterCarRange;
  for (const car of game.vehicles) {
    if (car.wrecked || car.driver === 'player') continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

function enterCar(car) {
  const player = game.player;
  const wasOccupied = car.driver && car.driver !== 'player';
  if (car.driver && car.driver !== 'player') {
    const ped = car.driver;
    ped.inCar = null;
    ped.x = car.x - Math.cos(car.angle + Math.PI / 2) * 26;
    ped.y = car.y - Math.sin(car.angle + Math.PI / 2) * 26;
    ped.state = game.rng() < 0.32 ? 'fight' : 'flee';
    ped.threatX = player.x;
    ped.threatY = player.y;
  }
  car.driver = 'player';
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  game.stats.carsStolen += 1;
  game.police.reportCrime(game, 'stealCar', car.x, car.y);
  sfx.door();
  if (car.missionMark === 'steal') {
    // The missions module notices the theft itself; nothing more to do here.
  } else if (wasOccupied) {
    game.toast('Carjacked!');
  }
}

function exitCar() {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  player.car = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * (car.spec.width / 2 + 16);
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * (car.spec.width / 2 + 16);
  player.vx = 0;
  player.vy = 0;
  setEngine(false);
  sfx.door();
}

function updatePrompt() {
  const player = game.player;
  game.prompt = '';
  if (game.state !== 'play' || game.dialogue) return;
  if (player.car) {
    if (nearGarage(game)) {
      game.prompt = "G — Tito's Garage: tune, armour, respray";
      return;
    }
    if (raceStartAvailable(game)) {
      game.prompt = `G — The Marina Mile street race ($${RACE_ENTRY} entry)`;
      return;
    }
    if (speedOf(player.car) < 95) game.prompt = 'E — Get out';
    return;
  }
  const car = nearestEnterableCar();
  if (car) {
    game.prompt = car.driver ? `E — Pull the driver out of the ${car.spec.name}` : `E — Enter ${car.spec.name}`;
    return;
  }
  if (nearGunStore(game)) {
    const next = nextWeaponForSale(game);
    const deal = ammoDeal(game);
    if (next) game.prompt = `B — Buy the ${next.name} ($${next.price}) at Anchor Arms`;
    else if (deal) game.prompt = `E — Buy ${deal.amount} ${deal.label} ($${deal.price}) at Anchor Arms`;
  }
}

function updatePlay(dt) {
  game.clockMinutes = (game.clockMinutes + dt * (1440 / TUNING.dayLengthSeconds)) % 1440;
  if (game.garageOpen) {
    // Tito is talking; the street waits. G closes the menu, the buttons buy.
    if (pressed.has('KeyG')) game.garageOpen = false;
    return;
  }
  if (game.dialogue) {
    const dialogue = game.dialogue;
    if (pressed.has('KeyE') || pressed.has('Enter') || mouse.clicked) {
      const [, text] = dialogue.lines[dialogue.at];
      const shown = Math.floor((game.time - dialogue.lineAt) * 46);
      if (shown < text.length) {
        dialogue.lineAt = game.time - text.length / 46 - 0.01;
      } else {
        dialogue.at += 1;
        dialogue.lineAt = game.time;
        sfx.click();
        if (dialogue.at >= dialogue.lines.length) {
          const done = dialogue.onDone;
          game.dialogue = null;
          if (done) done();
        }
      }
    }
    return;
  }

  if (pressed.has('KeyG')) {
    if (nearGarage(game)) {
      game.garageOpen = true;
      sfx.click();
    } else if (raceStartAvailable(game)) {
      startRace(game);
    }
  }

  game.missions.update(game, dt);
  updatePlayer(dt);

  for (const car of game.vehicles) {
    if (car.kind === 'traffic' && car.driver !== 'player' && !car.wrecked) {
      if (distance(car.x, car.y, game.player.x, game.player.y) > 2400) continue;
      stepCar(game, car, dt, trafficInput(game, car, dt, game.rng));
    }
    if (car.driver && car.driver !== 'player' && car.kind === 'traffic') {
      car.driver.x = car.x;
      car.driver.y = car.y;
    }
  }
  collideCars(game, dt);
  collideCarsWithPeople(game);
  for (const ped of game.peds) updatePed(game, ped, dt, game.rng);
  game.police.update(game, dt, game.rng);
  updateRace(game, dt);
  updateRadio(game, dt);
  recyclePeds(game, game.rng);

  const nearest = nearestPoliceDistance(game);
  setSiren(nearest === Infinity ? 0 : clamp(1.1 - nearest / 700, 0, 1));
  updatePrompt();

  game.saveTimer -= dt;
  if (game.saveTimer <= 0) {
    game.saveTimer = 20;
    storeSave(game);
  }
}

function updateCamera(dt) {
  const focus = game.player.car ?? game.player;
  const lead = game.player.car ? 0.22 : 0;
  const tx = focus.x + (focus.vx ?? 0) * lead;
  const ty = focus.y + (focus.vy ?? 0) * lead;
  const k = 1 - Math.exp(-5.2 * dt);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  const speed = game.player.car ? speedOf(game.player.car) : 0;
  const targetZoom = game.player.car ? 1 - clamp(speed / 2600, 0, 0.2) : 1;
  game.camera.zoom += (targetZoom - game.camera.zoom) * (1 - Math.exp(-2.4 * dt));
  const viewW = canvas.width / game.camera.zoom;
  const viewH = canvas.height / game.camera.zoom;
  game.camera.x = clamp(game.camera.x, viewW / 2 - 200, WORLD.width - viewW / 2 + 200);
  game.camera.y = clamp(game.camera.y, viewH / 2 - 200, WORLD.height - viewH / 2 + 200);
}

function updateEffects(dt) {
  for (const effect of [...game.effects]) {
    effect.ttl -= dt;
    if (effect.ttl <= 0) game.effects.splice(game.effects.indexOf(effect), 1);
  }
  for (const toast of [...game.toasts]) {
    toast.ttl -= dt;
    if (toast.ttl <= 0) game.toasts.splice(game.toasts.indexOf(toast), 1);
  }
}

// ---- Menus and buttons ---------------------------------------------------------

function handleButtons() {
  if (!mouse.clicked) return;
  for (const button of game.uiButtons) {
    if (mouse.x >= button.x && mouse.x <= button.x + button.w && mouse.y >= button.y && mouse.y <= button.y + button.h) {
      sfx.click();
      onButton(button.id);
      return;
    }
  }
}

function onButton(id) {
  initAudio();
  if (id === 'new') {
    clearSave();
    game.hasSave = false;
    initRun(null);
    game.state = 'play';
  } else if (id === 'continue') {
    initRun(loadSave());
    game.state = 'play';
  } else if (id === 'help') {
    game.showHelp = !game.showHelp;
  } else if (id === 'resume') {
    game.state = 'play';
  } else if (id === 'restart') {
    clearSave();
    initRun(null);
    game.state = 'play';
  } else if (id === 'title') {
    storeSave(game);
    game.hasSave = true;
    game.state = 'title';
    setEngine(false);
    setSiren(0);
  } else if (id === 'again') {
    game.state = 'play';
  } else if (id === 'showcase') {
    initRun(null);
    stageShowcase(game);
    game.state = 'play';
  } else if (id.startsWith('garage:')) {
    const service = id.slice('garage:'.length);
    if (service === 'close') game.garageOpen = false;
    else buyService(game, service);
  }
}

// ---- Boot and the loop -----------------------------------------------------------

const params = new URLSearchParams(window.location.search);
game.hasSave = !!loadSave();
initRun(game.hasSave ? loadSave() : null);
if (params.get('shot')) {
  const seedParam = Number(params.get('seed'));
  if (Number.isFinite(seedParam) && seedParam > 0) game.rng = makeRng(seedParam);
  stageShot(game, params.get('shot'));
  game.state = 'play';
} else {
  game.state = 'title';
}

window.addEventListener('pointerdown', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

let lastStamp = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastStamp) / 1000;
  lastStamp = now;
  if (dt > 1 / 20) dt = 1 / 20;
  if (dt <= 0) return;
  game.time += dt;
  game.uiButtons = [];

  if (pressed.has('KeyM')) toggleMute();

  if (game.state === 'title') {
    updateMusic(dt, true);
    drawTitle(ctx, game);
    handleButtons();
  } else if (game.state === 'play') {
    if (pressed.has('Escape') || pressed.has('KeyP')) {
      game.state = 'pause';
      storeSave(game);
    } else {
      updatePlay(dt);
    }
    updateCamera(dt);
    updateEffects(dt);
    drawScene(ctx, game);
    drawHUD(ctx, game);
    if (game.garageOpen) handleButtons();
  } else if (game.state === 'pause') {
    drawScene(ctx, game);
    drawPause(ctx, game);
    handleButtons();
    if (pressed.has('Escape') || pressed.has('KeyP')) game.state = 'play';
  } else if (game.state === 'busted' || game.state === 'wasted' || game.state === 'complete') {
    setEngine(false);
    setSiren(0);
    updateCamera(dt);
    drawScene(ctx, game);
    drawEndScreen(ctx, game, game.state);
    handleButtons();
  }
  endFrameInput();
}
requestAnimationFrame(frame);
