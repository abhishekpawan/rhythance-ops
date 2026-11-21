import { ChevronRight, Database, Loader2, Mail, Send } from "lucide-react";
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
                    <span
                      className={`etp-service-badge etp-service-badge--${t.service}`}
                    >
                      {t.service === "sendgrid" ? (
                        <Send size={10} />
                      ) : (
                        <Database size={10} />
                      )}
                      {t.service === "sendgrid" ? "SendGrid" : "Supabase"}
                    </span>
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
