import { Request, Response, NextFunction } from "express";
import sgMail from "@sendgrid/mail";
import path from "path";
import { fileURLToPath } from "url";
import { getPortalSettingSync } from "../services/portalSettings.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailData {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string;
  }>;
}

function getFormattedFromEmail(
  primaryEmail: string | undefined,
  fallbackEmail: string | undefined,
  defaultEmail: string
): string {
  return formatFromEmail(primaryEmail || fallbackEmail || defaultEmail);
}

/**
 * Formats an email address with a display name
 * @param email - The email address
 * @param displayName - Optional display name (defaults to PORTAL_NAME env var or "HDGroup")
 * @returns Formatted email string like "HDGroup <email@example.com>"
 */
export function formatFromEmail(email: string, displayName?: string): string {
  // If email already contains a display name, return as is
  if (email.includes("<") && email.includes(">")) {
    return email;
  }
  // Use provided displayName, otherwise this portal's name (portal settings)
  const brandName = displayName || getPortalSettingSync("portal.name");
  // "Ops Portal" is not repeated when the name already ends with it
  const senderName = /ops portal$/i.test(brandName)
    ? brandName
    : `${brandName} Ops Portal`;
  return `${senderName} <${email}>`;
}

export function getNoReplyFromEmail(): string {
  return getFormattedFromEmail(
    getPortalSettingSync("email.noReplyFrom"),
    getPortalSettingSync("email.defaultFrom"),
    "noreply@example.com"
  );
}

export function getAssignmentFromEmail(): string {
  return getFormattedFromEmail(
    getPortalSettingSync("email.assignmentFrom"),
    getPortalSettingSync("email.noReplyFrom") ||
      getPortalSettingSync("email.defaultFrom"),
    "noreply@example.com"
  );
}

interface EmailNotifierOptions {
  onSuccessEmail?: (
    req: Request,
    res: Response
  ) => EmailData | EmailData[] | null | Promise<EmailData | EmailData[] | null>;
}

export const emailNotifier = (options: EmailNotifierOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", async () => {
      try {
        console.log(
          "[EmailNotifier] Response finished for",
          req.method,
          req.originalUrl,
          "Status:",
          res.statusCode
        );
        if (
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          options.onSuccessEmail
        ) {
          console.log("[EmailNotifier] onSuccessEmail callback triggered");
          const emailData = await options.onSuccessEmail(req, res);
          if (emailData) {
            // Handle both single email and array of emails
            const emails = Array.isArray(emailData) ? emailData : [emailData];

            for (const email of emails) {
              // Ensure 'text' is always a string (required by SendGrid)
              const text = email.text ?? "";
              const fromEmail = email.from || getNoReplyFromEmail();
              console.log("[EmailNotifier] Sending email:", {
                to: email.to,
                subject: email.subject,
                from: fromEmail,
              });
              await sgMail.send({ from: fromEmail, ...email, text });
              console.log(
                "[EmailNotifier] Email sent successfully to",
                email.to
              );
            }
          } else {
            console.log(
              "[EmailNotifier] No emailData returned from onSuccessEmail, skipping email send."
            );
          }
        }
      } catch (err) {
        console.error("EmailNotifier: Failed to send success email:", err);
      }
    });
    next();
  };
};
