// By hand only (skipped unless E2E_AI_CHAT_URL is set): the portal and the REAL AI chat service together, with a real
// model, against the local test database (made-up data). It proves the whole path in a browser: the chat answers
// straight after the portal sign-in, keeps answering after the sign-in renews, and answers in French.
//
//   1. in the AI repo:  OPENAI_API_KEY=... SUPABASE_URL=<local api> SUPABASE_KEY=<local anon key> CHAT_ENABLED=true \
//        ALLOWED_ORIGINS=http://localhost:5199 uvicorn main:app --port 8099
//   2. here:            E2E_CLIENT_PORT=5199 E2E_AI_CHAT_URL=http://127.0.0.1:8099 E2E_REUSE_DB=1 \
//        npx playwright test tests/ai-chat-real.spec.ts --project=setup --project=journeys
import { expect, test } from "../support/fixtures";

test.skip(
  !process.env.E2E_AI_CHAT_URL,
  "needs the real chat service (see the top of this file)"
);
test.use({ storageState: ".auth/admin.json" });
test.setTimeout(180_000);

async function ask(page: import("@playwright/test").Page, question: string) {
  const chat = page.frameLocator("iframe.content-iframe");
  const before = await chat.locator(".msg.assistant").count();
  await chat.locator("#input").fill(question);
  await chat.locator("#send").click();
  await expect(chat.locator(".msg.assistant, .msg.error")).toHaveCount(
    before + 1,
    { timeout: 90_000 }
  );
  if (process.env.E2E_SHOT_DIR)
    await page.screenshot({
      path: `${process.env.E2E_SHOT_DIR}/chat-${question.length}.png`,
    });
  return chat.locator(".msg").last();
}

test("answers straight after sign-in, after the sign-in renews, and in French", async ({
  page,
}) => {
  await page.goto("/ai-chat");
  const first = await ask(page, "How many jobseekers do we have?");
  await expect(first).toContainText("5");

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.endsWith("-auth-token")
    );
    const session = JSON.parse(localStorage.getItem(key as string) as string);
    session.expires_at = Math.floor(Date.now() / 1000) + 5;
    localStorage.setItem(key as string, JSON.stringify(session));
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  // give the portal a moment to push the renewed token, then ask again in the same conversation
  await page.waitForTimeout(1500);
  const second = await ask(page, "Which clients bill in USD?");
  await expect(second).toContainText("Prairie");
});

test.describe("French", () => {
  test.use({ language: "fr" });
  test("the page and the answer are in French", async ({ page }) => {
    await page.goto("/ai-chat");
    const chat = page.frameLocator("iframe.content-iframe");
    await expect(chat.locator("#send")).toHaveText("Envoyer");
    const answer = await ask(page, "Combien de clients facturent en USD?");
    await expect(answer).toContainText("1");
  });
});
