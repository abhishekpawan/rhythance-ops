// The invoice PDF maker (about 1.5 MB) is its own file, kept out of the first download. It is requested when the
// invoice page opens (preloadPdfMaker, called at the top of that page's module) and the page awaits the same
// request (loadPdfMaker) where it makes the PDF, after the invoice is saved.
//
// Why not just import() where the PDF is made: after a deploy, a tab that was opened before it asks for a file
// that no longer exists. If that happens at the end of "save invoice", the page reloads (reloadOnStaleChunk.ts)
// with the invoice saved but without its PDF and the form lost. Asked when the page opens, it reloads before
// anything is typed or saved.
export type { InvoiceData } from "./pdfGenerator.tsx";

type PdfMaker = typeof import("./pdfGenerator.tsx");

let loading: Promise<PdfMaker> | null = null;

/** The PDF maker, requested once and shared; a failed request is forgotten so the next call asks again. */
export function loadPdfMaker(): Promise<PdfMaker> {
  if (!loading) {
    const request = import("./pdfGenerator.tsx");
    loading = request;
    request.catch(() => {
      if (loading === request) loading = null;
    });
  }
  return loading;
}

/** Start the request now and ignore its result (a failure shows up where the PDF is made). */
export function preloadPdfMaker(): void {
  loadPdfMaker().catch(() => {});
}
