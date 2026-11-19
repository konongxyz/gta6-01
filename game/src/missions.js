// missions.js — the story of Mari Voss in seven jobs, plus the repeatable work that
// keeps her fed between them: taxi-style courier fares, hidden cash packages and
// dropped pickups. A mission is a list of steps (reach a place, take a car, carry
// a passenger, beat a clock, outrun a locked wanted level); this file runs the
// steps, the dialogue that frames them, the timers that can fail them, and the
// objective marker the HUD points at.

import { PLACES } from './world.js';
import { distance } from './random.js';
import { createVehicle } from './vehicles.js';
import { createPed } from './people.js';
import { sfx } from './audio.js';
import { storeSave } from './save.js';

export const MISSION_STARTS = [
  PLACES.start, PLACES.garage, PLACES.boardwalk, PLACES.docks, PLACES.marina, PLACES.hotelLot, PLACES.warehouse,
];

export const STORY = [
  {
    title: 'New in Town',
    giver: 'Dex Marlowe',
    intro: [
      ['Dex', 'Mari Voss. You look just like your brother — broke and sunburned. Welcome to Port Solano.'],
      ['Mari', 'I need work, Dex. Real work, not dish shifts.'],
      ['Dex', 'Then listen. Tito at the Auto Works owes me a favour and I owe him a driver. Take any car, show your face at his garage, then run a package from the marina back here.'],
      ['Mari', 'And if the law notices me?'],
      ['Dex', 'Smile pretty and keep driving. Go.'],
    ],
    steps: [
      { type: 'getcar', label: 'Get into a car' },
      { type: 'goto', place: 'garage', label: "Drive to Tito's Auto Works" },
      { type: 'goto', place: 'marina', label: 'Pick up the package at the marina' },
      { type: 'goto', place: 'start', label: 'Deliver the package to the Marina Café', timer: 240 },
    ],
    reward: 250,
    outro: [
      ['Dex', 'Clean and quick. Tito says you can drive, too. There may be hope for you.'],
    ],
  },
  {
    title: 'Borrowed Horsepower',
    giver: 'Tito Ferreira',
    intro: [
      ['Tito', 'Dex says you are my new shadow. Good. See, a man at the Azahar Hotel parks a gold Aurelia GT like he owns the sun.'],
      ['Mari', 'He does own it, Tito.'],
      ['Tito', 'Details. My buyer pays tonight, cash. Lift the GT from the hotel lot and bring her to my garage. And Mari — take this. The lot has a guard with opinions.'],
      ['System', 'You received a pistol. Mouse aims, click or F fires. Anchor Arms sells ammunition.'],
    ],
    steps: [
      { type: 'steal', label: 'Steal the gold Aurelia GT from the Azahar Hotel lot' },
      { type: 'goto', place: 'garage', label: "Deliver the Aurelia GT to Tito's garage" },
    ],
    reward: 400,
    outro: [
      ['Tito', 'She purrs. The buyer purrs. Everybody purrs. Keep the pistol, you have earned it.'],
    ],
  },
  {
    title: 'The Star Passenger',
    giver: 'Luna Reyes',
    intro: [
      ['Luna', 'You are the driver? Good face. Honest hands. I finish my set at the Boardwalk Stage and then I need the airfield — fast, and nobody can know.'],
      ['Mari', 'Nobody can know, but there is a crowd of four hundred with phones.'],
      ['Luna', 'Then drive like the truth depends on it, driver.'],
    ],
    steps: [
      { type: 'pickup', place: 'boardwalk', label: 'Pick up Luna at the Boardwalk Stage (bring a car)' },
      { type: 'goto', place: 'airfield', label: 'Take Luna to Solano Airfield', timer: 300, heat: 2 },
    ],
    reward: 550,
    outro: [
      ['Luna', 'No photographs, no sirens in the papers. You are a ghost with a steering wheel. I like it.'],
    ],
  },
  {
    title: 'Three Drops',
    giver: 'Dex Marlowe',
    intro: [
      ['Dex', 'The docks loaded your ride with crates that ask no questions. Three drops: my warehouse, the downtown alley, the Azahar service yard.'],
      ['Mari', 'And the police ask questions, I suppose.'],
      ['Dex', 'Every drop gets warmer, Mari. That is the job. Six minutes, all three.'],
    ],
    steps: [
      { type: 'goto', place: 'docks', label: 'Load the crates at the South Docks', needCar: true, timer: 360 },
      { type: 'goto', place: 'warehouse', label: "Drop 1: Dex's Warehouse", heat: 18 },
      { type: 'goto', point: { x: 1750, y: 1290 }, label: 'Drop 2: the downtown alley', heat: 18 },
      { type: 'goto', point: { x: 3052, y: 1520 }, label: 'Drop 3: Azahar service yard', heat: 18 },
    ],
    reward: 800,
    outro: [
      ['Dex', 'Three for three, and the crates are already forgotten. You are becoming expensive, Mari.'],
    ],
  },
  {
    title: 'Cash and Carry',
    giver: 'Dex Marlowe',
    intro: [
      ['Dex', 'A buyer just touched down at the airfield with a briefcase and no patience. He wants a clean car at the hangar, cash on delivery, no questions.'],
      ['Mari', 'Let me guess — the cash does not walk itself back across town.'],
      ['Dex', 'It does not. Once he pays, you run that money straight to the downtown alley. Word gets out fast in Solano, Mari.'],
      ['Mari', 'Word gets out, and the law starts listening.'],
      ['Dex', 'Exactly. So be faster than the word. Clock starts when you roll.'],
    ],
    steps: [
      { type: 'getcar', label: 'Get into a car' },
      { type: 'goto', place: 'airfield', label: 'Deliver the car to the airfield hangar', timer: 300 },
      { type: 'goto', point: { x: 1750, y: 1290 }, label: 'Run the cash to the downtown alley', heat: 18 },
    ],
    reward: 950,
    outro: [
      ['Dex', 'Cash counted, buyer vanished. That is how quiet money moves in this town.'],
    ],
  },
  {
    title: 'The Whistleblower',
    giver: 'Odette Marchand',
    intro: [
      ['Odette', 'You are Dex\'s driver? I am Odette Marchand, concierge at the Azahar Hotel. My sister keeps the Castellano crews\' books — and she wants out, tonight.'],
      ['Mari', 'And I am the door she walks through.'],
      ['Odette', 'She knows names, dates, payments. If she talks, half this city burns. But someone inside Dex\'s own crew is already talking — that is how the Castellanos found her.'],
      ['Mari', 'Someone close to Dex is leaking? That would explain a lot of the heat lately.'],
      ['Odette', 'Please, get her to Tito\'s garage and do not stop for anyone. She is all I have.'],
    ],
    steps: [
      { type: 'pickup', place: 'hotelLot', label: 'Pick up the whistleblower at the Azahar Hotel (bring a car)' },
      { type: 'escape', place: 'garage', heat: 3, label: "Get her to Tito's garage — do not stop" },
    ],
    reward: 1200,
    outro: [
      ['Odette', 'She is safe — thank you. Whatever comes next, Mari, watch who stands close to Dex.'],
      ['Mari', 'I will. Get some sleep, Odette.'],
    ],
  },
  {
    title: 'Heat Wave',
    giver: 'Dex Marlowe',
    intro: [
      ['Dex', 'Mari — the warehouse is blown. Captain Ibarra has the whole SPD rolling and your name is on the radio.'],
      ['Mari', 'My name? I have been careful!'],
      ['Dex', 'Someone sold us. Run north, to the bridge safehouse, and do not stop for anything wearing a badge. Survive, and Solano is yours.'],
    ],
    steps: [
      { type: 'escape', place: 'safehouse', label: 'Escape to the North Bridge Safehouse', heat: 4 },
    ],
    reward: 1500,
    outro: [
      ['Dex', 'You made it. Whatever they say on the radio tomorrow, tonight the city is quiet — and it is yours.'],
    ],
  },
];

const FARE_STANDS = [
  { x: 3130, y: 1080 }, { x: 3050, y: 2500 }, { x: 1090, y: 1130 },
  { x: 2240, y: 1700 }, { x: 700, y: 700 }, { x: 2900, y: 2900 },
];

export function createMissionSystem() {
  return {
    index: 0,
    storyDone: false,
    active: null, // { def, stepIndex, timerLeft, targetCar, passenger }
    fare: null, // { ped, phase: 'pickup'|'drive', destX, destY, fare, elapsed, par }
    startPulse: 0,

    currentStart() {
      if (this.storyDone) return null;
      return MISSION_STARTS[this.index];
    },

    begin(game, def) {
      game.dialogue = {
        lines: def.intro,
        at: 0,
        lineAt: game.time,
        onDone: () => this.activate(game, def),
      };
      sfx.phone();
    },

    activate(game, def) {
      this.active = { def, stepIndex: 0, timerLeft: null, targetCar: null, passenger: null };
      this.setupStep(game);
      game.toast(`Mission: ${def.title}`);
    },

    setupStep(game) {
      const run = this.active;
      if (!run) return;
      const step = run.def.steps[run.stepIndex];
      // A step's timer, once started, runs to the mission's end (the six minutes of
      // Three Drops covers all three drops, not just the last one).
      if (step.timer && run.timerLeft === null) run.timerLeft = step.timer;
      if (step.type === 'steal') {
        // The gold Aurelia GT waits in the hotel lot, with a guard who minds it.
        const spot = PLACES.hotelLot;
        const car = createVehicle('sport', spot.x, spot.y + 46, -Math.PI / 2, 'parked', game.rng);
        car.color = '#f2b134';
        car.missionMark = 'steal';
        game.vehicles.push(car);
        run.targetCar = car;
        const guard = createPed(spot.x + 42, spot.y + 30, game.rng);
        guard.state = 'walk';
        game.peds.push(guard);
      }
      if (step.type === 'pickup') {
        const spot = PLACES[step.place];
        const star = createPed(spot.x, spot.y, game.rng);
        star.state = 'waiting';
        star.fareMark = true;
        star.shirt = '#fdf3d8';
        game.peds.push(star);
        run.passenger = star;
      }
      if (step.heat && step.type === 'escape') {
        game.police.lockedStars = step.heat;
        game.police.points = Math.max(game.police.points, 140);
        game.police.refreshStars();
      }
    },

    fail(game, why) {
      if (!this.active) return;
      this.active = null;
      game.police.lockedStars = 0;
      sfx.fail();
      game.toast(`Mission failed — ${why}. Return to the marker to try again.`);
    },

    completeStep(game) {
      const run = this.active;
      const step = run.def.steps[run.stepIndex];
      if (step.heat && step.type === 'goto') {
        game.police.points += step.heat;
        game.police.refreshStars();
      }
      if (step.type === 'pickup' && run.passenger) {
        // The passenger is aboard; the next step carries them.
      }
      run.stepIndex += 1;
      if (run.stepIndex >= run.def.steps.length) {
        this.completeMission(game);
      } else {
        this.setupStep(game);
        sfx.pickup();
      }
    },

    completeMission(game) {
      const run = this.active;
      const def = run.def;
      this.active = null;
      game.police.lockedStars = 0;
      game.player.cash += def.reward;
      game.stats.missionsDone += 1;
      if (def.title === 'Borrowed Horsepower') {
        game.player.hasPistol = true;
        game.player.ammo += 24;
      }
      this.index += 1;
      if (this.index >= STORY.length) {
        this.storyDone = true;
      }
      sfx.success();
      game.toast(`Mission passed — +$${def.reward}`);
      game.dialogue = { lines: def.outro, at: 0, lineAt: game.time, onDone: () => {} };
      if (this.storyDone) {
        game.triggerStoryComplete();
      }
      storeSave(game);
    },

    stepTarget(step) {
      if (!step) return null;
      if (step.place) return PLACES[step.place];
      if (step.point) return step.point;
      return null;
    },

    update(game, dt) {
      this.startPulse += dt;
      const player = game.player;
      // Standing in the start marker with no mission running opens the next job.
      if (!this.active && !game.dialogue && !this.storyDone && game.state === 'play') {
        const start = this.currentStart();
        if (start && distance(player.x, player.y, start.x, start.y) < 56) {
          this.begin(game, STORY[this.index]);
        }
      }
      const run = this.active;
      if (run) {
        const step = run.def.steps[run.stepIndex];
        if (run.timerLeft !== null) {
          run.timerLeft -= dt;
          if (run.timerLeft <= 0) {
            this.fail(game, 'out of time');
            return;
          }
        }
        if (step.type === 'getcar') {
          if (player.car) this.completeStep(game);
        } else if (step.type === 'steal') {
          if (run.targetCar && player.car === run.targetCar) {
            game.toast('The GT is yours — now move!');
            this.completeStep(game);
          }
        } else if (step.type === 'pickup') {
          const star = run.passenger;
          if (star && player.car && distance(player.car.x, player.car.y, star.x, star.y) < 54) {
            star.inCar = player.car;
            star.state = 'passenger';
            this.completeStep(game);
            if (run.def.steps[run.stepIndex] && run.def.steps[run.stepIndex].heat) {
              game.police.lockedStars = run.def.steps[run.stepIndex].heat;
              game.police.points = Math.max(game.police.points, 50);
              game.police.refreshStars();
              game.toast('A patrol spotted the crowd — heat is on!');
            }
          }
        } else if (step.type === 'goto' || step.type === 'escape') {
          const target = this.stepTarget(step);
          const focus = player.car ?? player;
          if (target && distance(focus.x, focus.y, target.x, target.y) < (step.type === 'escape' ? 84 : 62)) {
            if (step.needCar && !player.car) {
              // The marker explains itself when she arrives on foot.
              if (!run.warnedNeedCar) {
                run.warnedNeedCar = true;
                game.toast('You need a car to load the crates');
              }
            } else {
              this.completeStep(game);
            }
          }
        }
      }
      this.updateFare(game, dt);
      this.updatePickups(game, dt);
    },

    updateFare(game, dt) {
      const player = game.player;
      if (!this.fare) {
        // Offer a fare when the player is driving and a stand is near.
        if (player.car && !this.active && game.state === 'play') {
          for (const stand of FARE_STANDS) {
            if (distance(player.x, player.y, stand.x, stand.y) < 300 && game.rng() < dt * 0.25) {
              const ped = createPed(stand.x, stand.y, game.rng);
              ped.state = 'waiting';
              ped.fareMark = true;
              game.peds.push(ped);
              this.fare = { ped, phase: 'pickup', destX: 0, destY: 0, fare: 0, elapsed: 0, par: 0 };
              break;
            }
          }
        }
        return;
      }
      const fare = this.fare;
      const ped = fare.ped;
      if (ped.state === 'down') {
        this.fare = null;
        game.toast('Fare lost');
        return;
      }
      if (fare.phase === 'pickup') {
        if (player.car && distance(player.car.x, player.car.y, ped.x, ped.y) < 52) {
          ped.inCar = player.car;
          ped.state = 'passenger';
          // A destination across town, on a road, worth the drive.
          const dest = FARE_STANDS[Math.floor(game.rng() * FARE_STANDS.length)];
          fare.destX = dest.x + (game.rng() - 0.5) * 300;
          fare.destY = dest.y + (game.rng() - 0.5) * 300;
          const d = distance(ped.x, ped.y, fare.destX, fare.destY);
          fare.fare = Math.round(25 + d * 0.055);
          fare.par = d / 240;
          fare.phase = 'drive';
          sfx.pickup();
          game.toast(`Fare aboard — $${fare.fare} to the drop-off`);
        } else if (distance(ped.x, ped.y, player.x, player.y) > 700) {
          ped.fareMark = false;
          ped.state = 'walk';
          this.fare = null;
        }
        return;
      }
      // phase 'drive'
      fare.elapsed += dt;
      if (player.car && distance(player.car.x, player.car.y, fare.destX, fare.destY) < 56) {
        const tip = Math.max(0, Math.round(((fare.par - fare.elapsed) / fare.par) * fare.fare * 0.6));
        player.cash += fare.fare + tip;
        game.stats.faresDone += 1;
        ped.inCar = null;
        ped.state = 'walk';
        ped.fareMark = false;
        ped.x = player.car.x + 34;
        ped.y = player.car.y + 10;
        this.fare = null;
        sfx.cash();
        game.toast(tip > 0 ? `Fare paid $${fare.fare} + $${tip} tip` : `Fare paid $${fare.fare}`);
        storeSave(game);
      }
    },

    updatePickups(game, dt) {
      const player = game.player;
      const focus = player.car ?? player;
      for (const pack of game.world.packages) {
        if (pack.taken) continue;
        pack.bob += dt * 2;
        if (distance(focus.x, focus.y, pack.x, pack.y) < 30) {
          pack.taken = true;
          player.cash += 50;
          game.stats.packagesFound += 1;
          sfx.cash();
          game.toast(`Hidden package — +$50 (${game.stats.packagesFound}/12)`);
          storeSave(game);
        }
      }
      for (const drop of [...game.drops]) {
        drop.ttl -= dt;
        if (drop.ttl <= 0) {
          game.drops.splice(game.drops.indexOf(drop), 1);
          continue;
        }
        if (!player.car && distance(player.x, player.y, drop.x, drop.y) < 24) {
          if (drop.kind === 'ammo') {
            player.ammo += drop.amount;
            game.toast(`+${drop.amount} pistol rounds`);
          } else {
            player.health = Math.min(player.maxHealth, player.health + 35);
            game.toast('Patched up +35');
          }
          sfx.pickup();
          game.drops.splice(game.drops.indexOf(drop), 1);
        }
      }
      // The hospital hands out care to anyone who walks in hurt.
      if (!player.car && player.health < player.maxHealth
        && distance(player.x, player.y, PLACES.hospital.x, PLACES.hospital.y) < 60) {
        player.health = Math.min(player.maxHealth, player.health + dt * 22);
      }
      // Anchor Arms sells rounds to a pistol owner standing at the counter.
      if (!player.car && player.hasPistol && player.cash >= 40
        && distance(player.x, player.y, PLACES.gunStore.x, PLACES.gunStore.y) < 46
        && game.pressed.has('KeyE')) {
        player.cash -= 40;
        player.ammo += 18;
        sfx.cash();
        game.toast('18 rounds — $40');
      }
    },

    // What the HUD should point at right now, in priority order.
    objective(game) {
      if (this.fare && this.fare.phase === 'drive') {
        return { x: this.fare.destX, y: this.fare.destY, label: 'Drop off your fare', color: '#58b368' };
      }
      if (this.fare && this.fare.phase === 'pickup') {
        return { x: this.fare.ped.x, y: this.fare.ped.y, label: 'Pick up the fare', color: '#58b368' };
      }
      const run = this.active;
      if (run) {
        const step = run.def.steps[run.stepIndex];
        if (step.type === 'getcar') return { label: step.label, color: '#f2b134' };
        if (step.type === 'steal' && run.targetCar) {
          return { x: run.targetCar.x, y: run.targetCar.y, label: step.label, color: '#f2b134' };
        }
        const target = this.stepTarget(step);
        if (target) return { x: target.x, y: target.y, label: step.label, color: '#f2b134' };
        return { label: step.label, color: '#f2b134' };
      }
      if (!this.storyDone) {
        const start = this.currentStart();
        if (start) {
          return { x: start.x, y: start.y, label: `Next job: ${STORY[this.index].title} (${STORY[this.index].giver})`, color: '#4bcffa' };
        }
      }
      return { label: 'Free roam — fares and packages pay', color: '#e8e4da' };
    },
  };
}
