import { getPortalSettingSync } from "./portalSettings.js";

// The columns of a client row that decide who is copied on an invoice email.
export interface InvoiceCopyClient {
  invoice_cc2?: boolean | null;
  email_address2?: string | null;
  invoice_cc3?: boolean | null;
  email_address3?: string | null;
  invoice_cc_dispatch?: boolean | null;
  dispatch_dept_email?: string | null;
  invoice_cc_accounts?: boolean | null;
  accounts_dept_email?: string | null;
}

// The copy list of the invoice email (moved out of the send-email handler unchanged): the addresses of the
// "email.invoiceCc" portal setting, then each of the client's second and third contact, dispatch and accounts
// addresses whose box is ticked and whose address is filled.
export function buildInvoiceCopyList(client: InvoiceCopyClient): string[] {
  const fixedCc = getPortalSettingSync("email.invoiceCc")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const cc: string[] = [...fixedCc];
  if (client.invoice_cc2 && client.email_address2)
    cc.push(client.email_address2);
  if (client.invoice_cc3 && client.email_address3)
    cc.push(client.email_address3);
  if (client.invoice_cc_dispatch && client.dispatch_dept_email)
    cc.push(client.dispatch_dept_email);
  if (client.invoice_cc_accounts && client.accounts_dept_email)
    cc.push(client.accounts_dept_email);
  return cc;
}
