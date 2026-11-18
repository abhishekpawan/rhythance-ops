// Starts the local Supabase for the tests (idempotent).
import { requireLocal } from "../support/local-only.mjs";
requireLocal();
import { supabase, EXCLUDED_SERVICES, SERVER_DIR } from "../support/stack.mjs";

const status = supabase(["status", "-o", "json"]);
if (status.status === 0 && status.stdout.includes("API_URL")) {
  console.log("local Supabase already running");
} else {
  console.log(
    "starting local Supabase (first start pulls images and can take 15 minutes)..."
  );
  const r = supabase(["start", "-x", EXCLUDED_SERVICES], {
    stdio: "inherit",
    cwd: SERVER_DIR,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
