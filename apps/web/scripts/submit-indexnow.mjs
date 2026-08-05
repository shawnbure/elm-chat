const host = "elm.chat";
const key = "2de68112e8db8f8c07e4d6314d91bf54";
const keyLocation = `https://${host}/${key}.txt`;
const urlList = [
  `https://${host}/`,
  `https://${host}/self-destructing-chat`,
  `https://${host}/send-a-password-securely`,
  `https://${host}/send-a-file-securely`,
  `https://${host}/one-time-secret-chat`,
  `https://${host}/temporary-private-chat`,
  `https://${host}/journalist-source-communication`,
  `https://${host}/temporary-financial-handoff`,
  `https://${host}/security-and-limitations`,
  `https://${host}/press`,
  `https://${host}/the-internet-needs-places-that-forget`,
  `https://${host}/why-i-built-elm-chat`,
  `https://${host}/deletion-distributed-systems-contract`,
  `https://${host}/building-ephemeral-chat-cloudflare`,
  `https://${host}/durable-objects-websocket-hibernation`,
  `https://${host}/cloudflare-deploy-button-monorepo`,
  `https://${host}/single-use-invite-links`
];

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation, urlList })
});

if (!response.ok) {
  throw new Error(`IndexNow submission failed: ${response.status} ${await response.text()}`);
}

console.log(`IndexNow accepted ${urlList.length} URLs (${response.status})`);
