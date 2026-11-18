// Starts the test server by hand (for looking around): the real server against the local test
// database, messaging recorded not sent. Ctrl-C stops it. Refuses anything that is not local.
import { requireLocal } from "../support/local-only.mjs";
requireLocal();
import { localStack } from "../support/stack.mjs";
import { startTestServer } from "../support/test-server.mjs";

const server = await startTestServer(localStack());
console.log(
  `test server on ${server.url} (outbound calls are recorded in ${server.outboundLog})`
);
process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
