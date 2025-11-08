// api/uc-hook.js — Vercel (Node, CommonJS)
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // --- 1) Сире тіло (важливо для підпису)
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  const rawText = rawBody.toString() || "";
  const ct = (req.headers["content-type"] || "").toLowerCase();

  // --- 2) Перевірка підпису Uploadcare (HMAC-SHA256 від СИРОГО тіла)
  const sig = req.headers["x-uc-signature"];         // v1=<hex>
  const expected =
    "v1=" + crypto.createHmac("sha256", process.env.UC_SIGNING_SECRET)
      .update(rawBody)
      .digest("hex");
  if (sig !== expected) {
    console.warn("bad signature");
    return res.status(401).end("bad signature");
  }

  // --- 3) Відповідаємо миттєво (щоб не було ретраїв)
  res.status(200).end();

  // --- 4) Парсимо payload і для JSON, і для x-www-form-urlencoded
  let payload = {};
  try {
    if (ct.includes("application/json")) {
      payload = rawText ? JSON.parse(rawText) : {};
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawText);
      const event = params.get("event") || params.get("Event");
      const dataStr = params.get("data") || params.get("Data") || "";
      let data = {};
      try { data = dataStr ? JSON.parse(dataStr) : {}; } catch {}
      payload = { event, data };
    } else {
      // спробуємо як JSON на всякий випадок
      payload = rawText ? JSON.parse(rawText) : {};
    }
  } catch (e) {
    console.warn("parse error. CT:", ct, "RAW:", rawText.slice(0, 200));
  }

  // --- 5) Лог для перевірки
  const evt = payload.event;
  const d = payload.data || {};
  const uuid = d.uuid;
  const cdn = d.cdn_url || (uuid ? `https://ucarecdn.com/${uuid}/` : "");
  console.log("UC EVENT:", evt || "no-event", uuid || "no-uuid", cdn || "no-cdn");

  // --- 6) Далі твоя логіка (store/JSONBin/Sheets тощо)
};

module.exports.config = { api: { bodyParser: false } };
