// AI-5a: the portal hands the signed-in person's token to the AI chat frame, and only to it.
import { describe, expect, it } from "vitest";
import {
  chatOrigin,
  resolveChatService,
  startTokenBridge,
  type MessageTarget,
} from "../../../client/src/lib/aiChatBridge";

const AI = "https://chat.example.com";

function setup(token: string | null = "tok-1") {
  const listeners = new Set<(e: MessageEvent) => void>();
  const target: MessageTarget = {
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  const sent: { message: any; origin: string }[] = [];
  const frameWindow = {
    postMessage: (message: any, origin: string) =>
      void sent.push({ message, origin }),
  };
  const iframe = { contentWindow: frameWindow } as unknown as HTMLIFrameElement;
  let pushToken: (t: string) => void = () => {};
  let unsubscribed = false;
  const stop = startTokenBridge({
    aiOrigin: AI,
    getFrame: () => iframe,
    getToken: async () => token,
    onTokenChange: (l) => {
      pushToken = l;
      return () => void (unsubscribed = true);
    },
    target,
  });
  const message = (origin: string, source: unknown, data: unknown) => {
    for (const l of listeners) l({ origin, source, data } as MessageEvent);
  };
  return {
    sent,
    frameWindow,
    stop,
    message,
    listeners,
    push: (t: string) => pushToken(t),
    unsubscribed: () => unsubscribed,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("the token bridge", () => {
  it("answers the chat page's ready message with the token, to the chat's own address only", async () => {
    const b = setup();
    b.message(AI, b.frameWindow, { type: "ai-chat:ready" });
    await tick();
    expect(b.sent).toEqual([
      { message: { type: "ai-chat:token", token: "tok-1" }, origin: AI },
    ]);
  });

  it("ignores a ready message from any other address, or from a window that is not the portal's frame", async () => {
    const b = setup();
    b.message("https://evil.example.com", b.frameWindow, {
      type: "ai-chat:ready",
    });
    b.message(AI, { postMessage: () => {} }, { type: "ai-chat:ready" });
    b.message(AI, b.frameWindow, { type: "something-else" });
    b.message(AI, b.frameWindow, null);
    await tick();
    expect(b.sent).toEqual([]);
  });

  it("sends nothing when signed out", async () => {
    const b = setup(null);
    b.message(AI, b.frameWindow, { type: "ai-chat:ready" });
    await tick();
    expect(b.sent).toEqual([]);
  });

  it("pushes a fresh token each time the sign-in renews, always to the chat's address", () => {
    const b = setup();
    b.push("tok-2");
    b.push("tok-3");
    expect(b.sent.map((s) => s.message.token)).toEqual(["tok-2", "tok-3"]);
    expect(b.sent.every((s) => s.origin === AI && s.origin !== "*")).toBe(true);
  });

  it("stops listening and unsubscribes when the page closes", () => {
    const b = setup();
    b.stop();
    expect(b.listeners.size).toBe(0);
    expect(b.unsubscribed()).toBe(true);
  });

  it("reads the origin from the chat address, and refuses a bad one", () => {
    expect(chatOrigin("https://chat.example.com/some/path?x=1")).toBe(AI);
    expect(chatOrigin("not a url")).toBeNull();
  });
});

describe("the chat service address (AI-4: no fallback)", () => {
  it("is the configured address and its origin", () => {
    expect(resolveChatService(" https://chat.example.com/path ")).toEqual({
      baseUrl: "https://chat.example.com/path",
      origin: AI,
    });
  });

  it("is nothing when the address is missing or not an address, so the page shows a notice and sends no token", () => {
    for (const value of [undefined, "", "   ", "not a url", "godspeed-ops-ai"])
      expect(resolveChatService(value), String(value)).toBeNull();
  });
});
