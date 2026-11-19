// Sign in through the real login form, in English and in French: every seeded staff account and two
// jobseekers land where they should, and the Reports menu is open to the roles the client lets in (and
// sends the others back to the dashboard). Expected texts are written by hand from the translation files
// (client/src/contexts/language/locales); expected access from client/src/constants/accessControl.ts.
import { expect, signIn, test } from "../support/fixtures";
import {
  jobseekers,
  PASSWORD,
  signupJobseeker,
  staff,
} from "../support/accounts";

type Language = "en" | "fr";
const WELCOME: Record<Language, string> = { en: "Welcome", fr: "Bienvenue" };
const ROLE_LABEL: Record<Language, Record<string, string>> = {
  en: {
    admin: "Administrator",
    recruiter: "Recruiter",
    bookkeeper: "Bookkeeper",
    recruiter_manager: "Recruiter Manager",
    accountant_manager: "Accountant Manager",
    sales: "Sales",
    recruiter_director: "Recruiter Director",
  },
  fr: {
    admin: "Administrateur",
    recruiter: "Recruteur",
    bookkeeper: "Teneur de livres",
    recruiter_manager: "Gestionnaire du recrutement",
    accountant_manager: "Gestionnaire comptable",
    sales: "Ventes",
    recruiter_director: "Directeur du recrutement",
  },
};

// key in the seed -> the role the dashboard shows (a super admin is shown as an administrator)
const STAFF_ROLES: Record<string, string> = {
  admin: "admin",
  superadmin: "admin",
  recruiter: "recruiter",
  bookkeeper: "bookkeeper",
  recruiter_manager: "recruiter_manager",
  accountant_manager: "accountant_manager",
  sales: "sales",
  recruiter_director: "recruiter_director",
};
// REPORTS_ROLES in client/src/constants/accessControl.ts
const MAY_OPEN_REPORTS = new Set([
  "admin",
  "bookkeeper",
  "accountant_manager",
  "recruiter_director",
  "sales",
]);

for (const language of ["en", "fr"] as const) {
  test.describe(`in ${language}`, () => {
    test.use({ language });

    for (const [key, role] of Object.entries(STAFF_ROLES)) {
      test(`${key}: signs in with the phone code and lands on the dashboard`, async ({
        page,
      }) => {
        await signIn(page, staff[key], true);
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator(".dashboard-heading")).toHaveText(
          `${WELCOME[language]}, ${staff[key].name}!${ROLE_LABEL[language][role]}`
        );

        await page.goto("/reports");
        if (MAY_OPEN_REPORTS.has(role)) {
          await expect(page).toHaveURL(/\/reports$/);
          await expect(page.locator(".report-card")).toHaveCount(9);
        } else {
          // not in REPORTS_ROLES: the client sends the person back to the dashboard
          await expect(page).toHaveURL(/\/dashboard$/);
        }
      });
    }

    for (const [label, account] of [
      ["a jobseeker", jobseekers.sin],
      ["a jobseeker who signed up on the open form", signupJobseeker],
    ] as const) {
      test(`${label} signs in (no phone code) and must first sign the employment agreement`, async ({
        page,
      }) => {
        await page.goto("/login");
        await page.locator("#email").fill(account.email);
        await page.locator("#password").fill(PASSWORD);
        await page.locator('form button[type="submit"]').click();
        // the seeded jobseekers have not signed the employment agreement: the app holds them on that page
        await page.waitForURL("**/onboarding-consent");
        await expect(page.locator("body")).toContainText(
          language === "en" ? "Employment Agreement" : "Contrat de travail"
        );
      });
    }

    // TODAY'S BEHAVIOUR, pinned (inbox row): the server answers a wrong password with 401 and the client's
    // global 401 handler (services/api/index.ts) reloads /login, so the form is emptied and the error
    // text the login page would show (auth.invalidCredentials, in both languages) never appears.
    test("a wrong password sends the person back to an empty login form with no error shown", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.locator("#email").fill(staff.admin.email);
      await page.locator("#password").fill("not-the-password");
      const reloaded = page.waitForEvent("load");
      await page.locator('form button[type="submit"]').click();
      await reloaded;
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator("#email")).toHaveValue("");
      await expect(page.locator(".error-container")).toHaveCount(0);
    });
  });
}

test("the language switch on the login page changes the language, and it is kept after signing in", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator("h1.auth-title")).toHaveText("Login");
  await page
    .locator(".language-toggle-wrapper .custom-dropdown-trigger")
    .click();
  await page
    .locator(".language-toggle-wrapper .custom-dropdown-option")
    .filter({ hasText: "Français" })
    .click();
  await expect(page.locator("h1.auth-title")).toHaveText("Se connecter");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  await signIn(page, staff.admin, true);
  await expect(page.locator(".dashboard-heading")).toHaveText(
    "Bienvenue, Test Admin!Administrateur"
  );
});
