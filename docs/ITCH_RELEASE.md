# SHIPPING TO ITCH.IO — MELANCHOLY FALLS

## Build the browser package
```bash
zip -r release/melancholy-falls-ep1.zip index.html src assets
```
The game is 100% self-contained (no CDNs, no fonts fetched, no network calls),
which is exactly what itch's browser player wants.

## Upload (10 minutes, one time)
1. itch.io → **Create new project**.
2. Upload `melancholy-falls-ep1.zip` → tick **"This file will be played in the browser."**
3. Kind of project: **Playable in browser**. Genre: **Visual Novel**.
4. Viewport: **1280 × 720**, enable **fullscreen button** and **mobile friendly**.
5. Visibility: **Public**. Release state: **Released** (or "In development" for a devlog-first launch).
6. Tags: `visual-novel`, `comedy`, `parody`, `interactive-fiction`, `dating-sim` (ironic, still a real tag people browse), `story-rich`.
7. Price: **$4.99 or "Name your own price" with $4.99 suggested.** Episode 1 free-with-tip is also a legit strategy — decide whether Ep 1 is the funnel or the product. (My take: charge. "Free" reads as exactly the anime-slop baseline we're escaping; $4.99 with a funny-but-confident page reads as a real show. You can always add a "pay what you want" sale later.)
8. Cover image: 630×500 (`assets/img/logo.jpg` is a placeholder; we should compose a real cover — Bram golden-hour + logo + "A VERY SERIOUS DRAMA" strapline).
9. Screenshots: the gym dance scene, the cutaway frame, the goose perp walk card. Comedy screenshots sell comedy games.

## Page copy (paste-ready)

**Tagline / short description:**
> A teen drama parody visual novel. Smallville gravity, Family Guy cutaways, zero anime. Every town has secrets. This one has a quarry.

**Full description:**
> **MELANCHOLY FALLS** is a very serious drama about a small town, a wet creek, and the meteor drizzle that ruined everyone's hair.
>
> Bram Wellington feels things. When he feels them, physics feels them too. One sincere compliment can take out a gazebo.
>
> Tuesday Winters is new in town, with a binder of local anomalies and a family secret she'd photograph badly to keep.
>
> Dex Luxury, 24, town billionaire, has been room temperature for sixteen years. He is not over it.
>
> Chad Morgan has been in a coma since the pilot episode of everyone's lives. He wakes up at the worst possible moment. Obviously.
>
> - A fully voiced-in-your-head episode (~25 minutes, 4 endings, one secret)
> - The cutaway gag is a game mechanic. Collect them in the Cutaway Reel.
> - Diegetic DRAMA / SUSPICION / BOND meters. Yes, the town maintains them.
> - Original procedural score. The piano is sad. You will be sad. It's a WB thing.
>
> Episode 1: "PILOT." Episode 2: "FIRED." The town has a lot left in it.

## Post-launch loop that actually works on itch
1. **Devlog from day 1.** Devlogs are itch's only real discovery engine. Post the cutaway reel art, the Drama Meter philosophy, "designing a parody of a genre I love like a brother and hate like a neighbor."
2. **Ship episodes on a cadence you can keep** — quarterly is fine. Each episode is a new devlog wave + a "season pass" price bump.
3. **The demo funnel**: keep Ep 1 paid but post the first 10 minutes as a free "previously on" web demo if conversion is slow.
4. Talk to the parody/parody-humor audience, not the VN audience. The VN tag is where people expect anime; the comedy tag is where people expect us.

## Legal-ish notes (parody edition)
- All parody targets are referred to by archetype, never by name. "The WB aesthetic" is a style, not a trademark use.
- Zero real celebrity names in the script. Keep it that way even when the cutaways beg for them.
- Music is procedurally generated in-code (WebAudio). No licensing surface.
- Font stack is system fonts (Georgia + friends). Nothing to license.
