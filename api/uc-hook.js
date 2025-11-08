import crypto from "crypto";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  const sig = req.headers["x-uc-signature"];
  const expected = "v1=" + crypto.createHmac("sha256", process.env.UC_SIGNING_SECRET)
    .update(rawBody)
    .digest("hex");
  if (sig !== expected) return res.status(401).end("bad signature");

  const payload = JSON.parse(rawBody.toString());
  console.log("UC EVENT:", payload.event, payload.data.cdn_url);

  res.status(200).end();
}

