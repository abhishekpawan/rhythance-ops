import { pdfjs } from "react-pdf";
// Vite bundles the worker file with the app, so it is served from our own domain
// (not unpkg.com). pdfjs-dist is pinned to the exact version react-pdf uses.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Pass as `options` on every react-pdf <Document>. isEvalSupported: false closes
// CVE-2024-4367 (a crafted PDF running script) in pdfjs-dist 3.x. Keep it a
// module constant: a new object on each render makes react-pdf reload the file.
export const pdfDocumentOptions = { isEvalSupported: false } as const;
