// /api/cutout.js — прибирання фону на сервері через fal.ai (BiRefNet v2)
// Ключ лежить у змінній середовища Vercel FAL_KEY і ніколи не потрапляє в браузер.
// Клієнт шле JSON { image: "data:image/jpeg;base64,..." }, отримує назад WebP з прозорістю.

const ALLOWED = [
  "https://pillow-preview.vercel.app",
  "https://printme.world",
  "https://www.printme.world",
];

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (ALLOWED.includes(origin) || origin.startsWith("http://localhost")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // проста охорона від чужих сайтів, які захочуть різати фон за твої гроші
  if (origin && !ALLOWED.includes(origin) && !origin.startsWith("http://localhost")) {
    return res.status(403).send("Forbidden");
  }
  if (!process.env.FAL_KEY) return res.status(500).send("FAL_KEY не задано");

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const image = String(body.image || "");
  if (!image.startsWith("data:image/")) return res.status(400).send("Очікую data:image/...");
  if (image.length > 4_000_000) return res.status(413).send("Фото завелике, зменш до 2000 px");

  // Рушії: ideogram (за замовчуванням), birefnet, bria (RMBG 2.0).
  const MODELS = ["Portrait", "Matting", "General Use (Heavy)", "General Use (Light)", "General Use (Light 2K)"];
  const engine = ["birefnet", "bria", "ideogram"].includes(body.engine) ? body.engine : "ideogram";
  const model = MODELS.includes(body.model) ? body.model : "Portrait";

  let endpoint, input;
  if (engine === "bria") {
    endpoint = "fal-ai/bria/background/remove";
    input = { image_url: image };
  } else if (engine === "ideogram") {
    endpoint = "fal-ai/ideogram/remove-background";
    input = { image_url: image };
  } else {
    endpoint = "fal-ai/birefnet/v2";
    input = { image_url: image, model, operating_resolution: "2048x2048",
              refine_foreground: true, output_format: "webp" };
  }
  const label = engine === "birefnet" ? "birefnet/" + model : engine;
  const t0 = Date.now();

  try {
    const r = await fetch("https://fal.run/" + endpoint, {
      method: "POST",
      headers: { Authorization: "Key " + process.env.FAL_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return res.status(502).send("fal " + label + ": " + r.status + " " + (await r.text()).slice(0, 300));

    const out = await r.json();
    const url = out?.image?.url || out?.images?.[0]?.url;
    if (!url) return res.status(502).send("fal " + label + ": немає image.url у відповіді");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Cutout-Model", label);
    res.setHeader("X-Cutout-Ms", String(Date.now() - t0));
    res.setHeader("Access-Control-Expose-Headers", "X-Cutout-Model, X-Cutout-Ms");

    // віддаємо байти самі; якщо PNG завеликий для ліміту Vercel (4.5 МБ) — віддаємо посилання
    const img = await fetch(url);
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 4_000_000) return res.status(200).json({ url });
    res.setHeader("Content-Type", img.headers.get("content-type") || "image/png");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).send("cutout: " + (e?.message || e));
  }
};

module.exports.config = { maxDuration: 60 };
