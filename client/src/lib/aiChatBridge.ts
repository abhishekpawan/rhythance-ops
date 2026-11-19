/**
 * Hands the signed-in person's own token to the AI chat page shown in the portal's frame, so staff
 * never sign in a second time. The page asks for it when it loads ("ai-chat:ready") and the portal pushes a
 * fresh one every time the sign-in renews, so a long conversation keeps working.
 *
 * The token goes only to the chat service's own address: it is checked on every incoming message
 * (the sender must be that origin) and every outgoing one (the target origin is that address, never "*").
 */

export interface MessageTarget {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void
  ): void;
}

export interface TokenBridgeOptions {
  /** The chat service's origin, for example "https://chat.example.com". */
  aiOrigin: string;
  /** The chat page's frame (null before it exists). */
  getFrame: () => HTMLIFrameElement | null;
  /** The current access token, or null when signed out. */
  getToken: () => Promise<string | null>;
  /** Calls `listener` with the new token whenever the sign-in renews; returns the unsubscribe. */
  onTokenChange: (listener: (token: string) => void) => () => void;
  target?: MessageTarget;
}

/** The origin of the chat address, or null when it is not a valid absolute address. */
export function chatOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function startTokenBridge(options: TokenBridgeOptions): () => void {
  const { aiOrigin, getFrame, getToken, onTokenChange } = options;
  const target: MessageTarget =
    options.target ?? (window as unknown as MessageTarget);

  const send = (frame: Window | null | undefined, token: string) =>
    frame?.postMessage({ type: "ai-chat:token", token }, aiOrigin);

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== aiOrigin) return;
    if (event.data?.type !== "ai-chat:ready") return;
    const frame = getFrame()?.contentWindow;
    // only the portal's own chat frame gets the token, not any other window on the chat's address
    if (!frame || event.source !== frame) return;
    void getToken().then((token) => {
      if (token) send(frame, token);
    });
  };

  target.addEventListener("message", onMessage);
  const unsubscribe = onTokenChange((token) =>
    send(getFrame()?.contentWindow, token)
  );
  return () => {
    target.removeEventListener("message", onMessage);
    unsubscribe();
  };
}
