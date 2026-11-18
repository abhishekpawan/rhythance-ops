// Uploads synthetic files to the local storage: ID documents of two different jobseekers, a signed
// consent and an invoice file. The content is a tiny placeholder; no real document is ever used.
import { FILES } from "./ids.mjs";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "utf8");

export async function uploadObject(stack, { bucket, name }, { token = stack.serviceKey, method = "POST", body = PDF, upsert = false } = {}) {
  const res = await fetch(`${stack.apiUrl}/storage/v1/object/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}`, {
    method,
    headers: {
      apikey: stack.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/pdf",
      ...(upsert ? { "x-upsert": "true" } : {}),
    },
    body,
  });
  return { status: res.status, body: await res.text() };
}

export async function uploadSeedFiles(stack) {
  for (const file of Object.values(FILES)) {
    const r = await uploadObject(stack, file);
    if (r.status >= 300) throw new Error(`uploading ${file.bucket}/${file.name} failed: ${r.status} ${r.body}`);
  }
}
