/**
 * Builds the recruiter dashboard's metric cards (jobseeker profiles, clients,
 * positions) for all recruiters or for one. Used by routes/recruiterMetrics.ts.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  fetchAllRows,
  metricFromSummary,
  summarizeMonthly,
} from "../utils/metricMonths.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/*
 * How every card on these routes is calculated (like YouTube Studio)
 * ------------------------------------------------------------------
 *  - currentValue       : the running total over ALL time (the card says "Total ...").
 *  - currentPeriodValue : what was added in the last 30 days.
 *  - previousValue      : what was added in the 30 days before that.
 *  - historicalData     : what was added in each of the last `timeRange` calendar
 *                         months plus the current one (the chart).
 * The percentage on the card is (currentPeriodValue - previousValue) / previousValue:
 * two windows of equal length, so it is fair at any day of the month. Never compare
 * a total with a single period, and never a month-so-far with a whole month. Months
 * are Toronto calendar months; the maths lives in utils/metricMonths.ts.
 *
 * The verification-status cards use each profile's status now (the database keeps
 * no status history), so past windows can shift as profiles get verified.
 */

interface JobseekerProfile {
  id: string;
  verification_status: string;
  created_at: string;
}

interface Client {
  id: string;
  created_at: string;
}

interface Position {
  id: string;
  number_of_positions: number | null;
  is_subcategory: boolean | null;
  created_at: string;
}

interface Assignment {
  id: string;
  position_id: string;
  created_at: string;
}

/* ------------------------------ Jobseeker profiles ------------------------------ */

export async function buildProfileMetrics(
  monthsBack: number,
  recruiterId?: string
) {
  const profiles = await fetchAllRows<JobseekerProfile>((from, to) => {
    let query = supabase
      .from("jobseeker_profiles")
      .select("id, verification_status, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (recruiterId) query = query.eq("created_by_user_id", recruiterId);
    return query;
  });

  const summarize = (status?: string) =>
    metricFromSummary(
      summarizeMonthly(profiles, {
        getDate: (p) => p.created_at,
        include: status ? (p) => p.verification_status === status : undefined,
        monthsBack,
      })
    );

  const mine = Boolean(recruiterId);
  return [
    {
      id: "total_profiles",
      label: "Total Profiles Created",
      ...summarize(),
      unit: "profiles",
      formatType: "number",
      description: mine
        ? "Overall total number of jobseeker profiles created by you"
        : "Overall total number of jobseeker profiles created by all recruiters",
      redirectTo: `/jobseeker-management`,
    },
    {
      id: "pending_profiles",
      label: "Total Pending Verification",
      ...summarize("pending"),
      unit: "profiles",
      formatType: "number",
      description: mine
        ? "Total jobseeker profiles created by you awaiting verification"
        : "Total jobseeker profiles which are awaiting verification",
      redirectTo: `/jobseeker-management?status=pending`,
    },
    {
      id: "verified_profiles",
      label: "Total Verified Profiles",
      ...summarize("verified"),
      unit: "profiles",
      formatType: "number",
      description: mine
        ? "Total jobseeker profiles created by you that have been verified"
        : "Total jobseeker profiles that have been verified",
      redirectTo: `/jobseeker-management?status=verified`,
    },
    {
      id: "rejected_profiles",
      label: "Total Rejected Profiles",
      ...summarize("rejected"),
      unit: "profiles",
      formatType: "number",
      description: mine
        ? "Total jobseeker profiles created by you that have been rejected"
        : "Total jobseeker profiles that have been rejected",
      redirectTo: `/jobseeker-management?status=rejected`,
    },
  ];
}

/* ----------------------------------- Clients ----------------------------------- */

export async function buildClientMetrics(
  monthsBack: number,
  recruiterId?: string
) {
  const clients = await fetchAllRows<Client>((from, to) => {
    let query = supabase
      .from("clients")
      .select("id, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (recruiterId) query = query.eq("created_by_user_id", recruiterId);
    return query;
  });

  return [
    {
      id: "total_clients",
      label: "Total Clients Created",
      ...metricFromSummary(
        summarizeMonthly(clients, {
          getDate: (c) => c.created_at,
          monthsBack,
        })
      ),
      unit: "clients",
      formatType: "number",
      description: recruiterId
        ? "Total clients created by you"
        : "Total clients created by all recruiters",
    },
  ];
}

/* ---------------------------------- Positions ---------------------------------- */

export async function buildPositionMetrics(
  monthsBack: number,
  recruiterId?: string
) {
  const positions = await fetchAllRows<Position>((from, to) => {
    let query = supabase
      .from("positions")
      .select("id, number_of_positions, is_subcategory, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (recruiterId) query = query.eq("created_by_user_id", recruiterId);
    return query;
  });

  const assignments = await fetchAllRows<Assignment>((from, to) => {
    let query = supabase
      .from("position_candidate_assignments")
      .select("id, position_id, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (recruiterId) query = query.eq("created_by_user_id", recruiterId);
    return query;
  });

  // Subcategory positions (mileage, allowances...) have no matchable slots. Look
  // them up across ALL positions: an assignment can point at a position that
  // someone else created, or that is older than any window.
  const subcategoryRows = await fetchAllRows<{ id: string }>((from, to) =>
    supabase
      .from("positions")
      .select("id")
      .eq("is_subcategory", true)
      .order("id", { ascending: true })
      .range(from, to)
  );
  const subcategoryIds = new Set(subcategoryRows.map((p) => p.id));

  const mine = recruiterId ? "you" : "all recruiters";
  return [
    {
      id: "total_positions_added",
      label: "Total Positions Added",
      ...metricFromSummary(
        summarizeMonthly(positions, {
          getDate: (p) => p.created_at,
          monthsBack,
        })
      ),
      unit: "positions",
      formatType: "number",
      description: `Total positions created by ${mine}`,
    },
    {
      id: "total_position_slots",
      label: "Total Position Slots",
      ...metricFromSummary(
        summarizeMonthly(positions, {
          getDate: (p) => p.created_at,
          getValue: (p) => p.number_of_positions || 1,
          include: (p) => !p.is_subcategory,
          monthsBack,
        })
      ),
      unit: "slots",
      formatType: "number",
      description: recruiterId
        ? "Total available position slots created by you"
        : "Total available position slots created by all recruiters",
    },
    {
      id: "total_positions_filled",
      label: "Total Positions Filled",
      ...metricFromSummary(
        summarizeMonthly(assignments, {
          getDate: (a) => a.created_at,
          include: (a) => !subcategoryIds.has(a.position_id),
          monthsBack,
        })
      ),
      unit: "filled",
      formatType: "number",
      description: `Total positions filled by ${mine}`,
    },
  ];
}
