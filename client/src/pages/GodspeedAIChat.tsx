import { AppHeader } from "../components/AppHeader";
import { IframeViewer } from "../components/IframeViewer";
import { usePortalSetting } from "../contexts/PortalSettingsContext";
import "../styles/pages/GodspeedAIChat.css";

export function GodspeedAIChat() {
  const title = usePortalSetting("branding.aiChatTitle") ?? "AI Chat";
  const AI_CHAT_URL =
    import.meta.env.VITE_AI_CHAT_URL ||
    "https://godspeed-ops-ai-mhbl.onrender.com/";

  return (
    <div className="godspeed-ai-chat-container">
      <AppHeader title={title} hideHamburgerMenu={false} />

      <main className="ai-chat-main">
        <div className="ai-chat-content">
          <IframeViewer url={AI_CHAT_URL} title={title} />
        </div>
      </main>
    </div>
  );
}
