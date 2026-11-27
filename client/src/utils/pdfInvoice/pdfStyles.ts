import { StyleSheet } from "@react-pdf/renderer";

// The invoice PDF's colors and styles, moved out of pdfGenerator.tsx unchanged (R-5s).

// Color scheme
export const colors = {
  primary: "#ffd500",
  secondary: "#002644",
  text: "#1f2937",
  border: "#e5e7eb",
  accent: "#3b82f6",
};

// Styles for the PDF
export const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    paddingBottom: 50, // room for the fixed page number
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  logoSection: {
    flexDirection: "column",
    width: "40%",
    justifyContent: "flex-start",
  },
  logoPlaceholder: {
    width: 150,
    height: 35,
    objectFit: "contain",
    objectPosition: "left",
  },
  companyInfo: {
    flexDirection: "column",
    width: "55%",
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.secondary,
    textAlign: "right",
    marginBottom: 2,
  },
  companyDetails: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.4,
    textAlign: "right",
  },
  invoiceInfo: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 10,
    color: colors.secondary,
  },
  billToInvoiceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  clientSection: {
    width: "48%",
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 5,
  },
  invoiceDetailsSection: {
    width: "48%",
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 10,
  },
  clientName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  clientDetails: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.4,
  },
  invoiceDetailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  invoiceDetailLabel: {
    fontSize: 10,
    color: colors.text,
    fontWeight: "bold",
  },
  invoiceDetailValue: {
    fontSize: 10,
    color: colors.text,
  },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
  },
  tableHeader: {
    backgroundColor: colors.primary,
    color: "white",
    fontWeight: "bold",
  },
  tableCol: {
    width: "20%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  tableCell: {
    margin: "auto",
    marginTop: 5,
    marginBottom: 5,
    fontSize: 9,
    padding: 5,
  },
  tableCellHeader: {
    margin: "auto",
    marginTop: 4,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: "bold",
    padding: 2,
    color: colors.secondary,
  },
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    width: "100%",
  },
  itemSummaryTable: {
    width: "48%",
  },
  itemSummaryTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.secondary,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  itemSummaryRow: {
    flexDirection: "column",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemSummaryText: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.3,
  },
  summaryTable: {
    width: "48%",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.text,
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  totalRow: {
    backgroundColor: colors.primary,
    color: "white",
    fontWeight: "bold",
  },
  // In normal flow (not absolute) so it can never print over the table rows.
  footer: {
    marginTop: 10,
    fontSize: 8,
    color: colors.secondary,
  },
  footerContent: {
    textAlign: "center",
    marginBottom: 5,
  },
  footerMessage: {
    fontSize: 8,
    color: colors.text,
    marginBottom: 5,
    textAlign: "left",
  },
  footerTerms: {
    fontSize: 8,
    color: colors.text,
    marginBottom: 5,
    textAlign: "left",
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    color: colors.secondary,
    textAlign: "right",
  },
  pageNumberText: {
    fontSize: 8,
    color: colors.secondary,
  },
  dateRangeSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 5,
  },
  dateRangeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.secondary,
    textAlign: "center",
  },
});
