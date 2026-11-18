// Proves the game's rules (lib/star) run with no web browser: no window, no document.
import { makeInitialCareer, creditMatchResult } from "@/lib/star/careerFlow";
import * as engine from "@/lib/star/canvasEngine";
const g = globalThis as Record<string, unknown>;
console.log("window:", typeof g.window, "document:", typeof g.document);
console.log("careerFlow exports ok:", typeof makeInitialCareer, typeof creditMatchResult);
console.log("canvasEngine exports:", Object.keys(engine).length);
