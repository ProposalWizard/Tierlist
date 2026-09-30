/**
 * lib/patchNoteReviews.ts — HARRY'S NOTES ON A VERSION.
 *
 * Asked for directly (Harry, 30 Sep 2026): "I just say them and then you
 * write them in as a second tab that you can switch to. Harry's notes ...
 * and that should be for everyone really." So notes are spoken in a
 * recording, written in here by Claude, and shown on the admin patch-notes
 * archive as a "Harry's notes" tab next to Page and Text. Not typed into the
 * page, so there is no table and nothing to migrate.
 *
 * Keyed by the site's version number (Mikey's "v0.7" is the site's "0.20").
 * Each note is Harry's own words, lightly tidied, with where he said it so
 * anyone can go back to the recording.
 */

export interface ReviewNote {
  /** What in the patch notes he's reacting to, as it's named on the page. */
  about: string;
  /** His view, in his words. */
  said: string;
  /** Positive, a concern, or a question still to settle. */
  tone: "like" | "concern" | "question";
  /** Recording and timestamp, e.g. "Feedback video, 30 Sep, 10:00". */
  source: string;
}

export interface PatchNoteReview {
  by: string;
  /** ISO date of the most recent note. */
  updatedAt: string;
  notes: ReviewNote[];
}

export const PATCH_NOTE_REVIEWS: Record<string, PatchNoteReview> = {
  "0.20": {
    by: "Harry",
    updatedAt: "2026-09-30",
    notes: [
      {
        about: "Star rating 1–10, separate from overall",
        said: "Star rating is now your career, one to ten. Overall is how good you are. Pretty cool.",
        tone: "like",
        source: "Feedback video, 30 Sep, 9:21",
      },
      {
        about: "Star Points multiplied by the stage",
        said: "Is it smart to multiply by the stage? Probably is, right?",
        tone: "like",
        source: "Feedback video, 30 Sep, 10:00",
      },
      {
        about: "Trophies earning Star Points",
        said: "Trophies, nice.",
        tone: "like",
        source: "Feedback video, 30 Sep, 10:24",
      },
      {
        about: "Star gates",
        said: "Star gates. So I kind of like this.",
        tone: "like",
        source: "Feedback video, 30 Sep, 10:56",
      },
      {
        about: "Penalty timer lengthened from 1.0 s to 1.8 s",
        said: "Me personally, I think that one second is even maybe a bit too long, so we're having a difference of opinions there.",
        tone: "concern",
        source: "Review video, 30 Sep, 11:28",
      },
      {
        about: "Training sessions refill only after a Saturday league match",
        said: "I don't know if we want that to be refilled in a midweek game.",
        tone: "question",
        source: "Review video, 30 Sep, 12:13",
      },
    ],
  },
};
