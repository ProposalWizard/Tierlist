# v0.24 part B — the 3D walk-around (build plan, not built)

Source: Harry's "HUGE UPDATES" review, 1 Oct (points P58–P60, P70, P97, plus P49 on faces).
- P59: "if you can get the textures right on that, that is unreal … garden … house … push that as a side thing."
- P60: "use that for the manager signing."
- P97: "instead of the My stuff, the 3D area … as your home … your garage and your home."
- P70: the boss meeting and the phone purchase, "like a 3D Blender".
- P49: no real photo faces on 3D figures, except your own player.

## 1. What exists today

**3D shop test page** (`/star-shop3d-dev`). It sits only on branch `harry-test-shop3d`, commit 6e37170. It is not on main.
- **What you do:** walk a footballer round a small shop and open a card at each display (boots wall, a car on a turntable, a can fridge, a counter). Buying is pretend; nothing is saved.
- **Controls:** a thumb stick bottom-left on a phone; WASD or the arrows on a computer; drag the view to swing the camera round.
- **Figure:** a free public-domain (CC0) Quaternius body with a kit painted on by a shader. He wears the club colours, number 10 and short hair, and has 4 moves: idle, walk, jog, reach.
- **Room and textures:** the room is plain boxes. Its textures (floor, signs) are painted in code at load time. The car is a simple wedge.
- **Download:** 1.3 MB of models, plus three.js fetched from jsDelivr when the page opens.
- **Quality setting:** "high" turns shadows on and draws 1.5× pixels. `?q=low` turns shadows off and draws 1× pixels.
- **Honest weak spots (v0.20 page):** the body is a muscly superhero shape, the car is a wedge and the room is plain.
- **Frame rate:**
  - Measured: 1–2 frames a second on the test machine, which has no graphics chip, so this number says nothing about phones.
  - Never run on a real phone.
  - "30+ on a phone" is reasoned, not measured.
  - The page can report its draw calls and triangles, but nobody has recorded those numbers yet.

**Blender shop pictures** (`tools/blender-shop/`).
- **What they are:** 45 still renders: 7 boots × 5 levels, the Sports Car ladder and the House ladder.
- **How they were made:** every model is built in Python, nothing downloaded. Cycles on the CPU, 20–137 s per picture.
- **Seen:** Harry called them "unbelievable".
- **What they are not:** pictures, not 3D models, and not in the game.
- **Catch:** the houses use Blender's built-in brick pattern. That pattern cannot be exported to the web as it is; it has to be "baked" into an image first.

**Blender footballer** (`tools/blender-footballer/`, `/star-blender-dev`).
- The same CC0 body, with real modelled kit pieces (shirt, shorts, socks, boots), 4 hair styles and 3 skin tones.
- It is a far better footballer than the shop page's painted-on kit.
- Today it only outputs pictures and videos (`public/star/blender/`, 2.2 MB).

**Signing scene** (`SigningScene.tsx`).
- A flat 2D drawing: you and the manager at a desk, tap to sign, then a handshake.
- The manager wears a generated photo face (`fakeFaceFor`), which breaks Harry's P49 rule.

**My stuff** (`StyleShop.tsx`, `ShopPage.tsx`). In v0.23 it sits behind a button on the Style page, after the strip was removed.

## 2. The pipeline: "getting the textures right"

1. **Model in code.** Each model is a `bpy` script, the way `tools/blender-shop` already works. Materials use only Blender's standard material (Principled BSDF), which the web format understands.
2. **Bake.** Patterns, dirt and the soft shadows in corners are baked into one image per object: 1024 px for big things, 512 px for small ones. Rooms that never move can have their lighting baked in too, so a phone draws them with almost no light maths. This step is what makes it look like the renders.
3. **Export.** Export a `.glb` file with Blender's own exporter, using its Draco mesh squeeze and WebP images. No new tools are needed on the site.
4. **Load.** The page loads the file with three.js's model loader. The Draco decoder comes from the same CDN.

**Size budget per phone screen (reasoned, to be checked on a phone):**
- First open of any 3D screen: 3 MB or less, including three.js (about 170 KB zipped).
- Character: 1 MB or less.
- Each room: 1.5 MB or less.
- Each car or house: 300 KB or less.
- Per frame: 150k triangles or fewer and 100 draw calls or fewer.
- Pixel ratio capped at 1.5. Target: 30 fps on a mid-range phone.
- Load only when the screen opens; never on the Home page.

**Fallback when WebGL is missing, the CDN fails or the phone is too slow:**
- Check for WebGL before downloading anything.
- If it is missing or the download fails, show today's 2D screen: the drawn signing scene, or the My stuff grid with the Blender stills.
- If a phone averages under 20 fps for 3 seconds, switch to low quality.
- Settings' existing 3D/2D "Player look" switch also forces 2D.

**Your player in 3D:**
- Export the Blender footballer, with its real kit pieces, as one `.glb`.
- Kit colours are swapped live in the shader, the way the shop page's `kit.ts` already does, so one file covers every club.
- Squad number and skin tone come from your career.
- Hair: one of the 4 styles.

**Faces:**
- Everyone else (managers, staff) gets a modelled game face with a skin tone and hair picked from their name. No photos (P49).
- Your own player is the one open question (Q4).

**Licences:**
- Models are built in code.
- The only downloaded files are the Quaternius body, hair and moves, all CC0 and recorded in `public/star/shop3d/LICENSE.txt` and `tools/blender-footballer/LICENSE-Quaternius-UBC.txt`.
- Anything new from outside must be CC0 or similar and get a line in a LICENSE file before it is used.
- No real brands or club marks in the models.

## 3. The three uses

**(a) Manager signing in 3D — size M (camera-on-rails) or L (you walk it)**
- **The scene:** an office in club colours, a desk and two chairs.
- **The walk-in:**
  - M version: the camera follows you in on a fixed path.
  - L version: you walk to the desk with the stick, as in the shop.
- **Signing:** you sit, and the contract stays as page text over the 3D (the real terms, tap to sign). Then a handshake.
- **The handshake is the hard part:** the free moves include no handshake. Two figures' hands must meet, so the move has to be keyed in Blender.
- **The manager:** the same body in a modelled suit, with a modelled face. No photo.
- **Fallback:** Skip and the 2D scene stay.

**(b) Your home and garage as "My stuff" — size L overall; first slice M**
- **What it shows:** a 3D window at the bottom of the Style page (P97). Your house, as the House ladder model for your level, and the garage with your car at its level.
- **Using it:** tap an object to open the existing item sheet (`ShopSheet`). An empty bay shows "Buy a car", which opens the Cars tab.
- **Data:** it reads what you own from the career (owned items and lifestyle levels). Nothing new is saved.
- **The catch:** only 2 of the 31 Style families have models (car-3, house-1), plus the boots. Every other family needs models: a phone and watch on a shelf, other cars, other homes, the garden, then the jet and villa. That is the L.
- **First slice:** house + garage + the car you own, with a camera you swipe round.
- **Battery:** draw only while the window is on screen, and stop when the tab is hidden.

**(c) Boss meeting and phone purchase — size S each if pre-rendered, M if live 3D**
- Recommend Blender renders and short pre-rendered clips first, not live 3D.
- The boss-meeting cards become rendered pictures.
- Buying the phone gets a short 3D "unboxing" clip: the phone turns and the screen lights up.
- That gives the "3D Blender" look at zero performance risk.
- "Play a game first, then the shop unlocks" (P70) is a game-flow change for part A, not 3D.

## 4. Constraints

**three.js comes from a CDN, not npm, unless Harry says yes.** The trade-off:

| | CDN (today) | npm package |
|---|---|---|
| Site packages | No change; nothing added to the site's code | One new package (three.js is free, MIT) |
| If jsDelivr is down or blocked | The 3D breaks and the 2D fallback shows | Not affected |
| Code checking | No type checking: the code uses `any` | Typed, so the type-checker catches mistakes |
| Version | Pinned by hand (0.169.0) | Pinned in the package file |

Either way it loads only on the 3D screens. My recommendation is npm before 3D reaches a real career screen. CDN is fine while these stay test pages.

The exact question: **"Can we add three.js (free 3D library) to the site's packages, so the 3D home and signing don't depend on an outside website? Yes / No."**

**The match engine is not touched.**
- None of these scenes plays football: no ball, no match.
- The one-engine rule is about football screens, so it does not cover them.
- No file in `lib/star/canvasEngine.ts`, `CanvasMatch`/`EnginePlay` or the guard changes.
- Reasoned, not run: the build guard should not flag them as long as each scene uses three's own render loop and keeps the 2D texture painting in a separate file. That is how the shop page is laid out (`scene.ts` and `textures.ts`).

**No new saves.** Everything reads the existing career. The only exception would be a "last camera angle" convenience, kept in browser storage.

**Shared files:**
- The 3D lives in its own folder (`lib/star/home3d/`, `lib/star/signing3d/`).
- `app/star-dev/page.tsx` only gets a swap: the 3D or the 2D component.

## 5. Phases (each step is filmed on a phone screen; Harry judges by eye before the next step)

| # | Phase | Output | Model |
|---|---|---|---|
| 1 | **Pipeline proof.** Export the House L3 and the Sports Car L3 from the existing scripts with baked textures, as GLB files. Show them in a test page. Measure the file size, fps and draw calls on a real phone. | Before/after: still render vs the live 3D model | Top (baking/export) |
| 2 | **Footballer to the web.** The Blender footballer as a recolourable GLB, replacing the superhero body in the shop page. | Clip: club switch, walk | Top (shader/rig) |
| 3 | **Look prototype: home + garage** (throwaway copy). | Phone-size film, 2–3 camera/lighting options | Everyday (building from the agreed look) |
| 4 | **Look prototype: signing office.** Manager figure, handshake move. | Film; M vs L walk-in shown side by side | Top (handshake move); everyday (room) |
| 5 | **Build for real**, after Harry's picks: Style page window, signing swap, 2D fallbacks. | Before/after films via `scripts/film/rec.mjs` | Everyday (UI); top for perf fixes |
| 6 | **Boss/phone renders + unboxing clip.** | Renders in place, filmed | Everyday |
| 7 | **More Style families** modelled, one family at a time. | Contact sheet per family | Everyday |

Playtest every phase with `star-playtest` (everyday model).

## 6. Questions for Harry (one-word answers)

1. Add three.js as a site package instead of the CDN? **Yes / No**
2. Signing: walk in yourself, or the camera walks you in? **Walk / Camera**
3. Home window: on the Style page bottom, or its own "Home" tab? **Style / Tab**
4. Your own player's face in 3D: your photo on the 3D head, or a modelled face matched to your skin and hair? **Photo / Modelled**
5. Boss meeting and phone: rendered pictures and clips first, or live 3D? **Rendered / Live**
6. First slice of the home: house + garage + car only, then grow? **Yes / No**
7. Keep the shop page's free "superhero" body for now, or swap to the Blender footballer first (phase 2)? **Keep / Swap**

---

## 7. Added from the v0.23 review with Mikey (1 Oct, `playtest-notes/v023rev-1001/points.md` P57, P72, P90)

P57: "What if it creates a 3D model version of your head when you take a picture and then just puts that head on the body? … you can just have set bodies and it just puts your head on that. I don't know how much space that would take up."

This is Harry answering his own question 4 (Photo / Modelled) with a third option: **your photo becomes a 3D head**, on the set body from phase 2. Three ways to do it, all reasoned, none tried:

| Way | How | Size per player | Looks | Risk |
|---|---|---|---|---|
| **A. Photo wrapped on a stock head** | The face from your photo (the face scan already cuts it out, `faceScan.ts`) painted onto the front of one shared head model; skin tone picked from the photo for the rest of the head | About 50–100 KB (one image), the head model is shared | Good from the front and three-quarter view; flat from the side | Low. All in the browser, nothing sent anywhere |
| **B. Photo to 3D head by an AI service** | Send the photo once to an image-to-3D service, get a head model back, shrink it to the size budget, store it with the save | About 300 KB–1 MB after shrinking (raw output is often 5–20 MB) | Real shape from every angle, but these services often get hair and ears wrong | Medium–high: costs per head, the photo leaves the phone (needs a consent line), and it needs a server step |
| **C. Modelled face matched to the photo** | Pick skin tone, hair style and colour from the photo; use the modelled game face | Nothing extra | Looks like the rest of the game, not like you | Lowest |

Recommendation: **A first**, as a throwaway prototype on the phase-2 footballer, filmed at phone size next to C. Only try B if A doesn't look like you.

Managers (P72, P90) stay on C: "fake faces … based on an image of them somewhat, to the point where no one could sue us … skin colour, hair type". This is already in v0.23.1's signing work (U2) for the 2D scene; the 3D office reuses the same choice.

Question 4 becomes: **Your face in 3D: A (photo on a stock head) / B (AI head) / C (modelled)?**
