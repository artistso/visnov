# SCRIPTING MELANCHOLY FALLS
*The whole game is text. If you can edit a list, you can write an episode.*

The episode lives in **`src/script.js`**. It's one big array of "nodes."
The engine walks the list and performs each node. That's the entire engine.

## Quick reference

| Node | Writes as | What it does |
|------|-----------|--------------|
| Narration | `n("The creek understood.")` | Italic narration in the box |
| Dialogue | `bram("I meant it.")` | Nameplate + speaker color; any character in `CHARS_TABLE` gets a shorthand |
| Background | `bg('creek')` | Crossfade + Ken Burns drift (ids are the keys of `BG_URLS`) |
| Sprite in | `sp('tuesday','r1')` | Slots: `l2 l1 c r1 r2` |
| Sprite out | `out('tuesday')` or `out('*')` | |
| Freeze-frame card | `card('CHAD MORGAN', 'awake. unfortunately.', true)` | WB lower-third intro; third arg = dramatic sting |
| **Cutaway** | `cut('THE HAIL COW', [ ...nodes ], 'street')` | Record scratch, letterbox, crude doodle mode, runs the mini-scene, wipes back. Auto-unlocks in the gallery. |
| FX | `fx('shake')` | `shake flash sting scratch bell thunk ping whir crash pushon pushoff darkon darkoff rainon rainoff` |
| Meters | `add({drama:10, susp:-5, bond:4, cass:1})` | Diegetic popup; DRAMA/SUSPICION/BOND visible, CASSEROLE hidden |
| Choice | `choice('TITLE', [{t:"option", k:"flavor", add:{...}, flag:'x', goto:'label', if:()=>...}])` | `if` hides the option unless true (how the secret ending gates) |
| Branch | `IF(()=>S_meters().drama>=70, [ nodes ], [ elseNodes ])` | Reads live state |
| Jump / target | `go('act3')` / `lab('act3')` | |
| Ending | `END('truth')` | Must exist in the `ENDINGS` table (name/body/hint/lockHint) |

## Conventions we've settled on
- **Em-dashes and caps for volume.** All-caps = the WB style of saying a normal thing at emergency volume.
- **Cutaways are 2–5 nodes**, one joke, hard out. End on the weirdest line.
- `fx('pushon')` right before a line = slow dramatic push-in. It survives exactly one line.
- `fx('bell')` interrupts anyone about to name the state. Never explained.
- `fx('ping')` whenever a character says the word meteor. The bell of denial.
- New characters: add to `CHARS_TABLE` (name + color + optional `spr` path). No sprite needed — they can be a voice.

## Test before shipping
```bash
node tools/validate.mjs    # labels, gotos, assets, endings all resolve
node tools/smoketest.mjs   # headless browser plays all 4 endings
```

## Art replacement (the whole pipeline)
1. Drop final art into `assets/raw/` with the matching name
   (`bg_quarry.png`, `spr_tuesday.png` — sprites on solid `#FF00FF`, full body).
2. `python3 tools/prep_art.py` — chroma-keys sprites, cover-crops 1920×1080
   backgrounds, builds stand-ins for anything missing.
3. That's it. Same filenames, same game.

Backgrounds: 1920×1080. Sprites: transparent PNG, up to 1600px tall.
