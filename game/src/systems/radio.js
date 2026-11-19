// radio.js (systems/) — the car radio: three named Port Solano stations, each a
// small synthesized loop of its own (a slow tropical pad, a smooth late-night
// groove, a driving rebelde bass), switchable from the driver's seat with R. The
// station in the HUD is the one the city hears; off is a station too.

import { tone } from '../audio/audio.js';

export const STATIONS = [
  {
    id: 'sun', name: 'SOLANO SUN', freq: '98.5', wave: 'triangle', step: 0.46, gain: 0.045,
    chords: [
      [220.0, 261.63, 329.63], // A minor
      [174.61, 220.0, 261.63], // F major
      [196.0, 246.94, 392.0], // G major
      [164.81, 261.63, 329.63], // C major over E
    ],
    bass: [55.0, 43.65, 49.0, 41.2],
  },
  {
    id: 'velvet', name: 'VELVET FM', freq: '103.9', wave: 'sine', step: 0.58, gain: 0.05,
    chords: [
      [233.08, 293.66, 349.23, 440.0], // Bb major 7
      [196.0, 246.94, 311.13, 392.0], // G minor 7
      [220.0, 261.63, 329.63, 415.3], // A minor 7
      [174.61, 220.0, 349.23, 440.0], // F major 7
    ],
    bass: [58.27, 49.0, 55.0, 43.65],
  },
  {
    id: 'rebelde', name: 'RADIO REBELDE', freq: '88.1', wave: 'sawtooth', step: 0.3, gain: 0.028,
    chords: [
      [110.0, 164.81, 220.0],
      [110.0, 164.81, 220.0],
      [98.0, 146.83, 196.0],
      [130.81, 196.0, 261.63],
    ],
    bass: [55.0, 55.0, 49.0, 65.41],
  },
];

export function createRadio() {
  return { station: -1, timer: 0, step: 0 };
}

export function stationLabel(game) {
  const radio = game.radio;
  if (!radio || radio.station < 0) return 'Radio off';
  const station = STATIONS[radio.station];
  return `${station.name} ${station.freq}`;
}

export function cycleStation(game) {
  const radio = game.radio ?? (game.radio = createRadio());
  radio.station = ((radio.station + 2) % (STATIONS.length + 1)) - 1;
  radio.timer = 0;
  radio.step = 0;
  game.toast(radio.station < 0 ? 'Radio off' : `♪ ${stationLabel(game)}`);
}

// Called every frame of play: a station only sounds from the driver's seat, one
// chord stab and one bass note per step, scheduled by its own clock.
export function updateRadio(game, dt) {
  const radio = game.radio;
  if (!radio || radio.station < 0) return;
  if (!game.player.car) return;
  const station = STATIONS[radio.station];
  radio.timer -= dt;
  if (radio.timer > 0) return;
  radio.timer = station.step;
  const bar = radio.step % station.chords.length;
  radio.step += 1;
  for (const frequency of station.chords[bar]) {
    tone({ frequency, duration: station.step * 1.7, type: station.wave, gain: station.gain });
  }
  tone({ frequency: station.bass[bar], duration: station.step * 1.5, type: 'triangle', gain: 0.07 });
}
