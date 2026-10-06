// Shader + texture warm-up AND a 1-pixel prime draw before the first frame (perf.ts warmUp).
__M.hook = (r, scene, cam) => {
  if (__M.warm === "done" || __M.inWarm) return;
  if (!__M.warm) { __M.warm = "busy"; const a = performance.now(); __M.inWarm = true; __M.inHook = true;
    P.warmUp(THREE, r, scene, cam, { includeHidden: false }).then(() => { __M.inWarm = false; __M.inHook = false; __M.warm = "done"; __M.extra = { warmMs: Math.round(performance.now() - a) }; }); }
  return "skip";
};
