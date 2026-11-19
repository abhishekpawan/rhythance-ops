// DEV-1 (from AI-2): the AI document check gets only the id, the user id and the documents; it has no
// default address (the old default was a dead Heroku app) and a missing address is a logged skip, not a request.
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let received: { headers: http.IncomingHttpHeaders; body: any }[] = [];
let server: http.Server;
let url = "";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body: JSON.parse(raw) });
      res.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as any).port}/analyze-profile-documents`;
});
afterAll(() => new Promise((r) => server.close(r)));

const load = async (aiUrl: string) => {
  vi.resetModules();
  process.env.AI_VERIFICATION_URL = aiUrl; // set (even empty) so dotenv never fills it from server/.env
  return import("../../src/services/aiVerification");
};

const profile = {
  id: "p1",
  user_id: "u1",
  documents: [{ id: "d1", documentType: "sin", documentPath: "u1/sin.pdf" }],
  first_name: "Ada",
  dob: "1990-01-01",
  sin_number: "123456789",
  pay_rate: "20",
};

describe("sendDocumentsToAiCheck", () => {
  it("sends only id, user_id and documents, and the caller's own Authorization header", async () => {
    received = [];
    const { sendDocumentsToAiCheck } = await load(url);
    await sendDocumentsToAiCheck(profile as any, "Bearer abc");
    expect(received).toHaveLength(1);
    expect(Object.keys(received[0].body).sort()).toEqual([
      "documents",
      "id",
      "user_id",
    ]);
    expect(received[0].body.documents).toEqual(profile.documents);
    expect(JSON.stringify(received[0].body)).not.toMatch(/123456789|Ada|1990/);
    expect(received[0].headers.authorization).toBe("Bearer abc");
  });

  it("with no address set: no request, a clear error in the log, no throw", async () => {
    received = [];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendDocumentsToAiCheck, aiVerificationUrl } = await load("");
    expect(aiVerificationUrl()).toBeNull();
    await expect(
      sendDocumentsToAiCheck(profile as any, "Bearer abc")
    ).resolves.toBeUndefined();
    expect(received).toHaveLength(0);
    expect(error.mock.calls.flat().join(" ")).toContain("AI_VERIFICATION_URL");
    error.mockRestore();
  });

  it("a failing check (unreachable service) is logged and never thrown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendDocumentsToAiCheck } = await load("http://127.0.0.1:9/x");
    await expect(
      sendDocumentsToAiCheck(profile as any)
    ).resolves.toBeUndefined();
    error.mockRestore();
  });
});
