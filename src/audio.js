/* ============================================================
   MELANCHOLY FALLS — procedural audio (WebAudio, zero files)
   Replace later: drop real files in assets/snd/ and hook them
   in SND.play() — every call site stays the same.
   ============================================================ */
'use strict';
const SND = (() => {
  let ctx = null, master = null, muted = false;
  let rainNode = null, rainGain = null;
  let pianoTimer = null, pianoNext = 0, pianoStep = 0;

  function ensure(){
    if (ctx) return true;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
    }catch(e){ return false; }
    return true;
  }
  function resume(){ if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  function setMuted(m){
    muted = m;
    if (ensure()) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  }
  function isMuted(){ return muted; }

  function tone(freq, t0, dur, type='sine', vol=0.2, glideTo=null, dest=null){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur*0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noiseBuffer(sec=1){
    const b = ctx.createBuffer(1, ctx.sampleRate*sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    return b;
  }

  /* ---- one-shots ---- */
  const sfx = {
    tick(){ if(!ensure())return; tone(1750, ctx.currentTime, 0.03, 'square', 0.015); },
    select(){ if(!ensure())return; tone(660, ctx.currentTime, 0.07, 'triangle', 0.08); tone(990, ctx.currentTime+0.06, 0.09, 'triangle', 0.06); },
    /* record scratch: noise + pitch dive */
    scratch(){ if(!ensure())return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.45);
      const f = ctx.createBiquadFilter(); f.type='bandpass'; f.Q.value=2.5;
      f.frequency.setValueAtTime(2200,t); f.frequency.exponentialRampToValueAtTime(180,t+0.42);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.45);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t+0.5);
      tone(700,t,0.4,'sawtooth',0.05,120);
    },
    /* dramatic sting: minor chord swell */
    sting(){ if(!ensure())return;
      const t=ctx.currentTime;
      [220,261.6,311.1,440].forEach((f,i)=>tone(f,t,1.6,'sine',0.10));
      tone(110,t,1.9,'sine',0.14);
      const src=ctx.createBufferSource(); src.buffer=noiseBuffer(1.2);
      const f2=ctx.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=900;
      const g=ctx.createGain(); g.gain.setValueAtTime(0.06,t); g.gain.exponentialRampToValueAtTime(0.0001,t+1.2);
      src.connect(f2); f2.connect(g); g.connect(master); src.start(t); src.stop(t+1.3);
    },
    /* church bell — for when someone almost says the state */
    bell(){ if(!ensure())return;
      const t=ctx.currentTime;
      tone(523.25,t,2.4,'sine',0.22); tone(1046.5,t,1.8,'sine',0.10);
      tone(784,t,1.2,'sine',0.05); tone(513,t,2.0,'sine',0.06);
    },
    /* casserole thunk */
    thunk(){ if(!ensure())return;
      const t=ctx.currentTime;
      tone(140,t,0.18,'sine',0.30,60); tone(90,t,0.25,'sine',0.2);
    },
    /* meteor bell-ish ping */
    ping(){ if(!ensure())return; const t=ctx.currentTime; tone(1567,t,0.9,'sine',0.07,1400); },
    /* WHRRRR helicopter */
    whir(){ if(!ensure())return;
      const t=ctx.currentTime;
      for(let i=0;i<7;i++){ tone(150,t+i*0.16,0.1,'square',0.05,110); }
    },
    crash(){ if(!ensure())return;
      const t=ctx.currentTime;
      const src=ctx.createBufferSource(); src.buffer=noiseBuffer(1.4);
      const f=ctx.createBiquadFilter(); f.type='lowpass';
      f.frequency.setValueAtTime(3000,t); f.frequency.exponentialRampToValueAtTime(120,t+1.2);
      const g=ctx.createGain(); g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.0001,t+1.3);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t+1.4);
      tone(70,t,0.8,'sine',0.3,40);
    }
  };

  /* ---- rain loop ---- */
  function rain(on){
    if (!ensure()) return;
    if (on && !rainNode){
      rainNode = ctx.createBufferSource(); rainNode.buffer = noiseBuffer(3); rainNode.loop = true;
      const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2400; f.Q.value=0.4;
      rainGain = ctx.createGain(); rainGain.gain.value=0;
      rainNode.connect(f); f.connect(rainGain); rainGain.connect(master);
      rainNode.start();
      rainGain.gain.setTargetAtTime(0.12, ctx.currentTime, 1.2);
    } else if (!on && rainNode){
      rainGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8);
      const n = rainNode; setTimeout(()=>{ try{n.stop();}catch(e){} }, 2500);
      rainNode = null;
    }
  }

  /* ---- sad piano loop (Am — F — C — G), gentle, WB-grade moping ---- */
  const CHORDS = [
    [220.0, 261.63, 329.63],        // Am
    [174.61, 220.0, 261.63],        // F
    [130.81, 164.81, 196.0],        // C (voiced low)
    [196.0, 246.94, 293.66]         // G
  ];
  const ARP = [440.0, 523.25, 659.25, 523.25, 440.0, 392.0, 523.25, 659.25];
  function piano(on){
    if (!ensure()) return;
    if (on && !pianoTimer){
      pianoNext = ctx.currentTime + 0.1; pianoStep = 0;
      pianoTimer = setInterval(()=>{
        while (pianoNext < ctx.currentTime + 0.5){
          const stepInChord = pianoStep % 8;
          const chord = CHORDS[Math.floor(pianoStep/8) % 4];
          const t = pianoNext;
          if (stepInChord === 0){
            chord.forEach(f=>tone(f, t, 2.4, 'sine', 0.028));
            tone(chord[0]/2, t, 2.6, 'triangle', 0.020);
          }
          const a = ARP[pianoStep % ARP.length] * (pianoStep % 16 < 8 ? 1 : 0.75);
          tone(a, t, 0.9, 'triangle', 0.035);
          pianoNext += 0.32; pianoStep++;
        }
      }, 200);
    } else if (!on && pianoTimer){
      clearInterval(pianoTimer); pianoTimer = null;
    }
  }

  window.addEventListener('pointerdown', resume, {once:false});

  return { resume, setMuted, isMuted, sfx, rain, piano };
})();
