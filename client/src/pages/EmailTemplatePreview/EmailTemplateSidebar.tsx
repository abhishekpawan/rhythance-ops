import { ChevronRight, Database, Loader2, Mail, Send } from "lucide-react";
import { StatusBadge } from "../../components/StatusBadge";
import type { EmailTemplateInfo } from "../../services/api/emailTemplates";

interface EmailTemplateSidebarProps {
  allTemplates: EmailTemplateInfo[];
  loading: boolean;
  selectedId: string | null;
  mobileSidebarOpen: boolean;
  handleSelectTemplate: (id: string) => void;
}

/** The list of templates on the left (a drawer on a phone). */
export function EmailTemplateSidebar({
  allTemplates,
  loading,
  selectedId,
  mobileSidebarOpen,
  handleSelectTemplate,
}: EmailTemplateSidebarProps) {
  return (
    <>
      {/* Sidebar */}
      <aside
        className={`etp-sidebar ${mobileSidebarOpen ? "etp-sidebar--open" : ""}`}
      >
        <div className="etp-sidebar-header">
          <Mail size={18} />
          <h2>Email Templates</h2>
        </div>

        {loading ? (
          <div className="etp-sidebar-loading">
            <Loader2 size={20} className="etp-spinner" />
            <span>Loading templates...</span>
          </div>
        ) : (
          <nav className="etp-sidebar-list">
            {allTemplates.map((t) => (
              <button
                key={t.id}
                className={`etp-sidebar-item ${selectedId === t.id ? "etp-sidebar-item--active" : ""}`}
                onClick={() => handleSelectTemplate(t.id)}
              >
                <div className="etp-sidebar-item-content">
                  <div className="etp-sidebar-item-top">
                    <span className="etp-sidebar-item-name">{t.name}</span>
                    <StatusBadge
                      variant="plain"
                      baseClass="etp-service-badge"
                      tone={`etp-service-badge--${t.service}`}
                      icon={
                        t.service === "sendgrid" ? (
                          <Send size={10} />
                        ) : (
                          <Database size={10} />
                        )
                      }
                      label={t.service === "sendgrid" ? "SendGrid" : "Supabase"}
                    />
                  </div>
                  <span className="etp-sidebar-item-desc">{t.description}</span>
                  <span className="etp-sidebar-item-trigger">
                    {t.triggerRef}
                  </span>
                </div>
                <ChevronRight size={14} className="etp-sidebar-item-arrow" />
              </button>
            ))}
          </nav>
        )}

        <div className="etp-sidebar-footer">
          <span className="etp-template-count">
            {allTemplates.length} templates
          </span>
        </div>
      </aside>
    </>
  );
}
