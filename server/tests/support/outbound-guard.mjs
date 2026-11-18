// Preload for the test server (node --import). No source change in the server is needed:
//   1. @sendgrid/mail and twilio resolve to recorders (outbound-hooks.mjs);
//   2. every socket that is not to localhost is refused, which covers http, https, fetch and any
//      library built on net: they all end in net.Socket.prototype.connect;
//   3. fetch to a non-local address fails first with a clear message.
// Blocked attempts are recorded too, so a test can see that the server tried.
import { register } from "node:module";
import net from "node:net";
import { record } from "./record.mjs";

register("./outbound-hooks.mjs", import.meta.url);

const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function targetOf(args) {
  // net.connect() and http hand Socket#connect arguments that are already normalised: an array
  // [options, callback]. tls.connect passes the options object. connect(port, host) and connect(path)
  // are the plain forms. Read all of them; an unknown shape counts as remote.
  let first = args[0];
  if (Array.isArray(first)) first = first[0];
  if (first && typeof first === "object") {
    if (first.path) return { local: true }; // a unix socket on this machine
    return { host: String(first.host ?? "localhost").toLowerCase() };
  }
  if (typeof first === "string" && Number.isNaN(Number(first))) return { local: true }; // connect(path)
  if (typeof first === "number" || typeof first === "string") {
    return { host: String(typeof args[1] === "string" ? args[1] : "localhost").toLowerCase() };
  }
  return { host: "unknown" };
}

const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const t = targetOf(args);
  if (!t.local && !LOCAL.has(t.host)) {
    record({ kind: "blocked-connection", host: t.host });
    const error = new Error(`outbound connection to ${t.host} blocked by the test guard`);
    queueMicrotask(() => this.destroy(error));
    return this;
  }
  return realConnect.apply(this, args);
};

const realFetch = globalThis.fetch;
globalThis.fetch = function guardedFetch(input, init) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    // a relative or invalid address fails inside fetch itself
  }
  if (host && !LOCAL.has(host)) {
    record({ kind: "blocked-fetch", host });
    return Promise.reject(new Error(`outbound fetch to ${host} blocked by the test guard`));
  }
  return realFetch(input, init);
};
