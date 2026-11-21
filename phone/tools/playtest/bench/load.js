// body for cmd.mjs: load a {packed, next} state file into both apps. FILE defined before. (round 2 playtest)
const st = JSON.parse(fs.readFileSync(FILE, 'utf8').trim().split('\n').pop());
const put = (kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); };
await P.goto(urls.packed + '/404.html'); await P.evaluate(put, st.packed); await P.goto(urls.packed + '/');
await N.goto(urls.next + '/'); await N.evaluate(put, st.next); await N.goto(urls.next + '/');
for (let i = 0; i < 30; i++) { await wait(700); if (/CONTINUE/.test(await text(N, 400))) break; }
for (let i = 0; i < 5; i++) { try { await click(N, '^.?\\s*CONTINUE'); } catch (e) {} if (!/NEW GAME/.test(await text(N, 2000))) break; await wait(1000); }
await wait(2500);
return 'P: ' + (await text(P, 400)).replace(/\n/g, ' | ') + '\nN: ' + (await text(N, 400)).replace(/\n/g, ' | ');
