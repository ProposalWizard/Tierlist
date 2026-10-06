let __n = 0; const __ab = () => { const blk = Math.floor(__n / 3) % 2; __M.tag = (blk ? 'B' : 'A') + (__n % 3 === 0 ? '*' : ''); __n++; return blk === 1; };
__M.hook = (r) => { const b = __ab(); r.shadowMap.autoUpdate = !b; };
