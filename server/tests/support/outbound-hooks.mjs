// ESM resolve hook: the two vendor packages that send messages are replaced by recorders.
const stubs = new Map([
  ["@sendgrid/mail", new URL("./stubs/sendgrid-mail.mjs", import.meta.url).href],
  ["twilio", new URL("./stubs/twilio.mjs", import.meta.url).href],
]);

export async function resolve(specifier, context, nextResolve) {
  const stub = stubs.get(specifier);
  if (stub) return { url: stub, shortCircuit: true, format: "module" };
  return nextResolve(specifier, context);
}
