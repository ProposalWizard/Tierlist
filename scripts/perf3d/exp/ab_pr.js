let __n = 0; const __ab = () => { const blk = Math.floor(__n / 3) % 2; __M.tag = (blk ? 'B' : 'A') + (__n % 3 === 0 ? '*' : ''); __n++; return blk === 1; };
__M.hook = (r) => { const b = __ab(); const want = b ? 1 : 1.5; if (r.getPixelRatio() !== want) r.setPixelRatio(want); };
