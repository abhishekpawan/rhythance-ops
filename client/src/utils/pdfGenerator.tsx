import React from "react";
import { Document, Page, Text, View, pdf, Image } from "@react-pdf/renderer";
import invoiceLogo from "../assets/brand/invoice.png";
import { formatCalendarDate } from "./dateUtils";

import { readPdfProps } from "./pdfInvoice/readPdfProps";
import { createPdfColumns } from "./pdfInvoice/createPdfColumns";
import { createItemSummary } from "./pdfInvoice/createItemSummary";
import { createTableHeaderRow } from "./pdfInvoice/createTableHeaderRow";
import { createTableRows } from "./pdfInvoice/createTableRows";
import { createSummaryBlock } from "./pdfInvoice/createSummaryBlock";
import { styles } from "./pdfInvoice/pdfStyles";
import {
  formatDateWithOrdinal,
  type InvoiceData,
  type InvoicePdfDocumentProps,
} from "./pdfInvoice/pdfData";
export type { InvoiceData } from "./pdfInvoice/pdfData";

// PDF Document Component
const InvoicePDFDocument: React.FC<InvoicePdfDocumentProps> = (props) => {
  const pdfProps = readPdfProps(props);
  const columns = createPdfColumns(pdfProps);
  const itemSummary = createItemSummary(pdfProps);
  const header = createTableHeaderRow(columns);
  const rows = createTableRows({ ...pdfProps, ...columns });
  const summary = createSummaryBlock({
    ...itemSummary,
    ...pdfProps,
    ...columns,
  });
  const { data } = pdfProps;
  const { tableHeaderRow } = header;
  const { headRows, renderRow, tailRows } = rows;
  const { summaryBlock } = summary;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Continuation pages (2+): repeat the table header at the top. Renders
              nothing on page 1, where the real header is part of the flow. */}
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={[styles.table, { marginBottom: 0 }]}>
                {tableHeaderRow}
              </View>
            ) : null
          }
        />
        {/* Header - only on first page */}
        {
          <>
            <View style={styles.header}>
              <View style={styles.logoSection}>
                <Image src={invoiceLogo} style={styles.logoPlaceholder} />
              </View>
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{data.company.name}</Text>
                <Text style={styles.companyDetails}>
                  {data.company.address}
                  {"\n"}
                  {data.company.address2}
                  {"\n"}
                  {data.company.taxNumber}
                </Text>
              </View>
            </View>

            {/* Bill To and Invoice Details Section */}
            <View style={styles.billToInvoiceSection}>
              <View style={styles.clientSection}>
                <Text style={styles.sectionTitle}>Bill To:</Text>
                <Text style={styles.clientName}>{data.client.companyName}</Text>
                {data.client.address && (
                  <Text style={styles.clientDetails}>
                    {data.client.address.join("\n")}
                  </Text>
                )}
                {data.client.email && (
                  <Text style={styles.clientDetails}>{data.client.email}</Text>
                )}
              </View>

              <View style={styles.invoiceDetailsSection}>
                <Text style={styles.sectionTitle}>Invoice Details:</Text>
                <View style={styles.invoiceDetailItem}>
                  <Text style={styles.invoiceDetailLabel}>Invoice #:</Text>
                  <Text style={styles.invoiceDetailValue}>
                    {data.invoiceNumber}
                  </Text>
                </View>
                <View style={styles.invoiceDetailItem}>
                  <Text style={styles.invoiceDetailLabel}>Invoice Date:</Text>
                  <Text style={styles.invoiceDetailValue}>
                    {formatCalendarDate(data.invoiceDate)}
                  </Text>
                </View>
                <View style={styles.invoiceDetailItem}>
                  <Text style={styles.invoiceDetailLabel}>Due Date:</Text>
                  <Text style={styles.invoiceDetailValue}>
                    {formatCalendarDate(data.dueDate)}
                  </Text>
                </View>
                <View style={styles.invoiceDetailItem}>
                  <Text style={styles.invoiceDetailLabel}>Term:</Text>
                  <Text style={styles.invoiceDetailValue}>{data.terms}</Text>
                </View>
              </View>
            </View>
          </>
        }

        {/* Date Range Section - only on first page */}
        {data.dateRange.startDate && data.dateRange.endDate && (
          <View style={styles.dateRangeSection}>
            <Text style={styles.dateRangeText}>
              From {formatDateWithOrdinal(data.dateRange.startDate)} to{" "}
              {formatDateWithOrdinal(data.dateRange.endDate)}
            </Text>
          </View>
        )}

        {/* Line Items Table.
              The rows before the "tail" flow normally and break across pages as the
              layout engine decides. The last TAIL_ROWS rows and the summary form one
              unbreakable block, so the summary can never end up alone on a page, and
              that block is stretched so the summary sits at the bottom of the last page. */}
        {headRows.length > 0 && (
          <View style={[styles.table, { marginBottom: 0 }]}>
            {/* header + first row stay together (no orphaned header) */}
            <View wrap={false}>
              {tableHeaderRow}
              {renderRow(headRows[0], 0)}
            </View>
            {headRows.slice(1).map((item, i) => renderRow(item, i + 1))}
          </View>
        )}

        <View
          wrap={false}
          style={{ flexGrow: 1, justifyContent: "space-between" }}
        >
          <View
            style={[
              styles.table,
              { marginBottom: 0 },
              headRows.length > 0 ? { borderTopWidth: 0 } : {},
            ]}
          >
            {headRows.length === 0 && tableHeaderRow}
            {tailRows.map((item, i) => renderRow(item, headRows.length + i))}
          </View>
          {summaryBlock}
        </View>

        {/* Page Number - on every page */}
        <View style={styles.pageNumber} fixed>
          <Text
            style={styles.pageNumberText}
            render={({ pageNumber, totalPages: pdfTotalPages }) =>
              `Page ${pageNumber} of ${pdfTotalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

// Main function to generate PDF
export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  try {
    const doc = <InvoicePDFDocument data={data} />;
    const pdfBlob = await pdf(doc).toBlob();
    return pdfBlob;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF");
  }
};

// Export for compatibility
export default generateInvoicePDF;
