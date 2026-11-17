// world.js — Port Solano itself: the road grid, six districts of buildings with
// rooftops and shadows, the beach and the water, palms and lamps, the named places
// the story visits, parking spots and the hidden cash packages. The city is built
// once from a fixed seed, and the collision helpers every mover uses live here too.

import { WORLD, BUILDING_COLORS } from './config.js';
import { makeRng, pick, randInt, randRange } from './random.js';

export const PLACES = {
  start: { x: 3052, y: 2470, name: 'Marina Café', blip: 'cafe' },
  garage: { x: 706, y: 2090, name: "Tito's Auto Works", blip: 'garage' },
  marina: { x: 3160, y: 3070, name: 'Port Solano Marina', blip: 'marina' },
  docks: { x: 330, y: 3270, name: 'South Docks', blip: 'docks' },
  warehouse: { x: 520, y: 2870, name: "Dex's Warehouse", blip: 'warehouse' },
  police: { x: 1660, y: 1745, name: 'SPD Central', blip: 'police' },
  hospital: { x: 2310, y: 1120, name: 'Solano General', blip: 'hospital' },
  airfield: { x: 640, y: 356, name: 'Solano Airfield', blip: 'airfield' },
  hotelLot: { x: 3130, y: 1130, name: 'Azahar Hotel', blip: 'hotel' },
  boardwalk: { x: 3210, y: 1900, name: 'Boardwalk Stage', blip: 'stage' },
  safehouse: { x: 1610, y: 128, name: 'North Bridge Safehouse', blip: 'safehouse' },
  gunStore: { x: 1090, y: 1700, name: 'Anchor Arms', blip: 'gun' },
};

const BLOCK_EDGES = [0, 236, 404, 876, 1044, 1516, 1684, 2156, 2324, 2796, 2964, 3840];

function districtOf(col, row) {
  if (col === 5) return 'beachfront';
  if (col === 1 && row === 0) return 'airfield';
  if (row >= 4 && col <= 1) return 'industrial';
  if (row >= 4 && col >= 4) return 'marina';
  if (col >= 2 && col <= 3 && row >= 2 && row <= 3) return 'downtown';
  if (row <= 1 && col >= 4) return 'beachfront';
  return 'suburbs';
}

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + amount);
  const b = Math.min(255, (n & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

const BLOCK_GROUNDS = {
  downtown: '#b3a68c',
  suburbs: '#a9bd7f',
  industrial: '#a49a88',
  beachfront: '#e6d3a3',
  marina: '#b5a888',
  airfield: '#8f9296',
};

export function buildWorld(seed = 20261117) {
  const rng = makeRng(seed);
  const buildings = [];
  const grounds = [];
  const palms = [];
  const lamps = [];
  const parkingSpots = [];
  const placeList = Object.values(PLACES);

  for (let col = 0; col < 6; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      grounds.push({
        x: BLOCK_EDGES[col * 2], y: BLOCK_EDGES[row * 2],
        w: BLOCK_EDGES[col * 2 + 1] - BLOCK_EDGES[col * 2],
        h: BLOCK_EDGES[row * 2 + 1] - BLOCK_EDGES[row * 2],
        color: BLOCK_GROUNDS[districtOf(col, row)],
      });
    }
  }

  const nearPlace = (x, y, radius) => placeList.some((p) => {
    const dx = p.x - x;
    const dy = p.y - y;
    return dx * dx + dy * dy < radius * radius;
  });

  // Buildings, block by block. A block is split into a small grid of lots; each lot
  // either holds one building or stays open as a lot, an alley or a plaza corner.
  for (let col = 0; col < 6; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      const district = districtOf(col, row);
      if (district === 'airfield') continue; // the runway block stays open tarmac
      const bx0 = BLOCK_EDGES[col * 2] + WORLD.sidewalk + 6;
      const by0 = BLOCK_EDGES[row * 2] + WORLD.sidewalk + 6;
      const bx1 = BLOCK_EDGES[col * 2 + 1] - WORLD.sidewalk - 6;
      const by1 = BLOCK_EDGES[row * 2 + 1] - WORLD.sidewalk - 6;
      if (district === 'beachfront' && col === 5) {
        // Hotels stand in a row facing the coastal avenue; sand begins behind them.
      }
      const lotCols = district === 'downtown' ? 2 : 3;
      const lotRows = district === 'downtown' ? 2 : 3;
      const lotW = (bx1 - bx0) / lotCols;
      const lotH = (by1 - by0) / lotRows;
      for (let lc = 0; lc < lotCols; lc += 1) {
        for (let lr = 0; lr < lotRows; lr += 1) {
          const cx = bx0 + (lc + 0.5) * lotW;
          const cy = by0 + (lr + 0.5) * lotH;
          if (nearPlace(cx, cy, 128)) continue;
          if (district === 'beachfront' && cx > WORLD.beachX - 60) continue;
          if (rng() < 0.16) continue; // an open lot
          const margin = district === 'downtown' ? 10 : 16;
          const w = lotW - margin * 2 - randRange(rng, 0, 18);
          const h = lotH - margin * 2 - randRange(rng, 0, 18);
          const height = district === 'downtown'
            ? randRange(rng, 46, 120)
            : district === 'beachfront'
              ? randRange(rng, 26, 64)
              : district === 'industrial'
                ? randRange(rng, 16, 30)
                : randRange(rng, 12, 34);
          const color = pick(rng, BUILDING_COLORS[district] ?? BUILDING_COLORS.suburbs);
          const acUnits = [];
          const acCount = randInt(rng, 0, height > 50 ? 3 : 1);
          for (let i = 0; i < acCount; i += 1) {
            acUnits.push({
              dx: randRange(rng, -w / 2 + 12, w / 2 - 26),
              dy: randRange(rng, -h / 2 + 12, h / 2 - 26),
              w: randRange(rng, 14, 26),
              h: randRange(rng, 12, 20),
            });
          }
          buildings.push({
            x: cx - w / 2, y: cy - h / 2, w, h, height, color,
            roof: lighten(color, 26), district,
            waterTower: district === 'downtown' && height > 88 && rng() < 0.5,
            acUnits,
            sign: district === 'beachfront' && rng() < 0.4,
          });
        }
      }
    }
  }

  // Palms: a double row down the beach, a fringe along the coastal avenue, and a
  // scatter through the suburbs and the marina.
  for (let y = 120; y < WORLD.height - 80; y += randRange(rng, 90, 150)) {
    palms.push({ x: WORLD.beachX + randRange(rng, 26, 90), y, lean: randRange(rng, -6, 6), s: randRange(rng, 0.85, 1.2) });
    if (rng() < 0.7) palms.push({ x: WORLD.waterX - randRange(rng, 20, 70), y: y + randRange(rng, -30, 30), lean: randRange(rng, -6, 6), s: randRange(rng, 0.8, 1.1) });
  }
  for (let i = 0; i < 90; i += 1) {
    const x = randRange(rng, 80, WORLD.beachX - 120);
    const y = randRange(rng, 80, WORLD.height - 80);
    if (isRoadPoint(x, y, 30)) continue;
    if (nearPlace(x, y, 60)) continue;
    palms.push({ x, y, lean: randRange(rng, -5, 5), s: randRange(rng, 0.75, 1.05) });
  }

  // Lamps along every road, for the night render.
  for (const c of WORLD.roadCenters) {
    for (let t = 90; t < WORLD.width - 40; t += 230) {
      lamps.push({ x: c - WORLD.roadHalfWidth - 12, y: t });
      lamps.push({ x: t, y: c + WORLD.roadHalfWidth + 12 });
    }
  }

  // Curbside parking spots: along the south curb of each east-west street and the
  // east curb of each north-south avenue, spaced so traffic can pass.
  for (const c of WORLD.roadCenters) {
    for (let t = 480; t < WORLD.width - 200; t += 300) {
      if (rng() < 0.35) continue;
      parkingSpots.push({ x: t + randRange(rng, -20, 20), y: c + WORLD.roadHalfWidth - 34, angle: 0 });
      if (rng() < 0.3) continue;
      parkingSpots.push({ x: c + WORLD.roadHalfWidth - 34, y: t + randRange(rng, -20, 20), angle: Math.PI / 2 });
    }
  }
  // The hotel lot and the garage forecourt hold a few more, angled.
  for (let i = 0; i < 5; i += 1) {
    parkingSpots.push({ x: PLACES.hotelLot.x - 70 + i * 36, y: PLACES.hotelLot.y + 44, angle: -Math.PI / 2 });
  }

  // Hidden cash packages, tucked at block corners and alley mouths.
  const packages = [];
  const packageSpots = [
    [452, 452], [1300, 620], [1980, 430], [2620, 700], [880, 1330], [1750, 1290],
    [3050, 1520], [1180, 1980], [2520, 2050], [640, 2620], [2050, 2680], [1420, 3180],
  ];
  packageSpots.forEach(([x, y], i) => packages.push({ id: i, x, y, taken: false, bob: rng() * Math.PI * 2 }));

  return { buildings, grounds, palms, lamps, parkingSpots, packages, seed };
}

export function isRoadPoint(x, y, pad = 0) {
  if (x > WORLD.beachX + 40) return false;
  for (const c of WORLD.roadCenters) {
    if (Math.abs(x - c) < WORLD.roadHalfWidth + pad) return true;
    if (Math.abs(y - c) < WORLD.roadHalfWidth + pad) return true;
  }
  return false;
}

export function surfaceAt(x, y) {
  if (x >= WORLD.waterX) return 'water';
  if (x >= WORLD.beachX) return 'sand';
  if (isRoadPoint(x, y)) return 'road';
  if (isRoadPoint(x, y, WORLD.sidewalk)) return 'sidewalk';
  return 'pavement';
}

export function buildingAt(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function circleHitsBuilding(world, x, y, radius) {
  return buildingAt(world, x, y, radius) !== null || x < radius || y < radius
    || x > WORLD.width - radius || y > WORLD.height - radius || x > WORLD.waterX - radius;
}

// Axis-separated movement with sliding: try x, then y, so movers glide along walls.
export function slideMove(world, mover, dx, dy, radius) {
  let nx = mover.x + dx;
  if (!circleHitsBuilding(world, nx, mover.y, radius)) mover.x = nx;
  let ny = mover.y + dy;
  if (!circleHitsBuilding(world, mover.x, ny, radius)) mover.y = ny;
  for (const palm of world.palms) {
    const ddx = mover.x - palm.x;
    const ddy = mover.y - palm.y;
    const rr = radius + 7;
    if (ddx * ddx + ddy * ddy < rr * rr && ddx * ddx + ddy * ddy > 0.01) {
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      mover.x = palm.x + (ddx / d) * rr;
      mover.y = palm.y + (ddy / d) * rr;
    }
  }
  return mover;
}

// Does the swept rectangle of a car (centre, angle, half length/width) touch any
// building? Tests the four corners and the centre against building rects.
export function carHitsBuilding(world, x, y, angle, halfL, halfW) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW], [0, 0],
  ];
  for (const [lx, ly] of corners) {
    const wx = x + lx * cos - ly * sin;
    const wy = y + lx * sin + ly * cos;
    if (buildingAt(world, wx, wy, 2)) return true;
    if (wx < 6 || wy < 6 || wx > WORLD.width - 6 || wy > WORLD.height - 6) return true;
    if (wx > WORLD.waterX - 4) return true;
  }
  return false;
}

export function lineBlocked(world, x1, y1, x2, y2) {
  // Line of sight for police and witnesses: sample the segment against buildings.
  const steps = 14;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (buildingAt(world, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0)) return true;
  }
  return false;
}
