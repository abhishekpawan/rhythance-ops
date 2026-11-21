// The brand name in a translated text ({{brandName}}) follows the public settings: a browser that remembers
// another brand name from an earlier visit shows the one the server answers with as soon as the settings
// load. The translation function must not keep the remembered one (SPEED-1 step 1 changed how it is built).
// The sign-in page is used (the alt text of its logo, "<brand> Logo"): it depends on the language context alone.
import { expect, test } from "../support/fixtures";

test("a remembered brand name is replaced by the one the server sends", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "portal-public-settings",
      JSON.stringify({ "branding.brandName": "Remembered Brand Ltd" })
    );
  });
  await page.goto("/login");
  const logo = page.getByAltText(/ Logo$/);
  await expect(logo).toHaveAttribute("alt", "Motion Falcon Logo");
  await expect(page).toHaveTitle("Motion Falcon Operations Portal");
});
