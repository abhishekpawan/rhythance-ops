import { InvoiceData } from "./pdfData";
import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdfStyles";
import type { readPdfProps } from "./readPdfProps";
import type { createPdfColumns } from "./createPdfColumns";

export function createTableRows(
  ctx: ReturnType<typeof readPdfProps> & ReturnType<typeof createPdfColumns>
) {
  const {
    amountWidth,
    candidateWidth,
    data,
    descriptionWidth,
    hasCandidate,
    hasPosition,
    hoursWidth,
    positionWidth,
    rateWidth,
  } = ctx;
  // Rows that always travel together with the summary (see layout comment below).
  const TAIL_ROWS = 2;
  const headRows = data.lineItems.slice(
    0,
    Math.max(0, data.lineItems.length - TAIL_ROWS)
  );
  const tailRows = data.lineItems.slice(headRows.length);

  const renderRow = (item: InvoiceData["lineItems"][number], index: number) => (
    <View style={styles.tableRow} key={index} wrap={false}>
      {hasPosition && (
        <View style={[styles.tableCol, { width: positionWidth }]}>
          <Text style={styles.tableCell}>
            {item.positionName?.trim() || ""}
          </Text>
        </View>
      )}
      {hasCandidate && (
        <View style={[styles.tableCol, { width: candidateWidth }]}>
          <Text style={styles.tableCell}>{item.candidate?.trim() || ""}</Text>
        </View>
      )}
      <View style={[styles.tableCol, { width: descriptionWidth }]}>
        <Text style={styles.tableCell}>{item.description || ""}</Text>
      </View>
      <View style={[styles.tableCol, { width: hoursWidth }]}>
        <Text style={styles.tableCell}>{item.hours.toFixed(2)}</Text>
      </View>
      <View style={[styles.tableCol, { width: rateWidth }]}>
        <Text style={styles.tableCell}>${item.rate.toFixed(2)}</Text>
      </View>
      <View style={[styles.tableCol, { width: amountWidth }]}>
        <Text style={styles.tableCell}>${item.amount.toFixed(2)}</Text>
      </View>
    </View>
  );

  return { TAIL_ROWS, headRows, tailRows, renderRow };
}
