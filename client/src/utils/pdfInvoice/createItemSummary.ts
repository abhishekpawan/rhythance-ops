import type { readPdfProps } from "./readPdfProps";

export function createItemSummary(ctx: ReturnType<typeof readPdfProps>) {
  const { data } = ctx;
  // Calculate item summary (group by position name only if valid position exists)
  const itemSummary = data.lineItems.reduce(
    (acc, item) => {
      const positionName = item.positionName?.trim();
      if (!positionName) {
        return acc;
      }
      if (!acc[positionName]) {
        acc[positionName] = { count: 0, totalHours: 0 };
      }
      acc[positionName].count += 1;
      acc[positionName].totalHours += item.hours;
      return acc;
    },
    {} as Record<string, { count: number; totalHours: number }>
  );

  const hasItemSummary = Object.keys(itemSummary).length > 0;

  return { itemSummary, hasItemSummary };
}
