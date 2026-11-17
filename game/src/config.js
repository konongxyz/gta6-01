// config.js — the numbers and colours of Solano Heat, in one place: world size, the
// road grid, the sun-soaked palette, physics tuning and the wanted-level ladder. The
// world generator, the physics and the renderers all read from here so the city
// feels the same everywhere.

export const WORLD = {
  width: 3840,
  height: 3840,
  roadCenters: [320, 960, 1600, 2240, 2880], // avenues and streets, both axes
  roadHalfWidth: 84, // asphalt half-width; sidewalks run outside it
  sidewalk: 26,
  beachX: 3340, // sand starts here, on the east edge
  waterX: 3620, // open water starts here; nobody drives or walks into it
  blockGap: 18, // pavement between a block's edge and its buildings
};

export const PALETTE = {
  water: '#1d7f8c',
  waterDeep: '#14616e',
  sand: '#ecd096',
  sandWet: '#dfc084',
  grass: '#7fae56',
  pavement: '#b8ab8d',
  sidewalk: '#cdc2a6',
  road: '#43434c',
  roadEdge: '#33333b',
  laneMark: '#e8e2c8',
  crosswalk: '#d9d4c2',
  plaza: '#cbb694',
};

export const BUILDING_COLORS = {
  downtown: ['#e8b4a0', '#d98e73', '#e6cf9f', '#9fc6c9', '#c9d6a5', '#e2a3b4', '#f0e0bb'],
  beachfront: ['#f4e3c2', '#f7cfa5', '#bfe3dd', '#f2b8c6', '#fdf3d8', '#a8d8ea'],
  suburbs: ['#efe3cb', '#dfc9a8', '#cfe0c0', '#f0d0b0', '#e8e8f0', '#f6e7c8'],
  industrial: ['#b09a80', '#98a0a8', '#c0b098', '#a89878', '#b8b0a0'],
  marina: ['#e8dcc0', '#a8c8d8', '#f0e6cc', '#c8d8b0'],
};

export const CAR_COLORS = [
  '#d94f3d', '#3d7bd9', '#f2b134', '#58b368', '#e8e4da', '#2f3542',
  '#a55eea', '#fd9644', '#4bcffa', '#778ca3', '#e15f78', '#95afc0',
];

export const VEHICLE_TYPES = {
  sedan: { name: 'Meridian Sedan', length: 74, width: 34, topSpeed: 342, accel: 210, grip: 5.2, health: 100, seats: 4 },
  hatch: { name: 'Pico Hatchback', length: 62, width: 32, topSpeed: 300, accel: 225, grip: 5.6, health: 80, seats: 4 },
  coupe: { name: 'Vireo Coupe', length: 72, width: 34, topSpeed: 396, accel: 265, grip: 5.8, health: 90, seats: 2 },
  sport: { name: 'Aurelia GT', length: 76, width: 36, topSpeed: 468, accel: 330, grip: 6.4, health: 95, seats: 2 },
  taxi: { name: 'Solano Cab', length: 74, width: 34, topSpeed: 336, accel: 215, grip: 5.2, health: 100, seats: 4 },
  truck: { name: 'Hauler Pickup', length: 84, width: 38, topSpeed: 306, accel: 175, grip: 4.4, health: 150, seats: 2 },
  van: { name: 'Cargo Van', length: 86, width: 38, topSpeed: 288, accel: 165, grip: 4.2, health: 140, seats: 2 },
  police: { name: 'SPD Interceptor', length: 76, width: 35, topSpeed: 432, accel: 305, grip: 6.1, health: 130, seats: 4 },
};

export const TUNING = {
  playerWalkSpeed: 118,
  playerRunSpeed: 196,
  playerRadius: 11,
  enterCarRange: 52,
  bustRadius: 64,
  bustFillSeconds: 2.4,
  wantedDecaySeconds: 14, // unseen this long, one star fades
  dayLengthSeconds: 420, // a full day-night cycle
  startMinute: 10 * 60 + 15,
  trafficCars: 15,
  parkedCars: 16,
  pedestrians: 26,
  maxPoliceByStars: [0, 1, 2, 3, 4, 6],
};

export const CONTROLS_TEXT = [
  'W A S D / Arrows — move · drive',
  'Shift — run · E — enter / exit car',
  'Space — handbrake · F or Click — punch / shoot',
  'Mouse — aim · P or Esc — pause · M — mute',
];
