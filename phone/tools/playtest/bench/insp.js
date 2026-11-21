const f = ([txt, depth, col]) => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, hit = null;
  while ((n = w.nextNode())) { if (n.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(txt.toLowerCase())) { const r = n.parentElement.getBoundingClientRect(); if (r.width > 0 && r.bottom > 0 && r.top < innerHeight) { hit = n.parentElement; break; } } }
  if (!hit) return "not found";
  const out = []; const px = (v) => String(parseFloat(v) || 0);
  for (let e = hit, k = 0; e && k < depth; e = e.parentElement, k++) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    out.push(`${k} ${e.tagName.slice(0, 4)} ${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)} p[${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}] m[${px(s.marginTop)} ${px(s.marginBottom)}] ${px(s.fontSize)}/${s.lineHeight === "normal" ? "n" : px(s.lineHeight)} ls${px(s.letterSpacing)} w${s.fontWeight} ${/anton/i.test(s.fontFamily) ? "ANTON " : ""}br${px(s.borderRadius)} bw${px(s.borderTopWidth)}${s.gap !== "normal" ? " gap" + px(s.gap) : ""}${col ? ` col ${s.color} bg ${s.backgroundColor}${s.backgroundImage !== "none" ? " img " + s.backgroundImage.slice(0, 110) : ""}${s.boxShadow !== "none" ? " sh " + s.boxShadow.slice(0, 110) : ""}${s.borderTopWidth !== "0px" ? " bc " + s.borderTopColor : ""}${s.textShadow !== "none" ? " ts " + s.textShadow.slice(0, 60) : ""}${s.opacity !== "1" ? " op " + s.opacity : ""}` : ""}`);
  }
  return out.join("\n");
};
return "P\n" + (await P.evaluate(f, [TXT, DEPTH, COL])) + "\nN\n" + (await N.evaluate(f, [TXT, DEPTH, COL]));
