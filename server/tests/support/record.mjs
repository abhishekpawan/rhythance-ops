// Recorder shared by the stubs: one JSON line per outbound call, appended to the file named by
// TEST_OUTBOUND_LOG. Tests read it to see what the server tried to send. Nothing is ever sent.
import { appendFileSync } from "node:fs";

export function record(entry) {
  const file = process.env.TEST_OUTBOUND_LOG;
  if (!file) return;
  appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

/** Reduces an email message to what a test needs to assert, and never stores a body of personal data. */
export function describeMail(msg) {
  const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : x?.email ?? ""));
  return {
    kind: "email",
    to: list(msg.to),
    cc: list(msg.cc),
    bcc: list(msg.bcc),
    from: typeof msg.from === "string" ? msg.from : msg.from?.email,
    subject: msg.subject,
    templateId: msg.templateId,
    attachments: (msg.attachments ?? []).map((a) => a.filename),
    htmlLength: typeof msg.html === "string" ? msg.html.length : 0,
    textLength: typeof msg.text === "string" ? msg.text.length : 0,
  };
}
