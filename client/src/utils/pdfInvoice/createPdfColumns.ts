import { hasValue } from "./pdfData";
import type { readPdfProps } from "./readPdfProps";

export function createPdfColumns(ctx: ReturnType<typeof readPdfProps>) {
  const { data } = ctx;
  // If ANY row contains data for a column, keep that column; otherwise remove it completely
  const hasPosition = data.lineItems.some((item) =>
    hasValue(item.positionName)
  );
  const hasCandidate = data.lineItems.some((item) => hasValue(item.candidate));

  // Calculate dynamic column widths based on whether Position Name and Candidate exist
  let positionWidth = "0%";
  let candidateWidth = "0%";
  let descriptionWidth = "25%";
  let hoursWidth = "10%";
  let rateWidth = "10%";
  let amountWidth = "10%";

  if (hasPosition && hasCandidate) {
    positionWidth = "25%";
    candidateWidth = "20%";
    descriptionWidth = "25%";
    hoursWidth = "10%";
    rateWidth = "10%";
    amountWidth = "10%";
  } else if (hasPosition && !hasCandidate) {
    positionWidth = "30%";
    descriptionWidth = "40%";
    hoursWidth = "10%";
    rateWidth = "10%";
    amountWidth = "10%";
  } else if (!hasPosition && hasCandidate) {
    candidateWidth = "30%";
    descriptionWidth = "40%";
    hoursWidth = "10%";
    rateWidth = "10%";
    amountWidth = "10%";
  } else {
    // Both Position Name and Candidate Name are omitted
    descriptionWidth = "55%";
    hoursWidth = "15%";
    rateWidth = "15%";
    amountWidth = "15%";
  }

  return {
    hasPosition,
    hasCandidate,
    positionWidth,
    candidateWidth,
    descriptionWidth,
    hoursWidth,
    rateWidth,
    amountWidth,
  };
}
