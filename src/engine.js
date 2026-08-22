/* ============================================================
   MELANCHOLY FALLS — tiny VN engine (vanilla JS, no deps)
   Script format lives in src/script.js (see docs/SCRIPTING.md)
   ============================================================ */
'use strict';

(function(){

/* ---------- script registry: give every nested array a stable id ---------- */
const ARR = [];
function register(nodes, depth){
  const id = ARR.length;
  ARR.push(nodes);
  nodes.forEach(n=>{
    if (n && n.cut && Array.isArray(n.cut.nodes)) register(n.cut.nodes, depth+1);
    if (n && n.if){ if(Array.isArray(n.if.then)) register(n.if.then, depth+1);
                    if(Array.isArray(n.if.els)) register(n.if.els, depth+1); }
  });
  return id;
}
const ROOT = register(SCRIPT, 0);          // SCRIPT defined in script.js
const LABELS = {};
ARR.forEach((arr, ai)=>arr.forEach((n,ni)=>{
  if (n && n.label) LABELS[n.label] = { arr: ai, idx: ni };
}));

/* ---------- dom ---------- */
const $ = s => document.querySelector(s);
const stage=$('#stage'), bgA=$('#bg'), bgB=$('#bg2'), spritesEl=$('#sprites'),
  dlg=$('#dlg'), nameplate=$('#nameplate'), textEl=$('#text'), advEl=$('#adv'),
  choicesEl=$('#choices'), hud=$('#hud'), meterPop=$('#meterpop'),
  lower=$('#lowerthird'), flashEl=$('#flash'), cutlabel=$('#cutlabel');

/* ---------- state ---------- */
const S = {
  main: {arr: ROOT, idx: 0},
  stack: [],                    // [{arr, idx, cut?}]
  meters: {drama:0, susp:0, bond:0, cass:0},
  flags: {},
  view: {bg:'', crude:false},
  typing:false, typeTimer:null, fullText:'', ci:0,
  curNode:null, auto:false, autoTimer:null,
  history: [],
  bgToggle:false, rainAnim:null, ended:false
};

/* ---------- settings & persistence ---------- */
const persist = JSON.parse(localStorage.getItem('mf_persist')||'{}');
persist.endings = persist.endings||{}; persist.cutaways = persist.cutaways||{};
let settings = Object.assign({speed:6, auto:5, mute:false}, persist.settings||{});
function savePersist(){ persist.settings = settings; localStorage.setItem('mf_persist', JSON.stringify(persist)); }

const CHARS = (typeof CHARS_TABLE!=='undefined') ? CHARS_TABLE : {};

/* ---------- scaling ---------- */
function fit(){
  const s = Math.min(innerWidth/1280, innerHeight/720);
  stage.style.setProperty('--sscale', s);
  stage.style.transform = `scale(${s})`;
  stage.style.setProperty('--sx','0px');
}
addEventListener('resize', fit); fit();

/* ---------- audio glue ---------- */
function A(name){
  if (settings.mute) return;
  if (name==='rainon') return SND.rain(true);
  if (name==='rainoff') return SND.rain(false);
  if (name==='musicon') return SND.piano(true);
  if (name==='musicoff') return SND.piano(false);
  if (SND.sfx[name]) SND.sfx[name]();
}

/* ---------- backgrounds ---------- */
function setBG(id){
  if (S.view.bg === id) return;
  S.view.bg = id;
  const url = BG_URLS[id];
  const showEl = S.bgToggle ? bgA : bgB;
  const hideEl = S.bgToggle ? bgB : bgA;
  S.bgToggle = !S.bgToggle;
  if (!url){ bgA.classList.remove('on'); bgB.classList.remove('on'); return; }
  showEl.style.backgroundImage = `url("${url}")`;
  // force reflow so kenburns restarts
  showEl.style.animation='none'; void showEl.offsetWidth; showEl.style.animation='';
  showEl.classList.add('on'); hideEl.classList.remove('on');
}

/* ---------- sprites ---------- */
function addSprite(id, slot){
  const ch = CHARS[id]||{};
  if (!ch.spr) return;
  let el = spritesEl.querySelector(`.sprite[data-id="${id}"]`);
  if (el){ el.className = `sprite pos-${slot||'c'}`; return; }
  el = document.createElement('div');
  el.className = `sprite enter pos-${slot||'c'}`;
  el.dataset.id = id;
  const img = document.createElement('img');
  img.src = ch.spr; img.alt = ch.name||id; img.draggable = false;
  el.appendChild(img); spritesEl.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('enter')));
}
function outSprite(id){
  const sel = id==='*' ? '.sprite' : `.sprite[data-id="${id}"]`;
  spritesEl.querySelectorAll(sel).forEach(el=>{
    el.classList.add('exit');
    setTimeout(()=>el.remove(), 600);
  });
}
function focusSprite(id){
  spritesEl.querySelectorAll('.sprite').forEach(el=>{
    el.classList.toggle('dim', !!id && el.dataset.id!==id);
  });
}

/* ---------- fx ---------- */
function fx(name){
  switch(name){
    case 'shake': stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); break;
    case 'flash': flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); break;
    case 'pushon': stage.classList.add('push'); S.pushUsed=false; break;
    case 'pushoff': stage.classList.remove('push'); break;
    case 'darkon': stage.classList.add('dark'); break;
    case 'darkoff': stage.classList.remove('dark'); break;
    default: A(name);
  }
}

/* ---------- meters ---------- */
function setMeterUI(){
  const map = {drama:'#m-drama', susp:'#m-susp', bond:'#m-bond'};
  for (const k in map){
    const el = $(map[k]+' .m-fill');
    if (el) el.style.width = Math.min(100, Math.max(0, S.meters[k]||0)) + '%';
  }
}
function addMeters(m){
  const names = {drama:'DRAMA', susp:'SUSPICION', bond:'BOND', cass:'CASSEROLE'};
  for (const k in m){
    const before = S.meters[k]||0;
    S.meters[k] = Math.min(100, Math.max(0, before + m[k]));
    if (m[k] !== 0){
      const p = document.createElement('div');
      p.className = `mpop ${k==='cass'?'cass':k}`;
      p.textContent = `${m[k]>0?'+':''}${m[k]} ${names[k]||k.toUpperCase()}`;
      meterPop.appendChild(p);
      requestAnimationFrame(()=>p.classList.add('on'));
      setTimeout(()=>p.remove(), 2300);
    }
  }
  setMeterUI();
}

/* ---------- dialogue ---------- */
function charMs(){ const v = settings.speed; return v>=10 ? 4 : Math.max(4, 86 - v*8); }
function say(who, txt){
  const ch = CHARS[who]||{name:who||'', color:'#e6c88a'};
  dlg.classList.remove('hidden');
  if (stage.classList.contains('push') && !S.pushUsed){ S.pushUsed = true; }   // push survives exactly one line
  else { stage.classList.remove('push'); }
  if (who && who!=='narr'){ nameplate.style.display='block'; nameplate.textContent = ch.name;
    nameplate.style.color = ch.color||'#e6c88a'; nameplate.style.borderColor = ch.color||'#c8a15a';
    textEl.classList.remove('narr');
  } else { nameplate.style.display='none'; textEl.classList.add('narr'); }
  focusSprite(who && who!=='narr' ? who : null);
  S.fullText = txt; S.ci = 0; S.typing = true;
  advEl.classList.remove('on');
  textEl.textContent = '';
  clearTimeout(S.typeTimer);
  const ms = charMs();
  (function tick(){
    if (!S.typing) return;
    if (S.ci >= S.fullText.length){ finishLine(); return; }
    S.ci++;
    textEl.textContent = S.fullText.slice(0, S.ci);
    S.typeTimer = setTimeout(tick, ms);
  })();
}
function finishLine(){
  S.typing = false; clearTimeout(S.typeTimer);
  textEl.textContent = S.fullText;
  advEl.classList.add('on');
  if (S.auto){
    clearTimeout(S.autoTimer);
    const wait = 900 + S.fullText.length * (42 - settings.auto*3);
    S.autoTimer = setTimeout(()=>{ if (S.auto && !S.typing && S.curNode) advance(); }, Math.max(800, wait));
  }
}
function hideDlg(){ dlg.classList.add('hidden'); }

/* ---------- history ---------- */
function pushHistory(who, txt){
  const ch = CHARS[who]||{};
  S.history.push({ name: (who && who!=='narr') ? ch.name||who : '', txt, narr: !who || who==='narr' });
  if (S.history.length > 250) S.history.shift();
}

/* ---------- save / load ---------- */
function snapshot(){
  return {
    v:1, t:Date.now(),
    main:{...S.main}, stack:S.stack.map(e=>({arr:e.arr, idx:e.idx, cut:e.cut||false})),
    meters:{...S.meters}, flags:{...S.flags}, bg:S.view.bg,
    sprites:[...spritesEl.querySelectorAll('.sprite')].map(el=>({id:el.dataset.id, slot:[...el.classList].find(c=>c.startsWith('pos-'))?.slice(4)||'c'})),
    crude:stage.classList.contains('crude'), letter:stage.classList.contains('letterbox'),
    hist:S.history.slice(-80)
  };
}
function saveSlot(i){
  localStorage.setItem('mf_save_'+i, JSON.stringify(snapshot()));
  A('select');
}
function loadSlot(i){
  const raw = localStorage.getItem('mf_save_'+i);
  if (!raw) return false;
  const d = JSON.parse(raw);
  S.main = d.main; S.stack = d.stack||[]; S.meters = d.meters; S.flags = d.flags||{};
  S.history = d.hist||[]; S.ended=false;
  hideAllScreens(); hud.classList.add('on');
  spritesEl.innerHTML=''; stage.classList.remove('crude','letterbox','push','dark','rainon');
  $('#rainlayer').classList.remove('on'); SND.rain(false);
  if (d.crude) stage.classList.add('crude');
  if (d.letter) stage.classList.add('letterbox');
  (d.sprites||[]).forEach(sp=>addSprite(sp.id, sp.slot));
  setBG(d.bg||'black');
  setMeterUI();
  dlg.classList.remove('hidden');
  A('tick'); S.auto=false; $('#b-auto').classList.remove('on');
  step();
  return true;
}
function autosave(){ try{ localStorage.setItem('mf_save_0', JSON.stringify(snapshot())); }catch(e){} }

/* ---------- screens ---------- */
function hideAllScreens(){
  ['#title','#settings','#history','#saveload','#gallery','#endscreen','#cutplayer'].forEach(s=>$(s).classList.add('hidden'));
  choicesEl.classList.add('hidden');
}
function showTitle(){
  hideAllScreens(); hud.classList.remove('on');
  $('#title').classList.remove('hidden');
  $('#t-cont').style.display = localStorage.getItem('mf_save_0') ? '' : 'none';
  setBG('street'); SND.rain(false);
}

/* ---------- cutaway (Family Guy machine) ---------- */
function startCutaway(c){
  A('scratch');
  stage.classList.add('letterbox','crude');
  stage.classList.remove('push');
  cutlabel.textContent = c.label||'';
  cutlabel.classList.add('on');
  hideDlg(); focusSprite(null);
  if (c.bg) setBG(c.bg);
  persist.cutaways[cutId(c.label)] = true; savePersist();
  S.stack.push({arr: ARR.indexOf(c.nodes), idx:0, cut:true});
  step();
}
function endCutaway(){
  cutlabel.classList.remove('on');
  stage.classList.remove('letterbox','crude');
  A('scratch');
  focusSprite(null);
}
function cutId(label){ return (label||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40); }

/* ---------- interpreter ---------- */
function currentNode(){
  const top = S.stack[S.stack.length-1];
  if (top){
    if (top.idx < ARR[top.arr].length) return {node: ARR[top.arr][top.idx], frame: top};
    return null;
  }
  if (S.main.idx < ARR[S.main.arr].length) return {node: ARR[S.main.arr][S.main.idx], frame: S.main};
  return null;
}
function advanceFrame(frame){
  frame.idx++;
  if (frame !== S.main && frame.idx >= ARR[frame.arr].length){
    // pop finished stack frame
    S.stack.pop();
    if (frame.cut) endCutaway();
  }
}
function step(){
  if (S.ended) return;
  let guard = 0;
  while (guard++ < 500){
    const cur = currentNode();
    if (!cur){ return; }                       // script exhausted (shouldn't happen; endings end explicitly)
    const n = cur.node, frame = cur.frame;
    S.curNode = n;

    // non-blocking nodes
    if (n.label !== undefined){ advanceFrame(frame); continue; }
    if (n.bg !== undefined){ setBG(n.bg); advanceFrame(frame); continue; }
    if (n.sp){ addSprite(n.sp.id, n.sp.slot); if(n.sp.jolt){const el=spritesEl.querySelector(`.sprite[data-id="${n.sp.id}"]`); if(el){el.classList.remove('jolt'); void el.offsetWidth; el.classList.add('jolt');}} advanceFrame(frame); continue; }
    if (n.out !== undefined){ outSprite(n.out); advanceFrame(frame); continue; }
    if (n.focus !== undefined){ focusSprite(n.focus); advanceFrame(frame); continue; }
    if (n.fx){ (Array.isArray(n.fx)?n.fx:[n.fx]).forEach(fx); if(n.fx.includes('pushon')){} advanceFrame(frame); continue; }
    if (n.add){ addMeters(n.add); advanceFrame(frame); continue; }
    if (n.flag){ S.flags[n.flag]=true; advanceFrame(frame); continue; }
    if (n.music){ A(n.music==='on'?'musicon':'musicoff'); advanceFrame(frame); continue; }
    if (n.hidedlg){ hideDlg(); advanceFrame(frame); continue; }

    if (n.if){
      const branch = n.if.cond() ? n.if.then : n.if.els;
      advanceFrame(frame);
      if (branch && branch.length) S.stack.push({arr: ARR.indexOf(branch), idx:0});
      continue;
    }
    if (n.goto){ const L = LABELS[n.goto]; if(!L){console.error('no label', n.goto); return;}
      if (frame===S.main){ S.main = {arr:L.arr, idx:L.idx}; } else { frame.arr=L.arr; frame.idx=L.idx; }
      continue; }

    // blocking nodes
    if (n.w !== undefined || n.n !== undefined){ say(n.w, n.n!==undefined ? n.n : n.t); pushHistory(n.w, n.n!==undefined?n.n:n.t); autosave(); return; }
    if (n.card){ showCard(n.card); return; }
    if (n.cut){ advanceFrame(frame); startCutaway(n.cut); return; }
    if (n.choice){ showChoices(n.choice); return; }
    if (n.end){ doEnding(n.end); return; }
    if (n.wait){ setTimeout(()=>{ advanceFrame(frame); step(); }, n.wait); return; }

    console.error('unknown node', n); advanceFrame(frame);
  }
}
function advance(){
  if (S.typing){ finishLine(); return; }
  const n = S.curNode;
  if (!n || n.choice || n.end) return;
  A('tick');
  const cur = currentNode(); if (cur) advanceFrame(cur.frame);
  step();
}

/* ---------- lower third ---------- */
function showCard(c){
  stage.classList.remove('push');
  lower.querySelector('.lt-name').textContent = c.name;
  lower.querySelector('.lt-sub').textContent = c.sub||'';
  lower.classList.add('on');
  if (c.sting) A('sting');
  hideDlg();
}

/* ---------- choices ---------- */
function showChoices(ch){
  stage.classList.remove('push');
  hideDlg(); advEl.classList.remove('on');
  choicesEl.innerHTML = '';
  if (ch.title){ const t=document.createElement('div'); t.className='c-title'; t.textContent=ch.title; choicesEl.appendChild(t); }
  ch.opts.filter(o=>!o.if||o.if()).forEach((o,i)=>{
    const b = document.createElement('button');
    b.innerHTML = `<span>${o.t}</span>` + (o.k?`<span class="k">${o.k}</span>`:'');
    b.onclick = (e)=>{ e.stopPropagation(); pickChoice(o); };
    choicesEl.appendChild(b);
  });
  choicesEl.classList.remove('hidden');
  A('sting');
}
function pickChoice(o){
  choicesEl.classList.add('hidden');
  A('select');
  if (o.add) addMeters(o.add);
  if (o.flag) S.flags[o.flag] = true;
  const cur = currentNode(); if (cur) advanceFrame(cur.frame);
  if (o.goto){ const L = LABELS[o.goto]; if (L){ if (S.stack.length){ const f=S.stack[S.stack.length-1]; f.arr=L.arr; f.idx=L.idx; } else S.main={arr:L.arr, idx:L.idx}; } }
  step();
}

/* ---------- endings ---------- */
function doEnding(id){
  S.ended = true;
  const e = ENDINGS[id]||{name:'???', body:''};
  persist.endings[id] = true; savePersist();
  const count = Object.keys(persist.endings).length;
  SND.rain(false); A('sting');
  $('#endscreen .e-name').textContent = `ENDING: “${e.name}”`;
  $('#endscreen .e-body').textContent = e.body;
  $('#endscreen .e-unlock').textContent = `ENDINGS FOUND: ${count} / ${Object.keys(ENDINGS).length} — “TO BE CONTINUED” MEANS IT`;
  hideAllScreens(); hud.classList.remove('on');
  $('#endscreen').classList.remove('hidden');
  stage.classList.remove('crude','letterbox','push','dark');
  localStorage.removeItem('mf_save_0');
}

/* ---------- rain canvas ---------- */
const rcv = $('#raincv'), rctx = rcv.getContext('2d');
const drops = Array.from({length:130},()=>({x:Math.random()*1280,y:Math.random()*720,l:8+Math.random()*14,v:9+Math.random()*8}));
function rainLoop(){
  if (!stage.classList.contains('rainon')){ rctx.clearRect(0,0,1280,720); S.rainAnim=null; return; }
  rctx.clearRect(0,0,1280,720);
  rctx.strokeStyle='rgba(200,215,235,.5)'; rctx.lineWidth=1.4;
  drops.forEach(d=>{
    rctx.beginPath(); rctx.moveTo(d.x,d.y); rctx.lineTo(d.x-3,d.y+d.l); rctx.stroke();
    d.y+=d.v; d.x-=1.6; if(d.y>720){d.y=-20;d.x=Math.random()*1340;}
  });
  S.rainAnim = requestAnimationFrame(rainLoop);
}
function setRain(on){
  $('#rainlayer').classList.toggle('on', on);
  stage.classList.toggle('rainon', on);
  if (on && !S.rainAnim) S.rainAnim = requestAnimationFrame(rainLoop);
  A(on?'rainon':'rainoff');
}
const _fx = fx;
fx = function(name){
  if (name==='rainon') return setRain(true);
  if (name==='rainoff') return setRain(false);
  _fx(name);
};

/* ---------- input ---------- */
stage.addEventListener('pointerdown', e=>{
  if (e.target.closest('button, #hud, .panel, .screen:not(.hidden), #choices:not(.hidden)')) return;
  SND.resume();
  if (!S.ended && !$('#title').classList.contains('hidden')) return;
  if (document.querySelector('.screen:not(.hidden)')) return;
  if (S.typing){ finishLine(); return; }
  advance();
});
addEventListener('keydown', e=>{
  if (e.key===' '||e.key==='Enter'){
    if (document.querySelector('.screen:not(.hidden)')) return;
    e.preventDefault(); if (S.typing) finishLine(); else advance();
  }
  if (e.key==='a'||e.key==='A') $('#b-auto').click();
  if (e.key==='h'||e.key==='H') $('#b-log').click();
  if (e.key==='Escape'){
    ['#settings','#history','#saveload','#gallery','#cutplayer'].forEach(s=>$(s).classList.add('hidden'));
  }
});

/* ---------- hud buttons ---------- */
$('#b-auto').onclick = ()=>{ S.auto=!S.auto; $('#b-auto').classList.toggle('on',S.auto);
  if (S.auto && !S.typing) finishLine(); };
$('#b-log').onclick = ()=>{
  const list = $('#histlist'); list.innerHTML='';
  S.history.slice(-100).forEach(h=>{
    const d = document.createElement('div');
    d.className = 'h-line'+(h.narr?' narr':'');
    d.innerHTML = (h.name?`<b>${h.name}</b>`:'') + h.txt.replace(/</g,'&lt;');
    list.appendChild(d);
  });
  $('#history').classList.remove('hidden');
};
$('#b-save').onclick = ()=>{ openSaveLoad(false); };

/* ---------- save/load screen ---------- */
function openSaveLoad(saveMode){
  $('#sl-title').textContent = saveMode ? 'SAVE' : 'SAVE / LOAD';
  const slots = $('#slots'); slots.innerHTML='';
  for (let i=0;i<4;i++){
    const raw = localStorage.getItem('mf_save_'+i);
    const d = raw?JSON.parse(raw):null;
    const el = document.createElement('div'); el.className='slot';
    const label = i===0 ? 'AUTOSAVE' : `SLOT ${i}`;
    el.innerHTML = `<b>${label}</b>` + (d?`<span class="s-meta">${new Date(d.t).toLocaleString()}</span>`:`<span class="s-meta">— empty —</span>`);
    const ops = document.createElement('div'); ops.className='s-ops';
    if (d && !saveMode){ const b=document.createElement('button'); b.textContent='LOAD';
      b.onclick=(e)=>{e.stopPropagation(); if(loadSlot(i)) hideAllScreens();}; ops.appendChild(b); }
    if (d){ const b=document.createElement('button'); b.textContent='ERASE';
      b.onclick=(e)=>{e.stopPropagation(); localStorage.removeItem('mf_save_'+i); openSaveLoad(saveMode);}; ops.appendChild(b); }
    el.appendChild(ops);
    slots.appendChild(el);
  }
  $('#saveload').classList.remove('hidden');
}

/* ---------- gallery ---------- */
function openGallery(){
  const ge = $('#gal-endings'); ge.innerHTML='';
  Object.entries(ENDINGS).forEach(([id,e])=>{
    const got = persist.endings[id];
    const d = document.createElement('div'); d.className='g-ending'+(got?'':' locked');
    d.innerHTML = got?`“${e.name}”<span class="g-sub">${e.hint||''}</span>`:`??? <span class="g-sub">${e.lockHint||'keep playing'}</span>`;
    ge.appendChild(d);
  });
  const gc = $('#gal-cutaways'); gc.innerHTML='';
  const seen = Object.keys(persist.cutaways);
  if (!seen.length){ gc.innerHTML='<span style="color:#6d6558;font-style:italic">No cutaways yet. They find you. It’s what they do.</span>'; }
  CUTAWAYS.forEach(c=>{
    const got = persist.cutaways[cutId(c.label)];
    const b = document.createElement('button'); b.textContent = got? c.label : '█'.repeat(Math.min(18,c.label.length));
    if (!got){ b.style.opacity=.45; }
    b.onclick = ()=>{ playCutaway(c); };
    gc.appendChild(b);
  });
  $('#gallery').classList.remove('hidden');
}
function playCutaway(c){
  const st = $('#cutstage'); st.innerHTML='';
  c.nodes.forEach(n=>{
    const d = document.createElement('div'); d.className='cl';
    const who = n.w ? (CHARS[n.w]?.name||n.w) : null;
    d.innerHTML = (who?`<b>${who}:</b> `:'') + (n.t||n.n||'');
    st.appendChild(d);
  });
  $('#gallery').classList.add('hidden');
  $('#cutplayer').classList.remove('hidden');
  const cls = [...st.querySelectorAll('.cl')]; let i=0;
  const showNext = ()=>{ if (i>0) cls[i-1].classList.remove('on'); if (i<cls.length){ cls[i].classList.add('on'); i++;
      st.onclick=(e)=>{e.stopPropagation(); showNext();}; } else { st.onclick=null; } };
  showNext();
}
$('#cutclose').onclick = ()=>{ $('#cutplayer').classList.add('hidden'); openGallery(); };

/* ---------- title / settings wiring ---------- */
function beginGame(){
  hideAllScreens();
  S.main={arr:ROOT, idx:0}; S.stack=[]; S.meters={drama:0,susp:0,bond:0,cass:0}; S.flags={};
  S.history=[]; S.ended=false; S.view.bg='';
  spritesEl.innerHTML=''; stage.className='';
  $('#rainlayer').classList.remove('on'); SND.rain(false);
  setMeterUI(); hud.classList.add('on');
  A('musicon');
  step();
}
$('#t-new').onclick = ()=>{ SND.resume(); A('select'); beginGame(); };
$('#t-cont').onclick = ()=>{ SND.resume(); A('select'); if(loadSlot(0)) hideAllScreens(); };
$('#t-load').onclick = ()=>{ SND.resume(); openSaveLoad(false); };
$('#t-gallery').onclick = ()=>{ SND.resume(); openGallery(); };
$('#t-settings').onclick = ()=>{ SND.resume(); $('#settings').classList.remove('hidden'); };
document.querySelectorAll('.panel .close').forEach(b=>b.onclick=()=>{
  const p = b.closest('.screen');
  if (p.id==='settings'||p.id==='history'||p.id==='saveload'){ p.classList.add('hidden'); return; }
  if (p.id==='gallery'){ p.classList.add('hidden'); if ($('#title').classList.contains('hidden') && S.ended===false) {} }
  p.classList.add('hidden');
});
$('#s-speed').value = settings.speed;
$('#s-auto').value = settings.auto;
const muteBtn = $('#s-mute');
function muteUI(){ muteBtn.textContent = settings.mute?'OFF':'ON'; muteBtn.style.color = settings.mute?'#e08a8a':''; }
muteUI(); SND.setMuted(settings.mute);
$('#s-speed').oninput = e=>{ settings.speed=+e.target.value; savePersist(); };
$('#s-auto').oninput = e=>{ settings.auto=+e.target.value; savePersist(); };
muteBtn.onclick = ()=>{ settings.mute=!settings.mute; SND.setMuted(settings.mute); savePersist(); muteUI();
  if (!settings.mute){ SND.piano(true); } };

/* ---------- boot ---------- */
if (typeof MF_HOOKS !== 'undefined'){
  MF_HOOKS.getMeters = () => S.meters;
  MF_HOOKS.getFlags = () => Object.keys(S.flags);
}
setBG('street');
showTitle();
window.MF_DEBUG = { step, S, ARR, LABELS };

})();
