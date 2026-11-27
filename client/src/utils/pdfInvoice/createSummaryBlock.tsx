import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdfStyles";
import type { createItemSummary } from "./createItemSummary";
import type { readPdfProps } from "./readPdfProps";
import type { createPdfColumns } from "./createPdfColumns";

export function createSummaryBlock(
  ctx: ReturnType<typeof createItemSummary> &
    ReturnType<typeof readPdfProps> &
    ReturnType<typeof createPdfColumns>
) {
  const { data, hasItemSummary, hasPosition, itemSummary } = ctx;
  const summaryBlock = (
    <View style={styles.footer}>
      <View style={styles.summarySection}>
        {/* Item Summary - Left Side */}
        {hasItemSummary ? (
          <View style={styles.itemSummaryTable}>
            <Text style={styles.itemSummaryTitle}>Item Summary:</Text>
            <View style={styles.itemSummaryRow}>
              <Text style={styles.itemSummaryText}>
                {Object.entries(itemSummary)
                  .map(
                    ([posName, summaryData]) =>
                      `${posName} - ${summaryData.count}`
                  )
                  .join(", ")}
                {", "}Total Hrs: {data.summary.totalHours.toFixed(2)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.itemSummaryTable} />
        )}

        {/* Financial Summary - Right Side */}
        <View style={styles.summaryTable}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {hasPosition ? "Positions:" : "Items:"}
            </Text>
            <Text style={styles.summaryValue}>{data.lineItems.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Hours:</Text>
            <Text style={styles.summaryValue}>
              {data.summary.totalHours.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>
              ${data.summary.subtotal.toFixed(2)}
            </Text>
          </View>
          {data.summary.totalHST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                HST @ {data.summary.hstPercentage?.toFixed(2) || "0.00"}
                %:
              </Text>
              <Text style={styles.summaryValue}>
                ${data.summary.totalHST.toFixed(2)}
              </Text>
            </View>
          )}
          {data.summary.totalGST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                GST @ {data.summary.gstPercentage?.toFixed(2) || "0.00"}
                %:
              </Text>
              <Text style={styles.summaryValue}>
                ${data.summary.totalGST.toFixed(2)}
              </Text>
            </View>
          )}
          {data.summary.totalQST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                QST @ {data.summary.qstPercentage?.toFixed(2) || "0.00"}
                %:
              </Text>
              <Text style={styles.summaryValue}>
                ${data.summary.totalQST.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Tax:</Text>
            <Text style={styles.summaryValue}>
              ${data.summary.totalTax.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={[styles.summaryLabel, { color: "white" }]}>
              Grand Total:
            </Text>
            <Text style={[styles.summaryValue, { color: "white" }]}>
              ${data.summary.grandTotal.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer Messages */}
      {data.messageOnInvoice && (
        <Text style={styles.footerMessage}>{data.messageOnInvoice}</Text>
      )}
      {data.termsOnInvoice && (
        <Text style={styles.footerTerms}>{data.termsOnInvoice}</Text>
      )}
    </View>
  );

  return { summaryBlock };
}
