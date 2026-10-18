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

export interface SupportRequesterMessageEmailVars {
  ticketNumber: number | string;
  title: string;
  authorName: string;
  body: string;
  attachmentCount?: number;
  ticketUrl: string;
}

export function renderSupportRequesterMessageEmail(vars: SupportRequesterMessageEmailVars): { html: string; text: string } {
  const portalName = getPortalName();
  const ticketRef = `SUP-${String(vars.ticketNumber).padStart(4, "0")}`;
  const btn = accentBtn(ACCENT_BLUE);

  const safeTitle = esc(vars.title);
  const safeAuthor = esc(vars.authorName);
  const safeBody = esc(vars.body).replace(/\n/g, "<br>");
  const attCount = vars.attachmentCount || 0;
  const attachmentNote = attCount > 0 ? `<p style="${S.muted}">Attachments: ${attCount} file(s)</p>` : "";

  const bodyHtml = `
<p style="${S.p}"><strong style="${S.strong}">${safeAuthor}</strong> has replied on ticket <strong style="${S.strong}">${ticketRef}</strong>: <em style="color:#555;">${safeTitle}</em>.</p>

<div style="${S.infoBox}">
  <h3 style="${S.h3}">Message</h3>
  <div style="font-size:14px;color:#333333;line-height:1.6;">${safeBody}</div>
  ${attachmentNote}
</div>

<div style="${S.btnWrap}">
  <a href="${vars.ticketUrl}" style="${btn}">View and Reply to Ticket</a>
</div>
`;

  const html = wrapInLayout(`New Reply on ${ticketRef}`, bodyHtml, portalName, ACCENT_BLUE);

  const text = `New reply on ticket ${ticketRef}: ${vars.title}

Author: ${vars.authorName}

Message:
${vars.body}

${attCount > 0 ? `Attachments: ${attCount} file(s)\n` : ""}
View ticket: ${vars.ticketUrl}

${textFooter(portalName)}
`;

  return { html, text };
}
