// render.js — everything the eye sees in the world: the sun-baked streets, rooftops
// with their shadows and water towers, the beach and the water, palms, traffic,
// pedestrians, the police, gunfire tracers and smoke, and the day-night light that
// washes over all of it. The HUD is hud.js; this file only draws the world itself,
// through the camera, culling whatever is off screen.

import { PALETTE, WORLD } from './config.js';
import { clamp } from './random.js';

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function darknessAt(clockMinutes) {
  // 0 in full day, up to 0.52 in the small hours; dawn and dusk pass quickly.
  const h = clockMinutes / 60;
  if (h >= 7 && h < 17.5) return 0;
  if (h >= 19 || h < 5) return 0.52;
  if (h >= 17.5) return (h - 17.5) / 1.5 * 0.52;
  return (7 - h) / 2 * 0.52;
}

export function drawScene(ctx, game) {
  const cam = game.camera;
  const viewW = ctx.canvas.width / cam.zoom;
  const viewH = ctx.canvas.height / cam.zoom;
  const left = cam.x - viewW / 2;
  const top = cam.y - viewH / 2;
  const right = left + viewW;
  const bottom = top + viewH;

  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-left, -top);

  drawGround(ctx, game, left, top, right, bottom);
  drawPackagesAndDrops(ctx, game, left, top, right, bottom);
  drawObjectiveMarker(ctx, game);
  for (const car of game.vehicles) {
    if (car.x < left - 140 || car.x > right + 140 || car.y < top - 140 || car.y > bottom + 140) continue;
    drawVehicle(ctx, game, car);
  }
  for (const ped of game.peds) {
    if (ped.inCar) continue;
    if (ped.x < left - 60 || ped.x > right + 60 || ped.y < top - 60 || ped.y > bottom + 60) continue;
    drawPed(ctx, game, ped);
  }
  if (!game.player.car) drawPlayer(ctx, game);
  drawEffects(ctx, game);
  ctx.restore();

  drawLighting(ctx, game);
}

function drawGround(ctx, game, left, top, right, bottom) {
  const world = game.world;
  // Base pavement everywhere, then each block's own ground: grass in the suburbs,
  // concrete downtown and at the docks, pale sand-dust near the beach.
  ctx.fillStyle = PALETTE.pavement;
  ctx.fillRect(left, top, right - left, bottom - top);
  for (const g of world.grounds) {
    if (g.x + g.w < left || g.x > right || g.y + g.h < top || g.y > bottom) continue;
    ctx.fillStyle = g.color;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }

  // The airfield tarmac.
  ctx.fillStyle = '#8f9296';
  ctx.fillRect(404, 0, 472, 236);
  ctx.fillStyle = '#e8e2c8';
  for (let x = 430; x < 850; x += 60) ctx.fillRect(x, 112, 34, 7);

  // Beach and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(left, WORLD.beachX), top, right - Math.max(left, WORLD.beachX), bottom - top);
  const seaGrad = ctx.createLinearGradient(WORLD.waterX, 0, WORLD.width, 0);
  seaGrad.addColorStop(0, PALETTE.water);
  seaGrad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = seaGrad;
  ctx.fillRect(Math.max(left, WORLD.waterX), top, right - Math.max(left, WORLD.waterX), bottom - top);
  // Surf line and a slow shimmer.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const surfPhase = Math.sin(game.time * 0.7) * 6;
  ctx.fillRect(WORLD.waterX + surfPhase, top, 5, bottom - top);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let y = Math.floor(top / 90) * 90; y < bottom; y += 90) {
    ctx.fillRect(WORLD.waterX + 60 + Math.sin(game.time * 0.4 + y) * 22, y, 130, 4);
  }

  // Roads: sidewalk aprons first, then asphalt, then markings.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const c of WORLD.roadCenters) {
    ctx.fillRect(left, c - WORLD.roadHalfWidth - WORLD.sidewalk, right - left, (WORLD.roadHalfWidth + WORLD.sidewalk) * 2);
    ctx.fillRect(c - WORLD.roadHalfWidth - WORLD.sidewalk, top, (WORLD.roadHalfWidth + WORLD.sidewalk) * 2, bottom - top);
  }
  ctx.fillStyle = PALETTE.road;
  for (const c of WORLD.roadCenters) {
    ctx.fillRect(left, c - WORLD.roadHalfWidth, Math.min(right, WORLD.beachX + 60) - left, WORLD.roadHalfWidth * 2);
    ctx.fillRect(c - WORLD.roadHalfWidth, top, WORLD.roadHalfWidth * 2, bottom - top);
  }
  // The coastal road runs out onto the sand to the marina.
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(WORLD.beachX - 40, 2796 - WORLD.roadHalfWidth, 200, WORLD.roadHalfWidth * 2);

  ctx.strokeStyle = PALETTE.laneMark;
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const c of WORLD.roadCenters) {
    ctx.moveTo(left, c);
    ctx.lineTo(Math.min(right, WORLD.beachX + 60), c);
    ctx.moveTo(c, top);
    ctx.lineTo(c, bottom);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const cx of WORLD.roadCenters) {
    for (const cy of WORLD.roadCenters) {
      if (cx < left - 200 || cx > right + 200 || cy < top - 200 || cy > bottom + 200) continue;
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(cx - WORLD.roadHalfWidth - 18, cy + i * 22 - 5, 14, 10);
        ctx.fillRect(cx + WORLD.roadHalfWidth + 4, cy + i * 22 - 5, 14, 10);
      }
    }
  }

  // Buildings: a sun shadow to the south-east, an extruded side, then the roof.
  const dark = darknessAt(game.clockMinutes);
  for (const b of world.buildings) {
    if (b.x + b.w < left - 80 || b.x > right + 80 || b.y + b.h < top - 80 || b.y > bottom + 80) continue;
    const lift = b.height * 0.42;
    ctx.fillStyle = 'rgba(60,40,20,0.28)';
    ctx.fillRect(b.x + lift * 0.55, b.y + lift * 0.55, b.w, b.h);
    ctx.fillStyle = shade(b.color, -34);
    ctx.fillRect(b.x + lift * 0.32, b.y + lift * 0.32, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof furniture: air-conditioning boxes, a parapet, water towers downtown.
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = '#9aa0a4';
    for (const ac of b.acUnits) {
      ctx.fillRect(b.x + b.w / 2 + ac.dx, b.y + b.h / 2 + ac.dy, ac.w, ac.h);
    }
    if (b.waterTower) {
      const tx = b.x + b.w * 0.68;
      const ty = b.y + b.h * 0.3;
      ctx.fillStyle = '#7a5c40';
      ctx.fillRect(tx - 4, ty - 4, 26, 20);
      ctx.beginPath();
      ctx.moveTo(tx - 8, ty - 4);
      ctx.lineTo(tx + 9, ty - 18);
      ctx.lineTo(tx + 26, ty - 4);
      ctx.closePath();
      ctx.fill();
    }
    if (b.sign) {
      ctx.fillStyle = '#d94f3d';
      ctx.fillRect(b.x + 6, b.y + 6, Math.min(64, b.w - 12), 13);
      ctx.fillStyle = '#fff6e0';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('HOTEL', b.x + 11, b.y + 16);
    }
    if (dark > 0.12) {
      // Windows come on as the light goes.
      ctx.fillStyle = 'rgba(255,196,86,0.85)';
      const cols = Math.floor(b.w / 26);
      const rows = Math.floor(b.h / 26);
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if (hash2(Math.floor(b.x) + i * 7, Math.floor(b.y) + j * 13) < 0.42) {
            ctx.fillRect(b.x + 9 + i * 26, b.y + 9 + j * 26, 8, 6);
          }
        }
      }
    }
  }

  // Palms: a bent trunk and a star of fronds.
  for (const palm of world.palms) {
    if (palm.x < left - 60 || palm.x > right + 60 || palm.y < top - 60 || palm.y > bottom + 60) continue;
    ctx.fillStyle = 'rgba(60,40,20,0.22)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 8, palm.y + 8, 17 * palm.s, 8 * palm.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6b42';
    ctx.lineWidth = 5 * palm.s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + palm.lean, palm.y - 12 * palm.s, palm.x + palm.lean * 1.7, palm.y - 20 * palm.s);
    ctx.stroke();
    ctx.strokeStyle = '#3f7d33';
    ctx.lineWidth = 4 * palm.s;
    const topX = palm.x + palm.lean * 1.7;
    const topY = palm.y - 20 * palm.s;
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + palm.lean * 0.05;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(a) * 15 * palm.s, topY + Math.sin(a) * 9 * palm.s - 4,
        topX + Math.cos(a) * 24 * palm.s, topY + Math.sin(a) * 15 * palm.s + 5,
      );
      ctx.stroke();
    }
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawPackagesAndDrops(ctx, game, left, top, right, bottom) {
  for (const pack of game.world.packages) {
    if (pack.taken) continue;
    if (pack.x < left - 40 || pack.x > right + 40 || pack.y < top - 40 || pack.y > bottom + 40) continue;
    const bobY = Math.sin(pack.bob) * 3;
    ctx.fillStyle = 'rgba(242,177,52,0.25)';
    ctx.beginPath();
    ctx.arc(pack.x, pack.y, 17 + Math.sin(pack.bob) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6e4f1d';
    ctx.fillRect(pack.x - 8, pack.y - 5 + bobY, 16, 11);
    ctx.fillStyle = '#f2b134';
    ctx.fillRect(pack.x - 8, pack.y - 5 + bobY, 16, 3);
  }
  for (const drop of game.drops) {
    ctx.fillStyle = drop.kind === 'ammo' ? '#3d7bd9' : '#e15f78';
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(drop.kind === 'ammo' ? 'A' : '+', drop.x, drop.y + 3.5);
    ctx.textAlign = 'left';
  }
}

function drawObjectiveMarker(ctx, game) {
  const objective = game.missions.objective(game);
  if (!objective || objective.x === undefined) return;
  const pulse = 0.65 + Math.sin(game.time * 3.2) * 0.35;
  ctx.fillStyle = objective.color + '55';
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, 30 + pulse * 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = objective.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, 22 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = objective.color;
  ctx.beginPath();
  ctx.moveTo(objective.x, objective.y - 52 - pulse * 6);
  ctx.lineTo(objective.x - 10, objective.y - 34 - pulse * 6);
  ctx.lineTo(objective.x + 10, objective.y - 34 - pulse * 6);
  ctx.closePath();
  ctx.fill();
}

export function drawVehicle(ctx, game, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(40,26,12,0.30)';
  ctx.beginPath();
  ctx.ellipse(5, 7, spec.length * 0.52, spec.width * 0.58, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  const L = spec.length;
  const W = spec.width;
  // Tyres.
  ctx.fillStyle = '#17181c';
  const tw = 9;
  const th = 6;
  for (const [tx, ty] of [[L * 0.3, -W / 2 - 1], [L * 0.3, W / 2 - th + 1], [-L * 0.3, -W / 2 - 1], [-L * 0.3, W / 2 - th + 1]]) {
    ctx.fillRect(tx - tw / 2, ty, tw, th);
  }
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a40' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 9);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#1d2733';
    roundRect(ctx, -L / 2, -W / 2, L * 0.34, W, 9);
    ctx.fill();
    roundRect(ctx, L * 0.16, -W / 2, L * 0.34, W, 9);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', 0, 3.5);
    // Light bar, flashing with the game clock.
    const phase = Math.floor(game.time * 3.4) % 2;
    ctx.fillStyle = phase ? '#ff4040' : '#4060ff';
    ctx.fillRect(-9, -W / 2 + 3, 18, 5);
    ctx.fillStyle = phase ? '#4060ff' : '#ff4040';
    ctx.fillRect(-9, W / 2 - 8, 18, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#f7c948';
    roundRect(ctx, -L / 2, -W / 2, L, W, 9);
    ctx.fill();
    ctx.fillStyle = '#22242a';
    ctx.fillRect(-7, -8, 14, 16);
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  // Cabin: windshield, roof, rear window.
  ctx.fillStyle = 'rgba(24,34,44,0.9)';
  roundRect(ctx, L * 0.08, -W * 0.38, L * 0.16, W * 0.76, 4);
  ctx.fill();
  ctx.fillStyle = shade(car.wrecked ? '#3a3a40' : car.color, 18);
  roundRect(ctx, -L * 0.14, -W * 0.4, L * 0.2, W * 0.8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(24,34,44,0.75)';
  roundRect(ctx, -L * 0.3, -W * 0.36, L * 0.1, W * 0.72, 4);
  ctx.fill();
  // Headlights and brake lights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 6);
  ctx.fillRect(L / 2 - 3, W / 2 - 10, 3, 6);
  ctx.fillStyle = car.throttle < 0 ? '#ff5a4d' : '#a02c22';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 6);
  ctx.fillRect(-L / 2, W / 2 - 10, 3, 6);
  // Damage: a crumpled nose and cracks as health falls.
  if (car.health < car.maxHealth * 0.55) {
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L * 0.42, -W * 0.2);
    ctx.lineTo(L * 0.2, 0);
    ctx.lineTo(L * 0.4, W * 0.24);
    ctx.stroke();
  }
  ctx.restore();
  if (car.missionMark === 'steal') {
    ctx.fillStyle = '#f2b134';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ STEAL', car.x, car.y - 44 + Math.sin(game.time * 3) * 3);
    ctx.textAlign = 'left';
  }
}

function drawPed(ctx, game, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(40,26,12,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.pants;
    ctx.fillRect(-14, -3.4, 13, 6.8);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-1, -4.6, 13, 9.2);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(16, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(40,26,12,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 10, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const stride = ped.speed > 4 ? Math.sin(ped.walkPhase) * 5 : 0;
  ctx.rotate(ped.angle);
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-3 + stride * 0.4, -4.6 + stride);
  ctx.moveTo(0, 0);
  ctx.lineTo(-3 - stride * 0.4, 4.6 - stride);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(3.8, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.isCop) {
    ctx.fillStyle = '#16283e';
    ctx.beginPath();
    ctx.arc(3.4, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b134';
    ctx.fillRect(6.4, -1, 2.4, 2);
  }
  ctx.restore();
  if (ped.fareMark && ped.state === 'waiting') {
    ctx.fillStyle = '#58b368';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 22 + Math.sin(game.time * 3) * 2.5);
    ctx.textAlign = 'left';
  }
}

function drawPlayer(ctx, game) {
  const player = game.player;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(40,26,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 10, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const stride = Math.sin(player.walkPhase) * 5;
  const moving = Math.abs(player.vx) + Math.abs(player.vy) > 12;
  ctx.rotate(player.angle);
  ctx.strokeStyle = '#263242';
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-3 + (moving ? stride * 0.4 : 0), -4.8 + (moving ? stride : 0));
  ctx.moveTo(0, 0);
  ctx.lineTo(-3 - (moving ? stride * 0.4 : 0), 4.8 - (moving ? stride : 0));
  ctx.stroke();
  ctx.fillStyle = '#0e7d7b';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8d5524';
  ctx.beginPath();
  ctx.arc(3.6, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  // Hair, tied back.
  ctx.fillStyle = '#2b1a12';
  ctx.beginPath();
  ctx.arc(1.4, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5.4, -1.6, 4.4, 3.2);
  if (player.hasPistol) {
    ctx.strokeStyle = '#22242a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 3);
    ctx.lineTo(14, 3.6);
    ctx.stroke();
  }
  ctx.restore();
  if (player.punchTimer > 0.2) {
    // A swing arc in front of her.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26, player.angle - 0.7, player.angle + 0.5);
    ctx.stroke();
  }
}

function drawEffects(ctx, game) {
  for (const effect of game.effects) {
    const t = effect.ttl / effect.max;
    if (effect.kind === 'tracer') {
      ctx.strokeStyle = `rgba(255,230,150,${0.85 * t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
    } else if (effect.kind === 'spark') {
      ctx.fillStyle = `rgba(255,190,80,${t})`;
      for (let i = 0; i < 5; i += 1) {
        const a = i * 1.7 + effect.x * 0.01;
        ctx.fillRect(effect.x + Math.cos(a) * 8 * (1 - t), effect.y + Math.sin(a) * 8 * (1 - t), 3, 3);
      }
    } else if (effect.kind === 'smoke') {
      ctx.fillStyle = `rgba(52,50,54,${0.4 * t})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y + (effect.rise ?? -12) * (1 - t), 9 + (1 - t) * 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLighting(ctx, game) {
  const dark = darknessAt(game.clockMinutes);
  const { width, height } = ctx.canvas;
  if (dark > 0.02) {
    ctx.fillStyle = `rgba(16,20,48,${dark})`;
    ctx.fillRect(0, 0, width, height);
    // Lamp pools and headlight glow stay warm against the blue.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cam = game.camera;
    for (const lamp of game.world.lamps) {
      const sx = (lamp.x - cam.x) * cam.zoom + width / 2;
      const sy = (lamp.y - cam.y) * cam.zoom + height / 2;
      if (sx < -70 || sy < -70 || sx > width + 70 || sy > height + 70) continue;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 56 * cam.zoom);
      grad.addColorStop(0, 'rgba(255,190,90,0.20)');
      grad.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - 60 * cam.zoom, sy - 60 * cam.zoom, 120 * cam.zoom, 120 * cam.zoom);
    }
    ctx.restore();
  }
  // A warm wash at golden hour.
  const h = game.clockMinutes / 60;
  if ((h >= 17 && h < 19.5) || (h >= 5.5 && h < 7.5)) {
    ctx.fillStyle = 'rgba(255,140,50,0.07)';
    ctx.fillRect(0, 0, width, height);
  }
  // Hurt vignette.
  if (game.player.hurtTimer > 0) {
    ctx.fillStyle = `rgba(190,30,30,${game.player.hurtTimer * 0.5})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
