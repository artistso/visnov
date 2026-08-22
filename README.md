# MELANCHOLY FALLS
### A Very Serious Drama — an absurd teen-drama parody visual novel

*Smallville gravity. Family Guy cutaways. Zero anime.*

**[▶ PLAY THE PREVIEW](http://localhost:8000)** (when the preview server is running) — or open `index.html` in any browser.

---

## What this is
An episodic comedy visual novel for itch.io parodying late-90s/early-00s WB teen
drama. Custom-built, dependency-free web engine (vanilla JS + CSS, ~2.7 MB of
assets, fully self-contained for itch's browser player).

- **Episode 1 "PILOT"** — ~25 minutes, 5,000+ words, 4 endings (1 secret),
  6 collectible cutaway gags, diegetic DRAMA / SUSPICION / BOND meters.
- **The cutaway gag is a gameplay verb** — record scratch, letterbox, crude
  doodle mode, wipe back, "Anyway."
- Procedural WebAudio score & SFX (no audio files, no licensing surface).
- Save/load + autosave, history log, auto-advance, endings & cutaway gallery,
  mobile-friendly scaling, keyboard controls (Space/A/H/Esc).

## Repo map
| Path | What |
|------|------|
| `index.html` | the game shell |
| `src/style.css` | the WB look: grain, vignette, letterbox, golden-hour everything |
| `src/engine.js` | interpreter, UI, save system, cutaway machine |
| `src/audio.js` | procedural piano/scratch/sting/bell/rain |
| `src/script.js` | **Episode 1** — the writing lives here |
| `assets/raw/` | drop final art here (sprites keyed on `#FF00FF`) |
| `assets/img/` | processed art the game loads (auto-generated from raw) |
| `docs/GAME_DESIGN.md` | series bible: cast, comedy rules, season one map |
| `docs/SCRIPTING.md` | how to write episodes |
| `docs/ITCH_RELEASE.md` | build, upload steps, paste-ready store copy |
| `tools/` | `validate.mjs` (script lint), `smoketest.mjs` (plays all 4 endings headless), `prep_art.py` (art pipeline) |

## Working on it
```bash
node tools/validate.mjs     # lint the script (labels, gotos, assets, endings)
node tools/smoketest.mjs    # headless playthrough of every ending
python3 tools/prep_art.py   # rebuild assets/img from assets/raw
zip -r release/melancholy-falls-ep1.zip index.html src assets   # itch package
```

## Art notes (placeholder policy)
Everything in `assets/img/` is placeholder. Backgrounds/logo are painterly
studies; Bram is a keyed render; the rest of the cast is on theatrical
**rehearsal stand-in cue cards** until final art lands. Replace by dropping
files with the same names into `assets/raw/` and running the pipeline.

*Filmed on location in a town that is legally not named. No geese were interviewed.*
