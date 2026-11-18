// Preload: when TEST_FIXED_NOW is set, "now" stands still at that instant, so every answer that depends on
// the date (30-day windows, "today", overdue) is the same on every run. Dates given explicitly are untouched.
const raw = process.env.TEST_FIXED_NOW;
if (raw) {
  const fixed = new Date(raw).getTime();
  if (Number.isNaN(fixed)) throw new Error(`TEST_FIXED_NOW is not a date: ${raw}`);
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = FixedDate;
}
