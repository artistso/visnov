/* Headless smoke test: drives the real game DOM through every branch.
   Run: node tools/smoketest.mjs [endingIndex]
   Plays all four endings by default (truth, creek, goose, casserole). */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script src="([^"]+)"><\/script>/g, ''); // we inject manually in order

const errors = [];

async function playEnding(pickStrategy, label){
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if(!/Could not load img|not implemented/i.test(String(e))) errors.push(label+': '+e.message); });
  vc.on('error', (...a) => errors.push(label+': console.error '+a.join(' ')));
  const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true,
    url:'https://mf.test/index.html', virtualConsole: vc });
  const { window } = dom;
  // silence audio
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, set strokeStyle(v){}, set lineWidth(v){} });
  // real browsers share top-level const across <script> tags; emulate with one concatenated eval
  const bundle = ['src/audio.js','src/script.js','src/engine.js']
    .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
  window.eval(bundle);
  const $ = s => window.document.querySelector(s);
  const clickStage = () => $('#stage').dispatchEvent(new window.Event('pointerdown', {bubbles:true}));
  $('#t-new').dispatchEvent(new window.Event('pointerdown', {bubbles:true})); // ignored
  $('#t-new').click();
  let steps = 0, guard = 6000, endingName = null, choicesSeen = 0;
  while (guard-- > 0){
    if ($('#endscreen:not(.hidden)')){ endingName = $('#endscreen .e-name').textContent; break; }
    const ch = $('#choices:not(.hidden)');
    if (ch){
      choicesSeen++;
      const opts = [...ch.querySelectorAll('button')];
      const opt = pickStrategy(opts, choicesSeen);
      opt.click();
    } else {
      // emulate typing completion + advance
      window.eval('MF_DEBUG.S.typing && (MF_DEBUG.S.typing = false)');
      clickStage();
    }
    steps++;
    if (guard === 1) errors.push(label + ': never reached an ending (steps=' + steps + ')');
  }
  return { endingName, steps, choicesSeen };
}

// strategy per ending. choice #1 sidewalk, #2 creek, #3 mansion, #4 binder, #5 climax.
const climaxPicks = [
  ['truth',     opts => opts[0]],
  ['creek',     opts => opts[1] || opts[0]],
  ['goose',     opts => opts[2] || opts[0]],
  ['casserole', (opts, n) => n === 2 ? opts[2] : (opts[3] || opts[opts.length - 1])],
];

let ok = true;
for (const [want, pick] of climaxPicks){
  const res = await playEnding(pick, want);
  const got = (res.endingName||'').toLowerCase();
  const pass = got.includes(want.slice(0,4)) || got.includes(want);
  if (!pass) ok = false;
  console.log(`${pass?'✓':'✗'} ${want.padEnd(10)} -> "${res.endingName}" in ${res.steps} clicks, ${res.choicesSeen} choices`);
}
if (errors.length){ ok = false; console.log('ERRORS:'); errors.slice(0,20).forEach(e=>console.log('  - '+e)); }
console.log(ok ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
process.exit(ok ? 0 : 1);
