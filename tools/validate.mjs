#!/usr/bin/env node
/* Validates src/script.js against the engine contract + asset files.
   Run: node tools/validate.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

/* load script.js in a sandbox */
const ctx = { console, window: {} };
vm.createContext(ctx);
vm.runInContext(read('src/script.js') + `
;this.SCRIPT = SCRIPT; this.ENDINGS = ENDINGS; this.CUTAWAYS = CUTAWAYS;
this.CHARS_TABLE = CHARS_TABLE; this.BG_URLS = BG_URLS; this.MF_HOOKS = MF_HOOKS;`,
 ctx, { filename: 'script.js' });
const { SCRIPT, ENDINGS, CUTAWAYS, CHARS_TABLE, BG_URLS } = ctx;

const problems = [];
const labels = new Set();
const usedImages = new Set();

function walk(nodes, insideCut){
  let words = 0, count = 0;
  for (const nd of nodes){
    count++;
    if (!nd) { problems.push('null node'); continue; }
    if (nd.label) labels.add(nd.label);
    if (nd.goto && !insideCut) { /* checked later */ }
    if (nd.bg !== undefined && nd.bg !== 'black'){
      if (!BG_URLS[nd.bg]) problems.push(`unknown bg "${nd.bg}"`);
      else usedImages.add(BG_URLS[nd.bg]);
    }
    if (nd.sp){
      const c = CHARS_TABLE[nd.sp.id];
      if (!c) problems.push(`sprite for unknown char "${nd.sp.id}"`);
      else if (c.spr) usedImages.add(c.spr);
    }
    if (nd.w && !CHARS_TABLE[nd.w]) problems.push(`say node with unknown speaker "${nd.w}"`);
    for (const key of ['t','n']) if (nd[key]) words += nd[key].split(/\s+/).length;
    if (nd.cut){
      if (!nd.cut.label) problems.push('cutaway without label');
      if (!Array.isArray(nd.cut.nodes) || !nd.cut.nodes.length) problems.push(`cutaway "${nd.cut.label}" empty`);
      if (nd.cut.bg && !BG_URLS[nd.cut.bg] && nd.cut.bg!=='black') problems.push(`cutaway "${nd.cut.label}" unknown bg`);
      if (nd.cut.bg && BG_URLS[nd.cut.bg]) usedImages.add(BG_URLS[nd.cut.bg]);
      const sub = walk(nd.cut.nodes, true);
      words += sub.words; count += sub.count;
    }
    if (nd.if){
      for (const b of [nd.if.then, nd.if.els]){
        if (b){ const sub = walk(b, insideCut); words += sub.words; count += sub.count; }
      }
    }
  }
  return { words, count };
}

const stats = walk(SCRIPT, false);

/* second pass: gotos + choice gotos (must be reachable — same array context) */
function checkJumps(nodes, scope){
  for (const nd of nodes){
    if (nd.goto && !labels.has(nd.goto)) problems.push(`goto "${nd.goto}" has no label`);
    if (nd.choice){
      for (const o of nd.choice.opts){
        if (o.goto && !labels.has(o.goto)) problems.push(`choice goto "${o.goto}" has no label`);
        if (!o.goto) problems.push(`choice option without goto: "${(o.t||'').slice(0,30)}"`);
      }
    }
    if (nd.cut) checkJumps(nd.cut.nodes, true);
    if (nd.if){ if(nd.if.then) checkJumps(nd.if.then, scope); if(nd.if.els) checkJumps(nd.if.els, scope); }
  }
}
checkJumps(SCRIPT, false);

/* endings */
for (const [id, e] of Object.entries(ENDINGS)){
  if (!e.name || !e.body) problems.push(`ending "${id}" missing name/body`);
}
const endingRefs = new Set();
(function findEnds(nodes){ nodes.forEach(nd=>{
  if (nd.end) endingRefs.add(nd.end);
  if (nd.cut) findEnds(nd.cut.nodes);
  if (nd.if){ if(nd.if.then) findEnds(nd.if.then); if(nd.if.els) findEnds(nd.if.els); }
});})(SCRIPT);
for (const r of endingRefs) if (!ENDINGS[r]) problems.push(`END("${r}") not in ENDINGS table`);
for (const id of Object.keys(ENDINGS)) if (!endingRefs.has(id)) problems.push(`ending "${id}" is never reached`);

/* assets on disk (logo + title bg referenced from html/css too) */
usedImages.add('assets/img/logo.jpg'); usedImages.add('assets/img/bg_street.jpg');
for (const img of usedImages){
  if (!fs.existsSync(path.join(root, img))) problems.push(`MISSING ASSET: ${img}`);
}

/* report */
console.log(`nodes: ${stats.count}   words: ${stats.words}   labels: ${labels.size}   cutaways: ${CUTAWAYS.length}   endings: ${Object.keys(ENDINGS).length}`);
if (problems.length){
  console.error(`\n✗ ${problems.length} problem(s):`);
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
console.log('✓ script valid');
