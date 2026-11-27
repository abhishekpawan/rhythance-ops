// The invoice endpoints, one file each (moved out of routes/invoices.ts unchanged); the router imports them from here.
export { generateInvoiceNumber } from "./invoice.number.js";
export { getInvoices } from "./invoice.list.js";
export { getInvoiceById } from "./invoice.read.js";
export { createInvoice } from "./invoice.create.js";
export { updateInvoice } from "./invoice.update.js";
export { deleteInvoice } from "./invoice.delete.js";
export { updateInvoiceDocument } from "./invoice.document.js";
export { getTimesheetsByClient } from "./invoice.timesheets.js";
export { sendInvoiceEmail } from "./invoice.send.js";
