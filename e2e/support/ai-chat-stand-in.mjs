// A stand-in for the AI chat service's page, for the browser journeys (the real service lives in another repo
// and is never started here). It speaks the portal's side of the contract exactly like the real page
// (static/chat/app.js in godspeed-ops-ai): it asks the portal for the sign-in token with "ai-chat:ready", keeps
// the newest "ai-chat:token", and sends it to the local test database's chat functions on request. So the journey
// proves the portal part end to end: the token arrives with no extra step, and a renewed one arrives later.
//
// Local only: it listens on 127.0.0.1 and is told the (local) database address by the global setup.
import http from "node:http";
import { requireLocal } from "../../server/tests/support/local-only.mjs";

const PAGE = (
  apiUrl,
  anonKey
) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI chat stand-in</title></head>
<body>
<p>tokens received: <span id="count">0</span></p>
<p>last token ends: <span id="tail"></span></p>
<p>language: <span id="lang"></span> theme: <span id="theme"></span></p>
<button id="ask" type="button">ask</button>
<pre id="result"></pre>
<script>
  var tokens = [];
  var params = new URLSearchParams(location.search);
  document.getElementById('lang').textContent = params.get('lang') || '';
  document.getElementById('theme').textContent = params.get('theme') || '';
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'ai-chat:token') {
      tokens.push(d.token);
      document.getElementById('count').textContent = String(tokens.length);
      document.getElementById('tail').textContent = d.token.slice(-12);
    }
    if (d.type === 'theme') document.getElementById('theme').textContent = d.value;
  });
  document.getElementById('ask').addEventListener('click', async function () {
    var token = tokens[tokens.length - 1];
    var r = await fetch(${JSON.stringify(apiUrl)} + '/rest/v1/rpc/ai_chat_run', {
      method: 'POST',
      headers: { apikey: ${JSON.stringify(anonKey)}, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'select count(*) as n from jobseekers' })
    });
    document.getElementById('result').textContent = r.status + ' ' + await r.text();
  });
  // ask the portal (the page that framed us) for the token, as the real page does
  window.parent.postMessage({ type: 'ai-chat:ready' }, '*');
</script></body></html>`;

export async function startChatStandIn({ apiUrl, anonKey }) {
  requireLocal({ api: apiUrl });
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE(apiUrl, anonKey));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  return {
    url,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
