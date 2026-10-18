import { wrapInLayout, S, getPortalName, textFooter, ACCENT_BLUE, accentBtn } from "./_layout.js";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SupportTicketReopenedEmailVars {
  ticketNumber: number | string;
  title: string;
  reopenedByName: string;
  body?: string | null;
  ticketUrl: string;
}

export function renderSupportTicketReopenedEmail(vars: SupportTicketReopenedEmailVars): { html: string; text: string } {
  const portalName = getPortalName();
  const ticketRef = `SUP-${String(vars.ticketNumber).padStart(4, "0")}`;
  const btn = accentBtn(ACCENT_BLUE);

  const safeTitle = esc(vars.title);
  const safeName = esc(vars.reopenedByName);
  const safeBody = vars.body ? esc(vars.body).replace(/\n/g, "<br>") : "";

  const noteBlock = vars.body
    ? `
<div style="${S.infoBox}">
  <h3 style="${S.h3}">Reopen Note</h3>
  <div style="font-size:14px;color:#333333;line-height:1.6;">${safeBody}</div>
</div>`
    : "";

  const bodyHtml = `
<p style="${S.p}">Ticket <strong style="${S.strong}">${ticketRef}</strong> (<em style="color:#555;">${safeTitle}</em>) has been reopened by <strong style="${S.strong}">${safeName}</strong> and moved back to <strong style="${S.strong}">In Progress</strong>.</p>
${noteBlock}

<div style="${S.btnWrap}">
  <a href="${vars.ticketUrl}" style="${btn}">View Ticket in Portal</a>
</div>
`;

  const html = wrapInLayout(`Ticket Reopened: ${ticketRef}`, bodyHtml, portalName, ACCENT_BLUE);

  const text = `Ticket ${ticketRef} Reopened: ${vars.title}

Reopened by: ${vars.reopenedByName}
Status: in_progress
${vars.body ? `\nNote:\n${vars.body}\n` : ""}
View ticket: ${vars.ticketUrl}

${textFooter(portalName)}
`;

  return { html, text };
}
