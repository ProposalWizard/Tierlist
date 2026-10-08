// Prints every goal-video commentary line as JSON (used by generate.py).
import { allCommentaryLines } from "../../lib/star/goalClip/commentary";
console.log(JSON.stringify(allCommentaryLines()));
