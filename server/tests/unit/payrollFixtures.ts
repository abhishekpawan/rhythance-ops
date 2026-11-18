import type {
  BuildHybridRowsInput,
  DailyHourEntry,
} from "../../../client/src/lib/hybridPayrollSplit";

export const week = (hours: number[]): DailyHourEntry[] =>
  hours.map((h, i) => ({ date: `2026-11-0${i + 2}`, hours: h })); // Mon 2 Nov ..

// Pay 20/h, overtime pay 30/h, bill 35/h, overtime bill 52.50/h.
export const base = (
  over: Partial<BuildHybridRowsInput>
): BuildHybridRowsInput => ({
  entries: week([8, 8, 8, 8, 8]),
  overtimeEnabled: false,
  overtimeHoursRaw: undefined,
  effectiveRegularPayRate: 20,
  overtimePayRate: 30,
  regularBillRate: 35,
  overtimeBillRate: 52.5,
  paymentMethod: "SIN-Direct Deposit",
  sinPayrollHoursCap: 0,
  cashDeductionPct: 0,
  bonusAmount: 0,
  deductionAmount: 0,
  hstGst: null,
  ...over,
});
