// hud.js — everything drawn over the world: the HUD (health, cash, wanted stars,
// clock, weapon), the live minimap with its blips, the objective banner and
// dialogue box, toasts, the bust meter, and every full screen — title, pause,
// busted, wasted and story complete. Buttons drawn here are registered on
// game.uiButtons so main.js can answer the mouse.

import { WORLD, TUNING, CONTROLS_TEXT } from './config.js';
import { formatClock, formatMoney, clamp } from './random.js';
import { PLACES } from './world.js';
import { policeUnits } from './police.js';
import { STORY } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawHUD(ctx, game) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const player = game.player;

  // Top-left: who she is, how she is, what she holds.
  panel(ctx, 16, 16, 232, 86);
  ctx.fillStyle = '#f4ead2';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('MARI VOSS', 28, 38);
  ctx.fillStyle = '#9fb4c0';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(player.car ? `Driving — ${player.car.spec.name}` : 'On foot', 118, 38);
  bar(ctx, 28, 48, 208, 12, player.health / player.maxHealth, '#d94f3d', '#571f18');
  ctx.fillStyle = '#f4ead2';
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(formatMoney(player.cash), 28, 84);
  ctx.fillStyle = '#9fb4c0';
  ctx.font = `12px ${FONT}`;
  const weapon = player.hasPistol ? `Pistol · ${player.ammo} rounds` : 'Fists';
  ctx.fillText(weapon, 118, 84);

  // Top-right: the law's opinion, and the time. A backing panel keeps the
  // stars and clock readable over pale rooftops and sand.
  panel(ctx, W - 198, 12, 190, 84);
  const stars = game.police.stars;
  ctx.font = `26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    const x = W - 176 + i * 32;
    const active = i < stars;
    const flash = game.police.unseenTimer > 6 && Math.floor(game.time * 2.4) % 2 === 0;
    ctx.fillStyle = active ? (flash ? '#8a6d1f' : '#f2b134') : 'rgba(240,235,220,0.25)';
    ctx.fillText('★', x, 44);
  }
  ctx.fillStyle = '#f4ead2';
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(game.clockMinutes), W - 20, 68);
  ctx.fillStyle = '#9fb4c0';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(game.missions.storyDone ? 'Port Solano is yours' : `Story: job ${Math.min(game.missions.index + 1, STORY.length)} of ${STORY.length}`, W - 20, 86);
  ctx.textAlign = 'left';

  // The bust meter, when the law has hands nearly on her.
  if (game.police.bustMeter > 0.02) {
    const w = 260;
    panel(ctx, W / 2 - w / 2 - 8, 18, w + 16, 40);
    ctx.fillStyle = '#ff5a4d';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('— BUSTED —', W / 2, 36);
    bar(ctx, W / 2 - w / 2, 42, w, 8, game.police.bustMeter, '#ff5a4d', '#571f18');
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, game, 16, H - 206);
  drawObjective(ctx, game);
  drawToasts(ctx, game);

  if (game.prompt) {
    ctx.font = `bold 14px ${FONT}`;
    const w = ctx.measureText(game.prompt).width + 30;
    panel(ctx, W / 2 - w / 2, H - 128, w, 32);
    ctx.fillStyle = '#f4ead2';
    ctx.textAlign = 'center';
    ctx.fillText(game.prompt, W / 2, H - 107);
    ctx.textAlign = 'left';
  }
  if (game.dialogue) drawDialogue(ctx, game);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(13,17,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,234,210,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, ratio, fill, back) {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * clamp(ratio, 0, 1)), h, h / 2);
    ctx.fill();
  }
}

function drawMinimap(ctx, game, x, y) {
  const size = 190;
  const scale = size / WORLD.width;
  ctx.save();
  panel(ctx, x - 4, y - 4, size + 8, size + 8);
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#b8ab8d';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#1d7f8c';
  ctx.fillRect(x + WORLD.waterX * scale, y, size, size);
  ctx.fillStyle = '#ecd096';
  ctx.fillRect(x + WORLD.beachX * scale, y, (WORLD.waterX - WORLD.beachX) * scale, size);
  ctx.strokeStyle = '#43434c';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  for (const c of WORLD.roadCenters) {
    ctx.moveTo(x, y + c * scale);
    ctx.lineTo(x + size, y + c * scale);
    ctx.moveTo(x + c * scale, y);
    ctx.lineTo(x + c * scale, y + size);
  }
  ctx.stroke();
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * scale, y + wy * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(PLACES.garage.x, PLACES.garage.y, '#f2b134', 3);
  dot(PLACES.hospital.x, PLACES.hospital.y, '#e15f78', 3);
  const start = game.missions.currentStart();
  if (start && !game.missions.active) dot(start.x, start.y, '#4bcffa', 3.6);
  const objective = game.missions.objective(game);
  if (objective && objective.x !== undefined) {
    const pulse = 3.4 + Math.sin(game.time * 4) * 1.1;
    dot(objective.x, objective.y, objective.color, pulse);
  }
  for (const unit of policeUnits(game)) {
    if (Math.floor(game.time * 2) % 2 === 0) dot(unit.x, unit.y, '#4060ff', 2.6);
  }
  for (const pack of game.world.packages) {
    if (!pack.taken) dot(pack.x, pack.y, '#ffe9a8', 1.8);
  }
  // The player: a white arrow that turns with her.
  const px = x + game.player.x * scale;
  const py = y + game.player.y * scale;
  const ang = game.player.car ? game.player.car.angle : game.player.angle;
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f4ead2';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText('N', x + size - 13, y + 15);
  ctx.restore();
}

function drawObjective(ctx, game) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const objective = game.missions.objective(game);
  if (!objective) return;
  const focus = game.player.car ?? game.player;
  let text = objective.label;
  if (objective.x !== undefined) {
    const d = Math.round(Math.hypot(objective.x - focus.x, objective.y - focus.y) / 10);
    text += ` — ${d}m`;
  }
  const run = game.missions.active;
  if (run && run.timerLeft !== null) {
    const t = Math.max(0, Math.ceil(run.timerLeft));
    text += ` · ${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
  }
  ctx.font = `bold 14px ${FONT}`;
  const w = ctx.measureText(text).width + 34;
  panel(ctx, W / 2 - w / 2, H - 46, w, 32);
  ctx.fillStyle = objective.color;
  ctx.beginPath();
  ctx.arc(W / 2 - w / 2 + 16, H - 30, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4ead2';
  ctx.fillText(text, W / 2 - w / 2 + 28, H - 25);

  // A direction tick at the screen edge when the target is off camera.
  if (objective.x !== undefined) {
    const cam = game.camera;
    const sx = (objective.x - cam.x) * cam.zoom + W / 2;
    const sy = (objective.y - cam.y) * cam.zoom + H / 2;
    if (sx < 30 || sx > W - 30 || sy < 30 || sy > H - 30) {
      const ang = Math.atan2(objective.y - focus.y, objective.x - focus.x);
      const ex = clamp(sx, 36, W - 36);
      const ey = clamp(sy, 36, H - 36);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = objective.color;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawToasts(ctx, game) {
  const W = ctx.canvas.width;
  ctx.textAlign = 'center';
  game.toasts.forEach((toast, i) => {
    const alpha = clamp(toast.ttl / 0.6, 0, 1);
    ctx.font = `bold 15px ${FONT}`;
    const w = ctx.measureText(toast.text).width + 34;
    ctx.fillStyle = `rgba(13,17,24,${0.78 * alpha})`;
    ctx.beginPath();
    ctx.roundRect(W / 2 - w / 2, 108 + i * 40, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = `rgba(244,234,210,${alpha})`;
    ctx.fillText(toast.text, W / 2, 129 + i * 40);
  });
  ctx.textAlign = 'left';
}

function drawDialogue(ctx, game) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const dialogue = game.dialogue;
  const [speaker, text] = dialogue.lines[dialogue.at];
  const shown = Math.min(text.length, Math.floor((game.time - dialogue.lineAt) * 46));
  const boxH = 96;
  ctx.fillStyle = 'rgba(10,13,19,0.88)';
  ctx.beginPath();
  ctx.roundRect(90, H - boxH - 58, W - 180, boxH, 10);
  ctx.fill();
  ctx.strokeStyle = speaker === 'System' ? '#4bcffa' : '#f2b134';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = speaker === 'Mari' ? '#7fe3dd' : speaker === 'System' ? '#4bcffa' : '#f2b134';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(speaker.toUpperCase(), 112, H - boxH - 32);
  ctx.fillStyle = '#f4ead2';
  ctx.font = `16px ${FONT}`;
  wrapText(ctx, text.slice(0, shown), 112, H - boxH - 6, W - 224, 22);
  if (shown >= text.length) {
    ctx.fillStyle = '#9fb4c0';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('E / click ▸', W - 112, H - 68);
    ctx.textAlign = 'left';
  }
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// ---- Full screens -----------------------------------------------------------

function registerButton(game, id, x, y, w, h) {
  game.uiButtons.push({ id, x, y, w, h });
}

function drawButton(ctx, game, id, x, y, w, h, label, primary = false) {
  registerButton(game, id, x, y, w, h);
  const hover = game.mouse.x >= x && game.mouse.x <= x + w && game.mouse.y >= y && game.mouse.y <= y + h;
  ctx.fillStyle = primary ? (hover ? '#ffc44d' : '#f2b134') : (hover ? 'rgba(244,234,210,0.24)' : 'rgba(244,234,210,0.12)');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = primary ? '#241a05' : '#f4ead2';
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  ctx.textAlign = 'left';
}

function skyline(ctx, W, horizon) {
  // A dusk silhouette of Port Solano: towers, palms, the sea.
  const grad = ctx.createLinearGradient(0, 0, 0, horizon + 160);
  grad.addColorStop(0, '#2b1e4f');
  grad.addColorStop(0.55, '#a03d63');
  grad.addColorStop(0.8, '#e8763d');
  grad.addColorStop(1, '#f7b733');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, horizon + 160);
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(W * 0.72, horizon - 60, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1430';
  const towers = [[0.04, 150], [0.12, 210], [0.2, 120], [0.3, 250], [0.42, 170], [0.55, 230], [0.66, 140], [0.8, 200], [0.9, 130]];
  for (const [fx, th] of towers) {
    ctx.fillRect(W * fx, horizon - th, W * 0.055, th + 160);
  }
  ctx.fillStyle = '#120c22';
  ctx.fillRect(0, horizon + 60, W, 300);
}

export function drawTitle(ctx, game) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  skyline(ctx, W, H * 0.52);
  ctx.fillStyle = '#fdf3d8';
  ctx.font = `900 84px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('SOLANO HEAT', W / 2, H * 0.3);
  ctx.font = `19px ${FONT}`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('An open-world crime story in the city of Port Solano', W / 2, H * 0.3 + 40);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = '#f4ead2';
  ctx.fillText('Steal cars. Run jobs. Outrun the law. Make the city yours.', W / 2, H * 0.3 + 68);
  const bw = 260;
  const bx = W / 2 - bw / 2;
  let by = H * 0.58;
  drawButton(ctx, game, 'new', bx, by, bw, 48, 'NEW GAME', true);
  by += 60;
  if (game.hasSave) {
    drawButton(ctx, game, 'continue', bx, by, bw, 48, 'CONTINUE');
    by += 60;
  }
  drawButton(ctx, game, 'help', bx, by, bw, 48, game.showHelp ? 'HIDE CONTROLS' : 'HOW TO PLAY');
  if (game.showHelp) {
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = '#f4ead2';
    CONTROLS_TEXT.forEach((line, i) => {
      ctx.fillText(line, W / 2, by + 92 + i * 24);
    });
    ctx.fillText('Do jobs for Dex and Tito, bank cash, and finish all seven story jobs to take the city.', W / 2, by + 92 + CONTROLS_TEXT.length * 24 + 8);
  }
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = 'rgba(244,234,210,0.65)';
  ctx.fillText('A make.fun entry — every car, corner and chorus of Port Solano was built for this game.', W / 2, H - 22);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, game) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,10,15,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fdf3d8';
  ctx.font = `900 52px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H * 0.3);
  const s = game.stats;
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = '#f4ead2';
  ctx.fillText(`Cash ${formatMoney(game.player.cash)} · Jobs done ${s.missionsDone} · Fares ${s.faresDone} · Cars stolen ${s.carsStolen} · Packages ${s.packagesFound}/12`, W / 2, H * 0.3 + 44);
  const bw = 250;
  const bx = W / 2 - bw / 2;
  let by = H * 0.46;
  drawButton(ctx, game, 'resume', bx, by, bw, 46, 'RESUME', true);
  by += 58;
  drawButton(ctx, game, 'restart', bx, by, bw, 46, 'RESTART STORY');
  by += 58;
  drawButton(ctx, game, 'title', bx, by, bw, 46, 'SAVE & TITLE');
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, game, kind) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const s = game.stats;
  if (kind === 'busted') {
    ctx.fillStyle = 'rgba(10,16,34,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7fb2ff';
    ctx.font = `900 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', W / 2, H * 0.34);
    ctx.fillStyle = '#f4ead2';
    ctx.font = `17px ${FONT}`;
    ctx.fillText('The SPD walks Mari to a cell. The fine stings; the record stings longer.', W / 2, H * 0.34 + 42);
    ctx.fillText(`Fine paid: ${formatMoney(game.lastFine)} · Released at SPD Central`, W / 2, H * 0.34 + 70);
  } else if (kind === 'wasted') {
    ctx.fillStyle = 'rgba(34,8,8,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff7a6b';
    ctx.font = `900 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', W / 2, H * 0.34);
    ctx.fillStyle = '#f4ead2';
    ctx.font = `17px ${FONT}`;
    ctx.fillText(`${game.wastedCause ?? 'It ends badly'} — Solano General patches Mari up, for a price.`, W / 2, H * 0.34 + 42);
    ctx.fillText(`Hospital bill: ${formatMoney(game.lastFine)}`, W / 2, H * 0.34 + 70);
  } else {
    ctx.fillStyle = 'rgba(16,26,14,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#a5e075';
    ctx.font = `900 58px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('STORY COMPLETE', W / 2, H * 0.3);
    ctx.fillStyle = '#f4ead2';
    ctx.font = `17px ${FONT}`;
    ctx.fillText('Mari Voss outran Captain Ibarra, the Castellano crews and her own past.', W / 2, H * 0.3 + 42);
    ctx.fillText('Port Solano is hers now — the fares, packages and streets remain.', W / 2, H * 0.3 + 68);
  }
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = '#cfe0c0';
  ctx.fillText(`Jobs ${s.missionsDone}/${STORY.length} · Fares ${s.faresDone} · Cars stolen ${s.carsStolen} · Distance driven ${Math.round(s.distanceDriven / 52)}m · Packages ${s.packagesFound}/12`, W / 2, H * 0.56);
  drawButton(ctx, game, 'again', W / 2 - 125, H * 0.64, 250, 48, kind === 'complete' ? 'KEEP ROAMING' : 'CONTINUE', true);
  ctx.textAlign = 'left';
}

export { TUNING };
