// Signs in once per account that the Reports journeys use (through the real login form and the two-step
// code) and saves the browser state, so those journeys start signed in. The sign-in journeys themselves
// (sign-in.spec.ts) do not use these files.
import { test, signIn } from "../support/fixtures";
import { SIGNED_IN_ROLES, staff } from "../support/accounts";

for (const role of SIGNED_IN_ROLES) {
  test(`sign in ${role} and keep the browser state`, async ({ page }) => {
    await signIn(page, staff[role], true);
    await page.context().storageState({ path: `.auth/${role}.json` });
  });
}
