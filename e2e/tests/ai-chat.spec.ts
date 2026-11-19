// The portal's part of the AI chat (session AI-5a): the chat page, framed by the portal, gets the signed-in person's
// own token with no extra step, and a renewed token reaches it later, so a long conversation keeps working. The
// chat page here is a stand-in that speaks the same contract as the real one (support/ai-chat-stand-in.mjs) and
// uses the token against the local test database's chat functions, so "works" means the database accepted it.
import { expect, test } from "../support/fixtures";

test.use({ storageState: ".auth/admin.json" });

test("the chat gets the sign-in token with no extra step, and a renewed token keeps it working", async ({
  page,
}) => {
  await page.goto("/ai-chat");
  const chat = page.frameLocator("iframe.content-iframe");

  // 1. nothing clicked, nothing typed: the token arrives, and the database accepts it
  await expect(chat.locator("#count")).toHaveText("1");
  await chat.locator("#ask").click();
  await expect(chat.locator("#result")).toContainText('200 {"ok": true');
  await expect(chat.locator("#result")).toContainText('"n": 5');
  const first = await chat.locator("#tail").textContent();

  // 2. the sign-in renews (the stored session is about to expire and the tab comes back into view)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.endsWith("-auth-token")
    );
    if (!key) throw new Error("no stored session");
    const session = JSON.parse(localStorage.getItem(key) as string);
    session.expires_at = Math.floor(Date.now() / 1000) + 5;
    localStorage.setItem(key, JSON.stringify(session));
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  await expect(chat.locator("#count")).toHaveText("2");
  expect(await chat.locator("#tail").textContent()).not.toBe(first);

  // 3. the new token works too
  await chat.locator("#result").evaluate((el) => (el.textContent = ""));
  await chat.locator("#ask").click();
  await expect(chat.locator("#result")).toContainText('200 {"ok": true');
});

for (const language of ["en", "fr"] as const) {
  test.describe(`language ${language}`, () => {
    test.use({ language });
    test(`the chat page is opened in ${language}`, async ({ page }) => {
      await page.goto("/ai-chat");
      const chat = page.frameLocator("iframe.content-iframe");
      await expect(chat.locator("#lang")).toHaveText(language);
      await expect(chat.locator("#theme")).toHaveText(/^(light|dark)$/);
    });
  });
}

test("the token goes only to the chat's own address, never to another page", async ({
  page,
}) => {
  const seen: string[] = [];
  await page.exposeFunction("recordMessage", (origin: string) =>
    seen.push(origin)
  );
  await page.addInitScript(() => {
    if (window !== window.top) return; // the portal page only, not the chat frame
    window.addEventListener("message", (e) => {
      if (e.data?.type === "ai-chat:token")
        (window as any).recordMessage(e.origin);
    });
  });
  await page.goto("/ai-chat");
  await expect(
    page.frameLocator("iframe.content-iframe").locator("#count")
  ).toHaveText("1");
  // the portal page itself never receives a token message (it sends them, to the frame only)
  expect(seen).toEqual([]);
});
