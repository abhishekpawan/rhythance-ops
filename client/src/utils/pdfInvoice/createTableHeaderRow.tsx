import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdfStyles";
import type { createPdfColumns } from "./createPdfColumns";

export function createTableHeaderRow(ctx: ReturnType<typeof createPdfColumns>) {
  const {
    amountWidth,
    candidateWidth,
    descriptionWidth,
    hasCandidate,
    hasPosition,
    hoursWidth,
    positionWidth,
    rateWidth,
  } = ctx;
  // Table header row, shared by the first page and the repeated continuation header
  const tableHeaderRow = (
    <View style={[styles.tableRow, styles.tableHeader]}>
      {hasPosition && (
        <View style={[styles.tableCol, { width: positionWidth }]}>
          <Text style={styles.tableCellHeader}>Position Name</Text>
        </View>
      )}
      {hasCandidate && (
        <View style={[styles.tableCol, { width: candidateWidth }]}>
          <Text style={styles.tableCellHeader}>Candidate</Text>
        </View>
      )}
      <View style={[styles.tableCol, { width: descriptionWidth }]}>
        <Text style={styles.tableCellHeader}>Description</Text>
      </View>
      <View style={[styles.tableCol, { width: hoursWidth }]}>
        <Text style={styles.tableCellHeader}>Hours</Text>
      </View>
      <View style={[styles.tableCol, { width: rateWidth }]}>
        <Text style={styles.tableCellHeader}>Rate</Text>
      </View>
      <View style={[styles.tableCol, { width: amountWidth }]}>
        <Text style={styles.tableCellHeader}>Amount</Text>
      </View>
    </View>
  );

  return { tableHeaderRow };
}
