// Inbox 11 / DEV-1: find_matching_candidates lists each candidate once, even when they have two active
// assignments that overlap the position's dates (it used to list them once per assignment). Run against the
// database built from the migration files; each case is rolled back.
import { describe, expect, it } from "vitest";
import { rolledBack } from "../support/rolled-back";

const POSITION = "00000000-0000-4000-8000-000000000031"; // 2026-09-01 .. 2027-03-31
// candidate 11 has two active assignments (positions 31 and 32) that both overlap that period
const BUSY_TWICE = "00000000-0000-4000-8000-000000000011";
const FREE = "00000000-0000-4000-8000-000000000014";

// the seed has no embeddings: give the position and the verified candidates one, inside the rolled-back run
const prepare = `
  UPDATE positions SET job_embedding = array_fill(0.1::real, ARRAY[1536])::extensions.vector WHERE id = '${POSITION}';
  UPDATE jobseeker_profiles SET bio_embedding = array_fill(0.1::real, ARRAY[1536])::extensions.vector
    WHERE verification_status = 'verified';
  -- candidate 14 is the free one: their only assignment is over
  UPDATE position_candidate_assignments SET status = 'completed' WHERE candidate_id = '${FREE}';`;

const run = (filters: string) =>
  JSON.parse(
    rolledBack(`${prepare}
      SELECT coalesce(json_agg(json_build_object('id', candidate_id, 'available', is_available)), '[]'::json)
      FROM find_matching_candidates('${POSITION}', 100, '${filters}'::jsonb);`)
  ) as { id: string; available: boolean }[];

describe("find_matching_candidates", () => {
  it("returns every candidate once, busy ones marked not available", () => {
    const rows = run("{}");
    const ids = rows.map((r) => r.id);
    expect(ids.length).toBe(new Set(ids).size);
    expect(rows.filter((r) => r.id === BUSY_TWICE)).toEqual([
      { id: BUSY_TWICE, available: false },
    ]);
    expect(rows.find((r) => r.id === FREE)).toMatchObject({ available: true });
  });

  it("with only_available, the busy candidate is not listed and the free one is", () => {
    const ids = run('{"only_available": "true"}').map((r) => r.id);
    expect(ids).not.toContain(BUSY_TWICE);
    expect(ids).toContain(FREE);
  });
});
