/**
 * THE CLOCK WHILE YOU ARE IN A 3D PLACE (life/clock.ts is the saved clock; this is the one that ticks).
 *
 * Inside a 3D place the career clock moves by itself, 1 game minute every REAL_SECS_PER_GAME_MIN real
 * seconds (Harry's question 1), and stops at time to leave for a match. The minutes it ticks are sent
 * back to the career in small lumps (`flush`), so the save is not written every frame. Anything that
 * moves the career clock from outside (an action, sleep) is picked up by `sync`.
 *
 * No React, no three.js: the house (world3d/houseLife.ts) reads `now()` each frame for who is where.
 * The test pages pass `rate` to run it faster (?clock=60: a game minute a second... ×6).
 */
import { REAL_SECS_PER_GAME_MIN } from "./clock";

export class LiveClock {
  /** The career's minute (since day 0) as last seen. */
  private base: number;
  /** Ticked here, sent to the career, not seen back yet. */
  private sent = 0;
  /** Ticked here, not sent yet. */
  private pending = 0;
  private stop: number;
  paused = false;
  /** How many times faster than Q1's speed (test pages). */
  rate: number;
  constructor(abs: number, stopAt = Infinity, rate = 1) {
    this.base = abs;
    this.stop = stopAt;
    this.rate = rate;
  }
  /** Minutes since day 0, now. */
  now(): number { return Math.min(this.stop, this.base + this.sent + this.pending); }
  /** The time to leave for the match has come (the clock is held). */
  get held(): boolean { return this.now() >= this.stop; }
  /** Real seconds passed (only while not paused and not held). */
  tick(realSecs: number) {
    if (this.paused || !(realSecs > 0) || this.held) return;
    this.pending += Math.min(realSecs, 2) * this.rate / REAL_SECS_PER_GAME_MIN;
  }
  /** The career changed: its clock is the truth again (our sent minutes are in it, or it jumped). */
  sync(abs: number, stopAt = this.stop) {
    this.base = abs;
    this.sent = 0;
    this.stop = stopAt;
  }
  /** Whole minutes ready to send to the career (taken off `pending`). `min`: wait until at least this many. */
  flush(min = 1): number {
    const whole = Math.floor(this.pending);
    if (whole < min) return 0;
    this.pending -= whole;
    this.sent += whole;
    return whole;
  }
}
