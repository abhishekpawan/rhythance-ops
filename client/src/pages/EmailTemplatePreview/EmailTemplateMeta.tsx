import {
  Database,
  Info,
  Paperclip,
  Send,
  UserCircle,
  Users,
} from "lucide-react";
import type { EmailTemplatePreview } from "../../services/api/emailTemplates";

/** What the page says about the template before its body: name, service, subject, sender, copies, attachments, trigger. */
export function EmailTemplateMeta({
  preview,
}: {
  preview: EmailTemplatePreview;
}) {
  return (
    <>
      {/* Header bar */}
      <div className="etp-preview-header">
        <div className="etp-preview-meta">
          <div className="etp-preview-title-row">
            <h2 className="etp-preview-title">{preview.name}</h2>
            <span
              className={`etp-service-badge etp-service-badge--${preview.service} etp-service-badge--lg`}
            >
              {preview.service === "sendgrid" ? (
                <Send size={12} />
              ) : (
                <Database size={12} />
              )}
              {preview.service === "sendgrid" ? "SendGrid" : "Supabase Auth"}
            </span>
          </div>
          <p className="etp-preview-description">{preview.description}</p>
        </div>
      </div>

      {/* Supabase nudge banner */}
      {preview.service === "supabase" && (
        <div className="etp-supabase-nudge">
          <Info size={16} />
          <div>
            <strong>Managed by Supabase Auth</strong>
            <p>
              This email is triggered and sent directly by Supabase. To
              customise its content, go to{" "}
              <strong>
                Supabase Dashboard → Authentication → Email Templates
              </strong>
              . The preview below is a placeholder.
            </p>
          </div>
        </div>
      )}

      {/* Metadata rows: Subject, From, CC, Attachments */}
      <div className="etp-meta-table">
        <div className="etp-meta-row">
          <span className="etp-meta-label">Subject</span>
          <span className="etp-meta-value">{preview.subject}</span>
        </div>
        <div className="etp-meta-row">
          <UserCircle size={14} className="etp-meta-icon" />
          <span className="etp-meta-label">From</span>
          <span className="etp-meta-value">{preview.from}</span>
        </div>
        {(preview.cc.length > 0 || preview.dynamicCc) && (
          <div className="etp-meta-row">
            <Users size={14} className="etp-meta-icon" />
            <span className="etp-meta-label">CC</span>
            <span className="etp-meta-value">
              {preview.cc.length > 0 ? preview.cc.join(", ") : ""}
              {preview.dynamicCc && (
                <span className="etp-meta-dynamic">
                  {" "}
                  + dynamic client CC emails
                </span>
              )}
            </span>
          </div>
        )}
        {preview.attachments.length > 0 && (
          <div className="etp-meta-row">
            <Paperclip size={14} className="etp-meta-icon" />
            <span className="etp-meta-label">Attachments</span>
            <span className="etp-meta-value">
              {preview.attachments.join(", ")}
            </span>
          </div>
        )}
        <div className="etp-meta-row">
          <span className="etp-meta-label">Trigger</span>
          <span className="etp-meta-value etp-meta-trigger">
            {preview.triggerRef}
          </span>
        </div>
      </div>
    </>
  );
}
