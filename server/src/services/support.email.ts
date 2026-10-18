import sgMail from "@sendgrid/mail";
import { getNoReplyFromEmail } from "../middleware/emailNotifier.js";
import { getPortalName } from "../email-templates/_layout.js";
import { renderSupportNewTicketEmail } from "../email-templates/support-new-ticket.js";
import { renderSupportRequesterMessageEmail } from "../email-templates/support-requester-message.js";
import { renderSupportTicketReopenedEmail } from "../email-templates/support-ticket-reopened.js";
import { renderSupportAgentReplyEmail } from "../email-templates/support-agent-reply.js";
import { renderSupportStatusChangedEmail } from "../email-templates/support-status-changed.js";
import { DbSupportTicket, SupportTicket } from "../types.js";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function getClientUrl(): string {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function formatTicketRef(ticketNumber: number | string): string {
  return `SUP-${String(ticketNumber).padStart(4, "0")}`;
}

function buildSubject(ticketNumber: number | string, title: string): string {
  const portalName = getPortalName();
  const ticketRef = formatTicketRef(ticketNumber);
  return `[${portalName}] ${ticketRef}: ${title}`;
}

function getAgentRecipients(): { to: string[]; cc?: string[] } | null {
  const toRaw = process.env.SUPPORT_NOTIFY_TO || "";
  const to = toRaw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (to.length === 0) {
    return null;
  }

  const ccRaw = process.env.SUPPORT_NOTIFY_CC || "";
  const cc = ccRaw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return {
    to,
    ...(cc.length > 0 ? { cc } : {}),
  };
}

/**
 * Event: new ticket -> agent
 */
export async function sendNewTicketEmail(
  ticket: DbSupportTicket | SupportTicket,
  attachmentCount: number = 0
): Promise<void> {
  const ticketId = ticket.id;
  const ticketNumber = "ticket_number" in ticket ? ticket.ticket_number : ticket.ticketNumber;
  const title = ticket.title;

  const recipients = getAgentRecipients();
  if (!recipients) {
    console.warn(`[SupportEmail] SUPPORT_NOTIFY_TO is missing; skipping agent email for ticket ${ticketId}`);
    return;
  }

  const requesterName = "requester_name" in ticket ? ticket.requester_name : (ticket as SupportTicket).requesterName;
  const requesterEmail = "requester_email" in ticket ? ticket.requester_email : (ticket as SupportTicket).requesterEmail || "";
  const requesterRoles = "requester_roles" in ticket ? ticket.requester_roles : (ticket as SupportTicket).requesterRoles || [];
  const areaLabel = "area_label" in ticket ? ticket.area_label : (ticket as SupportTicket).areaLabel;
  const pageUrl = "page_url" in ticket ? ticket.page_url : (ticket as SupportTicket).pageUrl;

  const ticketUrl = `${getClientUrl()}/support/${ticketId}`;
  const subject = buildSubject(ticketNumber, title);

  const { html, text } = renderSupportNewTicketEmail({
    ticketNumber,
    title,
    requesterName,
    requesterEmail,
    requesterRoles,
    type: ticket.type,
    urgency: ticket.urgency,
    areaLabel,
    pageUrl,
    description: title, // title represents the summary/description heading
    attachmentCount,
    ticketUrl,
  });

  const msg: sgMail.MailDataRequired = {
    to: recipients.to,
    cc: recipients.cc,
    from: getNoReplyFromEmail(),
    subject,
    html,
    text,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error(`[SupportEmail] Failed to send email for ticket ${ticketId}:`, err?.message || err);
  }
}

/**
 * Event: requester message -> agent
 */
export async function sendRequesterMessageEmail(
  ticket: DbSupportTicket | SupportTicket,
  authorName: string,
  body: string,
  attachmentCount: number = 0
): Promise<void> {
  const ticketId = ticket.id;
  const ticketNumber = "ticket_number" in ticket ? ticket.ticket_number : ticket.ticketNumber;
  const title = ticket.title;

  const recipients = getAgentRecipients();
  if (!recipients) {
    console.warn(`[SupportEmail] SUPPORT_NOTIFY_TO is missing; skipping agent email for ticket ${ticketId}`);
    return;
  }

  const ticketUrl = `${getClientUrl()}/support/${ticketId}`;
  const subject = buildSubject(ticketNumber, title);

  const { html, text } = renderSupportRequesterMessageEmail({
    ticketNumber,
    title,
    authorName,
    body,
    attachmentCount,
    ticketUrl,
  });

  const msg: sgMail.MailDataRequired = {
    to: recipients.to,
    cc: recipients.cc,
    from: getNoReplyFromEmail(),
    subject,
    html,
    text,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error(`[SupportEmail] Failed to send email for ticket ${ticketId}:`, err?.message || err);
  }
}

/**
 * Event: reopen -> agent
 */
export async function sendTicketReopenedEmail(
  ticket: DbSupportTicket | SupportTicket,
  reopenedByName: string,
  body?: string | null
): Promise<void> {
  const ticketId = ticket.id;
  const ticketNumber = "ticket_number" in ticket ? ticket.ticket_number : ticket.ticketNumber;
  const title = ticket.title;

  const recipients = getAgentRecipients();
  if (!recipients) {
    console.warn(`[SupportEmail] SUPPORT_NOTIFY_TO is missing; skipping agent email for ticket ${ticketId}`);
    return;
  }

  const ticketUrl = `${getClientUrl()}/support/${ticketId}`;
  const subject = buildSubject(ticketNumber, title);

  const { html, text } = renderSupportTicketReopenedEmail({
    ticketNumber,
    title,
    reopenedByName,
    body,
    ticketUrl,
  });

  const msg: sgMail.MailDataRequired = {
    to: recipients.to,
    cc: recipients.cc,
    from: getNoReplyFromEmail(),
    subject,
    html,
    text,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error(`[SupportEmail] Failed to send email for ticket ${ticketId}:`, err?.message || err);
  }
}

/**
 * Event: agent non-internal message -> requester
 */
export async function sendAgentReplyEmail(
  ticket: DbSupportTicket | SupportTicket,
  body: string,
  attachmentCount: number = 0
): Promise<void> {
  const ticketId = ticket.id;
  const ticketNumber = "ticket_number" in ticket ? ticket.ticket_number : ticket.ticketNumber;
  const title = ticket.title;
  const requesterEmail = "requester_email" in ticket ? ticket.requester_email : (ticket as SupportTicket).requesterEmail;
  const requesterName = "requester_name" in ticket ? ticket.requester_name : (ticket as SupportTicket).requesterName;

  if (!requesterEmail) {
    console.warn(`[SupportEmail] Requester email missing; skipping email for ticket ${ticketId}`);
    return;
  }

  const ticketUrl = `${getClientUrl()}/support/${ticketId}`;
  const subject = buildSubject(ticketNumber, title);

  const { html, text } = renderSupportAgentReplyEmail({
    ticketNumber,
    title,
    requesterName: requesterName || "User",
    body,
    attachmentCount,
    ticketUrl,
  });

  const msg: sgMail.MailDataRequired = {
    to: requesterEmail,
    from: getNoReplyFromEmail(),
    subject,
    html,
    text,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error(`[SupportEmail] Failed to send email for ticket ${ticketId}:`, err?.message || err);
  }
}

/**
 * Event: status to waiting_on_client / resolved -> requester
 */
export async function sendStatusChangedEmail(
  ticket: DbSupportTicket | SupportTicket,
  newStatus: "waiting_on_client" | "resolved" | string
): Promise<void> {
  const ticketId = ticket.id;
  const ticketNumber = "ticket_number" in ticket ? ticket.ticket_number : ticket.ticketNumber;
  const title = ticket.title;
  const requesterEmail = "requester_email" in ticket ? ticket.requester_email : (ticket as SupportTicket).requesterEmail;
  const requesterName = "requester_name" in ticket ? ticket.requester_name : (ticket as SupportTicket).requesterName;

  if (!requesterEmail) {
    console.warn(`[SupportEmail] Requester email missing; skipping email for ticket ${ticketId}`);
    return;
  }

  const ticketUrl = `${getClientUrl()}/support/${ticketId}`;
  const subject = buildSubject(ticketNumber, title);

  const { html, text } = renderSupportStatusChangedEmail({
    ticketNumber,
    title,
    requesterName,
    newStatus,
    ticketUrl,
  });

  const msg: sgMail.MailDataRequired = {
    to: requesterEmail,
    from: getNoReplyFromEmail(),
    subject,
    html,
    text,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error(`[SupportEmail] Failed to send email for ticket ${ticketId}:`, err?.message || err);
  }
}
