// Run with the outbound guard preloaded. Tries every way the server could reach a vendor and prints one JSON line.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
const dynamicMail = (await import("@sendgrid/mail")).default;

const result = {};
const attempt = async (name, fn) => {
  try {
    result[name] = { ok: true, value: await fn() };
  } catch (e) {
    result[name] = { ok: false, error: String(e.message ?? e) };
  }
  if (process.env.PROBE_DEBUG) console.error(name, JSON.stringify(result[name]));
};

sgMail.setApiKey("SG.fake");
await attempt("sendgrid", async () => (await sgMail.send({ to: "someone@example.test", from: "no-reply@example.test", subject: "Hello", html: "<p>x</p>" }))[0].statusCode);
await attempt("sendgrid-dynamic-import", async () => (await dynamicMail.send({ to: ["a@example.test", "b@example.test"], from: "no-reply@example.test", subject: "Two", text: "x" }))[0].statusCode);
await attempt("twilio-send", async () => (await twilio("ACfake", "fake").verify.v2.services("VAfake").verifications.create({ to: "+15555550100", channel: "sms" })).status);
await attempt("twilio-check-wrong", async () => (await twilio("ACfake", "fake").verify.v2.services("VAfake").verificationChecks.create({ to: "+15555550100", code: "123456" })).status);
await attempt("twilio-check-right", async () => (await twilio("ACfake", "fake").verify.v2.services("VAfake").verificationChecks.create({ to: "+15555550100", code: "000000" })).status);

await attempt("fetch-sendgrid", () => fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", body: "{}" }).then((r) => r.status));
await attempt("fetch-openai", () => fetch("https://api.openai.com/v1/models").then((r) => r.status));
await attempt("https-request-twilio", () => new Promise((resolve, reject) => {
  const req = https.request("https://verify.twilio.com/v2/Services", (res) => resolve(res.statusCode));
  req.on("error", reject);
  req.end();
}));
await attempt("http-request-remote", () => new Promise((resolve, reject) => {
  const req = http.request({ host: "example.com", port: 80, path: "/" }, (res) => resolve(res.statusCode));
  req.on("error", reject);
  req.end();
}));
await attempt("net-connect-ip", () => new Promise((resolve, reject) => {
  const s = net.connect({ host: "8.8.8.8", port: 53 });
  s.on("connect", () => resolve("connected"));
  s.on("error", reject);
}));
await attempt("net-connect-port-host", () => new Promise((resolve, reject) => {
  const s = net.connect(443, "example.com");
  s.on("connect", () => resolve("connected"));
  s.on("error", reject);
}));

// localhost keeps working (the server talks to the local Supabase)
const server = http.createServer((req, res) => res.end("local ok"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await attempt("fetch-localhost", () => fetch(`http://127.0.0.1:${port}/`).then((r) => r.text()));
await attempt("http-localhost", () => new Promise((resolve, reject) => {
  http.get({ host: "localhost", port }, (res) => { let b = ""; res.on("data", (d) => (b += d)); res.on("end", () => resolve(b)); }).on("error", reject);
}));
server.closeAllConnections();
server.close();

console.log(JSON.stringify(result));
process.exit(0);
