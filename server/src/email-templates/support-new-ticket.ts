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

export interface SupportNewTicketEmailVars {
  ticketNumber: number | string;
  title: string;
  requesterName: string;
  requesterEmail: string;
  requesterRoles: string[];
  type: string;
  urgency: string;
  description: string;
  attachmentCount?: number;
  ticketUrl: string;
}

export function renderSupportNewTicketEmail(vars: SupportNewTicketEmailVars): { html: string; text: string } {
  const portalName = getPortalName();
  const ticketRef = `SUP-${String(vars.ticketNumber).padStart(4, "0")}`;
  const btn = accentBtn(ACCENT_BLUE);

  const safeTitle = esc(vars.title);
  const safeName = esc(vars.requesterName);
  const safeEmail = esc(vars.requesterEmail);
  const safeRoles = esc(vars.requesterRoles.join(", ") || "None");
  const safeType = esc(vars.type.toUpperCase());
  const safeUrgency = esc(vars.urgency.toUpperCase());
  const safeDesc = esc(vars.description).replace(/\n/g, "<br>");
  const attCount = vars.attachmentCount || 0;
  const attachmentNote = attCount > 0 ? `<p style="${S.muted}">Attachments: ${attCount} file(s)</p>` : "";

  const bodyHtml = `
<p style="${S.p}">A new support ticket has been submitted by <strong style="${S.strong}">${safeName}</strong> (<a href="mailto:${safeEmail}" style="color:${ACCENT_BLUE};">${safeEmail}</a>):</p>

<table style="${S.table}">
  <tr><td style="${S.tdLabel}">Ticket ID:</td><td style="${S.tdValue}"><strong style="${S.strong}">${ticketRef}</strong></td></tr>
  <tr><td style="${S.tdLabel}">Title:</td><td style="${S.tdValue}">${safeTitle}</td></tr>
  <tr><td style="${S.tdLabel}">Type:</td><td style="${S.tdValue}"><span style="${S.badge}">${safeType}</span></td></tr>
  <tr><td style="${S.tdLabel}">Urgency:</td><td style="${S.tdValue}"><span style="${S.badge}">${safeUrgency}</span></td></tr>
  <tr><td style="${S.tdLabel}">Requester Roles:</td><td style="${S.tdValue}">${safeRoles}</td></tr>
</table>

<div style="${S.infoBox}">
  <h3 style="${S.h3}">Description</h3>
  <div style="font-size:14px;color:#333333;line-height:1.6;">${safeDesc}</div>
  ${attachmentNote}
</div>

<div style="${S.btnWrap}">
  <a href="${vars.ticketUrl}" style="${btn}">View Ticket in Portal</a>
</div>
`;

  const html = wrapInLayout(`New Ticket: ${ticketRef} - ${vars.title}`, bodyHtml, portalName, ACCENT_BLUE);

  const text = `New Support Ticket: ${ticketRef} - ${vars.title}

Requester: ${vars.requesterName} (${vars.requesterEmail})
Roles: ${vars.requesterRoles.join(", ") || "None"}
Type: ${vars.type}
Urgency: ${vars.urgency}
Description:
${vars.description}

${attCount > 0 ? `Attachments: ${attCount} file(s)\n` : ""}View ticket: ${vars.ticketUrl}

${textFooter(portalName)}
`;

  return { html, text };
}
