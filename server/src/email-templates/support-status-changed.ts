import { wrapInLayout, S, getPortalName, textFooter, ACCENT_BLUE, ACCENT_GREEN, accentBtn } from "./_layout.js";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SupportStatusChangedEmailVars {
  ticketNumber: number | string;
  title: string;
  requesterName: string;
  newStatus: "waiting_on_client" | "resolved" | string;
  ticketUrl: string;
}

export function renderSupportStatusChangedEmail(vars: SupportStatusChangedEmailVars): { html: string; text: string } {
  const portalName = getPortalName();
  const ticketRef = `SUP-${String(vars.ticketNumber).padStart(4, "0")}`;
  const isResolved = vars.newStatus === "resolved";
  const accentColor = isResolved ? ACCENT_GREEN : ACCENT_BLUE;
  const btn = accentBtn(accentColor);

  const safeTitle = esc(vars.title);
  const safeName = esc(vars.requesterName);

  const statusDisplay = isResolved ? "Resolved" : "Waiting on Client";

  const messageText = isResolved
    ? "Your ticket has been marked as <strong>Resolved</strong>. If your issue has been resolved to your satisfaction, please log into the portal to confirm and close the ticket. If you still require assistance, you may reply to reopen it."
    : "Your ticket status has been updated to <strong>Waiting on Client</strong>. Our team needs additional information or action from you to proceed. Please review the ticket and reply at your convenience.";

  const bodyHtml = `
<p style="${S.p}">Hi <strong style="${S.strong}">${safeName}</strong>,</p>

<p style="${S.p}">The status of your ticket <strong style="${S.strong}">${ticketRef}</strong> (<em style="color:#555;">${safeTitle}</em>) has been updated to <strong style="${S.strong}">${statusDisplay}</strong>.</p>

<div style="${S.notice}">
  ${messageText}
</div>

<div style="${S.btnWrap}">
  <a href="${vars.ticketUrl}" style="${btn}">${isResolved ? "Confirm Resolution or Reply" : "View and Respond to Ticket"}</a>
</div>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Support Team at ${portalName}</strong></p>
`;

  const html = wrapInLayout(`Ticket Status Update: ${ticketRef} - ${statusDisplay}`, bodyHtml, portalName, accentColor);

  const text = `Hi ${vars.requesterName},

The status of your ticket ${ticketRef} (${vars.title}) has been updated to: ${statusDisplay}.

${isResolved
  ? "Your ticket has been marked as Resolved. If your issue has been resolved, please log into the portal to confirm and close the ticket. If you still require assistance, reply to reopen it."
  : "Your ticket is now Waiting on Client. We need additional information or action from you to proceed. Please review the ticket and reply at your convenience."}

View ticket: ${vars.ticketUrl}

${textFooter(portalName)}
`;

  return { html, text };
}
