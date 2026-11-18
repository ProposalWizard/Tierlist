// node tools/video-render/twin/highlights/make_reel.cjs GOALS.json OUT_DIR [--silent] [--stills-only]
//   -> OUT_DIR/reel.mp4 (1080x1920, 30 fps, H.264 + AAC) and OUT_DIR/stills/*.png
// Bundles page.ts (the game's own lib/star/goalClip code) with esbuild, serves it
// with public/ (sprites, sounds) from a tiny local server, draws every frame in
// headless Chromium and pipes JPEGs to ffmpeg. See README.md.
const path = require('path'); const fs = require('fs'); const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { chromium } = (() => {
  try { return require('playwright'); } catch (e) {}
  try { return require(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'playwright')); } catch (e) {}
  return require(path.resolve(__dirname, '../../../../node_modules/playwright'));
})();

const ROOT = path.resolve(__dirname, '../../../..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')));
if (args.length < 2) { console.log('usage: node make_reel.cjs GOALS.json OUT_DIR [--silent] [--stills-only]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const OUT = path.resolve(args[1]);
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
const t0 = Date.now(); const secs = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';

// 1. Bundle. esbuild: the repo's own copy if there is one, else npx (tsx's esbuild, cached after the first run).
const BUILD = path.join(OUT, '.build'); fs.mkdirSync(BUILD, { recursive: true });
const bundle = path.join(BUILD, 'reel.js');
const ebArgs = [path.join(__dirname, 'page.ts'), '--bundle', '--format=iife', '--platform=browser', '--target=chrome110',
  `--outfile=${bundle}`, `--tsconfig=${path.join(ROOT, 'tsconfig.json')}`, '--define:process.env.NODE_ENV="production"',
  '--loader:.json=json', '--log-level=warning'];
let eb = spawnSync(path.join(ROOT, 'node_modules/.bin/esbuild'), ebArgs, { stdio: 'inherit', cwd: ROOT });
if (eb.error || eb.status !== 0) eb = spawnSync('npx', ['--yes', 'esbuild@0.25.0', ...ebArgs], { stdio: 'inherit', cwd: ROOT });
if (eb.status !== 0) { console.log('BUNDLE FAILED'); process.exit(1); }
fs.writeFileSync(path.join(BUILD, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style></head>' +
  '<body><canvas id="c" width="1080" height="1920"></canvas><script src="/__reel/reel.js"></script></body></html>');
console.log('bundled', (fs.statSync(bundle).size / 1e6).toFixed(1) + ' MB', secs());

// 2. Serve the page and public/ (the sprite atlases, the sounds).
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = u === '/' ? path.join(BUILD, 'index.html') : u.startsWith('/__reel/') ? path.join(BUILD, u.slice(8)) : path.join(ROOT, 'public', u);
  if (!file.startsWith(ROOT) && !file.startsWith(BUILD)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { if (process.env.REEL_DEBUG) console.log('404', u); res.writeHead(404); return res.end(); }
    if (process.env.REEL_DEBUG && /\.(mp3|wav)$/.test(u)) console.log('sound', u);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  let bad = 0;
  page.on('pageerror', e => { bad++; if (bad < 5) console.log('PAGE ERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`);
  const info = await page.evaluate(s => window.reelBoot(s), spec);
  console.log('kits:'); for (const k of info.kits) console.log('  ' + k);
  console.log(`${spec.goals.length} goals, ${info.duration.toFixed(1)} s, ${info.frames} frames`, secs());

  // 3. Stills: a few frames per goal.
  const png = async (t, name) => {
    const d = await page.evaluate(([t]) => window.reelFrame(t, 'image/png'), [t]);
    fs.writeFileSync(path.join(OUT, 'stills', name), Buffer.from(d.split(',')[1], 'base64'));
  };
  for (const [i, g] of info.goals.entries()) {
    const n = String(i + 1).padStart(2, '0');
    await png(g.start, `g${n}_a_start.png`);
    await png(g.strike, `g${n}_b_strike.png`);
    await png(g.goal, `g${n}_c_goal.png`);
    await png(g.end, `g${n}_d_after.png`);
    if (g.replayMid >= 0) await png(g.replayMid, `g${n}_e_replay.png`);
  }
  console.log('stills in', path.join(OUT, 'stills'), secs());

  if (!flags.has('--stills-only')) {
    // 4. Sound: the game's own mix (crowd, kicks, net, commentary).
    let wav = null;
    if (!flags.has('--silent')) {
      const b64 = await page.evaluate(() => window.reelAudio());
      if (b64) { wav = path.join(BUILD, 'mix.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64')); console.log('sound mixed', secs()); }
      else console.log('no sound (mix failed): the video is silent');
    }
    // 5. Frames -> ffmpeg.
    const out = path.join(OUT, 'reel.mp4');
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      ...(wav ? ['-i', wav] : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', process.env.REEL_CRF || '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '30',
      ...(wav ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest'] : []), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < info.frames; i++) {
      const d = await page.evaluate(([t]) => window.reelFrame(t, 'image/jpeg', 0.92), [i / 30]);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log('frame', i, '/', info.frames, secs());
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code) { console.log('FFMPEG FAILED', code); process.exitCode = 1; } else console.log('wrote', out, secs());
  }
  await browser.close(); server.close();
  if (bad) { console.log('PAGE ERRORS:', bad, '(the picture is not to be trusted)'); process.exitCode = 1; }
})().catch(e => { console.error(e); server.close(); process.exit(1); });
