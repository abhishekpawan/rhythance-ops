// Test-only preload: turns the feature flags named in TEST_FORCE_FLAGS on for this server process only, by
// adding an override row to the server's read of the feature_flags table. The database is not touched, so the
// other test servers (which share it) keep the default. The server's source is unchanged.
const forced = (process.env.TEST_FORCE_FLAGS ?? "").split(",").filter(Boolean);

if (forced.length) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input : (input.url ?? String(input));
    const method = (init?.method ?? input?.method ?? "GET").toUpperCase();
    const res = await realFetch(input, init);
    if (
      method !== "GET" ||
      !url.includes("/rest/v1/feature_flags") ||
      !res.ok
    ) {
      return res;
    }
    const rows = await res.json();
    const kept = rows.filter((row) => !forced.includes(row.key));
    for (const key of forced) {
      kept.push({
        key,
        enabled: true,
        config: null,
        updated_by: null,
        updated_by_name: null,
        updated_at: new Date().toISOString(),
      });
    }
    return new Response(JSON.stringify(kept), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
