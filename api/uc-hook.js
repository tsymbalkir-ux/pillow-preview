// api/uc-hook.js — Vercel Serverless Function (CommonJS)
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // --- 1) Прочитати сире тіло (для підпису)
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  const rawText = rawBody.toString() || "";
  const ct = (req.headers["content-type"] || "").toLowerCase();

  // --- 2) Перевірити підпис Uploadcare (X-Uc-Signature)
  const sig = req.headers["x-uc-signature"]; // v1=<hex>
  const expected =
    "v1=" +
    crypto.createHmac("sha256", process.env.UC_SIGNING_SECRET).update(rawBody).digest("hex");
  if (sig !== expected) {
    console.warn("bad signature");
    return res.status(401).end("bad signature");
  }

  // --- 3) Відповідаємо миттєво (важливо, щоб Uploadcare не робив ретраї)
  res.status(200).end();

  // --- 4) Акуратно розпарсимо payload (JSON або x-www-form-urlencoded)
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
      // спроба як JSON
      payload = rawText ? JSON.parse(rawText) : {};
    }
  } catch (e) {
    console.warn("parse error", e, "RAW:", rawText.slice(0, 300));
  }

  const evt = payload.event || "no-event";
  const d = payload.data || {};
  const uuid = d.uuid;
  let cdn = d.cdn_url || (uuid ? `https://ucarecdn.com/${uuid}/` : "");
  const filename = d.filename || "";

  console.log("UC EVENT:", evt, uuid || "no-uuid", cdn || "no-cdn");

  // --- 5) (Опційно) Авто-store, якщо файл ще не збережений і є ключі
  try {
    const needStore = uuid && !d.is_stored && process.env.UC_PUBLIC_KEY && process.env.UC_SECRET_KEY;
    if (needStore) {
      const r = await fetch(`https://api.uploadcare.com/files/${uuid}/storage/`, {
        method: "POST",
        headers: {
          "Accept": "application/vnd.uploadcare-v0.5+json",
          "Content-Type": "application/json",
          "Authorization": `Uploadcare.Simple ${process.env.UC_PUBLIC_KEY}:${process.env.UC_SECRET_KEY}`,
        },
      });
      if (!r.ok) {
        const t = await r.text();
        console.warn("store failed:", r.status, t);
      } else {
        // після успішного store CDN URL гарантовано постійний
        cdn = `https://ucarecdn.com/${uuid}/`;
      }
    }
  } catch (e) {
    console.error("store error", e);
  }

  // --- 6) Запис у JSONBin (ідемпотентно; зберігаємо останні 50)
  try {
    if (process.env.JSONBIN_ID && process.env.JSONBIN_KEY && uuid) {
      // 6.1 отримати поточний вміст
      let arr = [];
      try {
        const latest = await fetch(
          `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_ID}/latest`,
          { headers: { "X-Master-Key": process.env.JSONBIN_KEY } }
        );
        if (latest.ok) {
          const j = await latest.json();
          arr = Array.isArray(j.record) ? j.record : [];
        }
      } catch (e) {
        console.warn("jsonbin read warn", e);
      }

      // 6.2 додати/оновити запис за uuid
      const item = {
        ts: Date.now(),
        uuid,
        cdn_url: cdn,
        filename,
        event: evt,
      };

      const byUuid = new Map(arr.map((x) => [x.uuid, x]));
      byUuid.set(uuid, { ...byUuid.get(uuid), ...item });
      arr = Array.from(byUuid.values())
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 50);

      // 6.3 записати назад
      const put = await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": process.env.JSONBIN_KEY,
        },
        body: JSON.stringify(arr),
      });
      if (!put.ok) {
        const t = await put.text();
        console.warn("jsonbin write failed:", put.status, t);
      }
    }
  } catch (e) {
    console.error("jsonbin error", e);
  }
};

module.exports.config = { api: { bodyParser: false } };
