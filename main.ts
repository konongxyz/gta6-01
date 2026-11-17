// Solano Heat — hand-in program for the gta6-01 entry (Node 22, standard library only).
//
// The game itself is the static site under game/ (game/index.html and the ES modules it
// loads; no build step, no network). This program is only the courier: it copies game/
// and screenshots/ from beside this file into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library, so the
// scorer and the judge read exactly the bytes this repository holds.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice and the two outputs are byte-identical: nothing here reads a clock, a
// random source or the network, and the copy order is the filesystem's own.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from: string, to: string): number {
  // Returns how many files were copied, for the one-line summary at the end.
  let files = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) files += copyTree(join(from, entry.name), join(to, entry.name));
    else if (entry.isFile()) files += 1;
  }
  cpSync(from, to, { recursive: true });
  return files;
}

mkdirSync(outputDir, { recursive: true });
const gameFiles = copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));

let shotFiles = 0;
const shotsFrom = join(repoRoot, 'screenshots');
if (existsSync(shotsFrom)) {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  shotFiles = copyTree(shotsFrom, join(outputDir, 'screenshots'));
}

// The caps are the scorer's own (the gate's reference numbers): the dossier text is
// capped at 160 KiB, screenshots at 4 files of 256 KiB, game/ at 993 entries and
// 48 MiB with no path over 1,000 bytes. buildDossier refuses an entry past them.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`solano-heat: copied ${gameFiles} game files and ${shotFiles} screenshots; dossier ${dossier.length} bytes`);
