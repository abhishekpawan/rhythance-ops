// A local stand-in for the AI document-check service. The server posts a profile's documents to
// AI_VERIFICATION_URL; here the post is recorded and answered with a fixed body. No document leaves the machine.
import http from "node:http";
import { record } from "./record.mjs";

export function startAiStub() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let size = 0;
      req.on("data", (chunk) => (size += chunk.length));
      req.on("end", () => {
        record({
          kind: "ai-check",
          method: req.method,
          path: req.url,
          bytes: size,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "stubbed", results: [] }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/analyze-profile-documents`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
