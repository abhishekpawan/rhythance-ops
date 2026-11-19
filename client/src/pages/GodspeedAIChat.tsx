import { useEffect, useMemo, useRef } from "react";
import { AppHeader } from "../components/AppHeader";
import { IframeViewer } from "../components/IframeViewer";
import { useTheme } from "../components/theme-provider";
import { usePortalSetting } from "../contexts/PortalSettingsContext";
import { useLanguage } from "../contexts/language/language-provider";
import { chatOrigin, startTokenBridge } from "../lib/aiChatBridge";
import { supabase } from "../lib/supabaseClient";
import "../styles/pages/GodspeedAIChat.css";

const DEFAULT_AI_CHAT_URL = "https://godspeed-ops-ai-mhbl.onrender.com/";

export function GodspeedAIChat() {
  const title = usePortalSetting("branding.aiChatTitle") ?? "AI Chat";
  const { language } = useLanguage();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const baseUrl = import.meta.env.VITE_AI_CHAT_URL || DEFAULT_AI_CHAT_URL;
  const aiOrigin = chatOrigin(baseUrl);
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  const initialTheme = useRef(resolvedTheme);

  // The address changes with the language only (the chat page reads it once when it loads); the theme is
  // sent as a message so switching it does not reload the page and lose the conversation.
  const url = useMemo(() => {
    const address = new URL(baseUrl);
    address.searchParams.set("lang", language);
    address.searchParams.set("theme", initialTheme.current);
    return address.toString();
  }, [baseUrl, language]);

  const frame = () =>
    containerRef.current?.querySelector<HTMLIFrameElement>("iframe") ?? null;

  useEffect(() => {
    if (!aiOrigin) return;
    return startTokenBridge({
      aiOrigin,
      getFrame: frame,
      getToken: async () =>
        (await supabase.auth.getSession()).data.session?.access_token ?? null,
      onTokenChange: (listener) => {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          // the chat page asks for the first token itself; this sends the renewed ones
          if (event === "INITIAL_SESSION") return;
          if (session?.access_token) listener(session.access_token);
        });
        return () => data.subscription.unsubscribe();
      },
    });
  }, [aiOrigin]);

  useEffect(() => {
    if (aiOrigin)
      frame()?.contentWindow?.postMessage(
        { type: "theme", value: resolvedTheme },
        aiOrigin
      );
  }, [aiOrigin, resolvedTheme]);

  return (
    <div className="godspeed-ai-chat-container">
      <AppHeader title={title} hideHamburgerMenu={false} />

      <main className="ai-chat-main">
        <div className="ai-chat-content" ref={containerRef}>
          <IframeViewer url={url} title={title} />
        </div>
      </main>
    </div>
  );
}
