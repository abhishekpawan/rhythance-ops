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

export interface SupportAgentReplyEmailVars {
  ticketNumber: number | string;
  title: string;
  requesterName: string;
  body: string;
  attachmentCount?: number;
  ticketUrl: string;
}

export function renderSupportAgentReplyEmail(vars: SupportAgentReplyEmailVars): { html: string; text: string } {
  const portalName = getPortalName();
  const ticketRef = `SUP-${String(vars.ticketNumber).padStart(4, "0")}`;
  const btn = accentBtn(ACCENT_BLUE);

  const safeTitle = esc(vars.title);
  const safeName = esc(vars.requesterName);
  const safeBody = esc(vars.body).replace(/\n/g, "<br>");
  const attCount = vars.attachmentCount || 0;
  const attachmentNote = attCount > 0 ? `<p style="${S.muted}">Attachments: ${attCount} file(s)</p>` : "";

  const bodyHtml = `
<p style="${S.p}">Hi <strong style="${S.strong}">${safeName}</strong>,</p>

<p style="${S.p}">The Support Team has replied to your ticket <strong style="${S.strong}">${ticketRef}</strong>: <em style="color:#555;">${safeTitle}</em>.</p>

<div style="${S.infoBox}">
  <h3 style="${S.h3}">Support Team Response</h3>
  <div style="font-size:14px;color:#333333;line-height:1.6;">${safeBody}</div>
  ${attachmentNote}
</div>

<p style="${S.p}">You can view the full discussion thread or reply directly in the portal:</p>

<div style="${S.btnWrap}">
  <a href="${vars.ticketUrl}" style="${btn}">View and Reply to Ticket</a>
</div>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Support Team at ${portalName}</strong></p>
`;

  const html = wrapInLayout(`Support Update: ${ticketRef}`, bodyHtml, portalName, ACCENT_BLUE);

  const text = `Hi ${vars.requesterName},

The Support Team has replied to your ticket ${ticketRef}: ${vars.title}.

Support Team Response:
${vars.body}

${attCount > 0 ? `Attachments: ${attCount} file(s)\n` : ""}
View and reply to ticket: ${vars.ticketUrl}

${textFooter(portalName)}
`;

  return { html, text };
}
