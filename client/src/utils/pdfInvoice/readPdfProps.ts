import type { InvoicePdfDocumentProps } from "./pdfData";

export function readPdfProps(props: InvoicePdfDocumentProps) {
  const { data } = props;

  return { data };
}
