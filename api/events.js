// api/events.js — Vercel Serverless (Node, CommonJS)
// Віддає події, які uc-hook зберігає у globalThis.EVENTS

function BUF() { return (globalThis.EVENTS ||= []); }
function VER() { return (globalThis.EV_VER ||= 0); }

// прості CORS-заголовки, щоб локальний watcher міг читати
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
};

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== "GET") {
    res.writeHead(405, { ...CORS });
    return res.end("Method Not Allowed");
  }

  const url = new URL(req.url, "http://localhost");
  const since = Number(url.searchParams.get("since") || 0);  // unix ms, вертаємо лише новіші
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 200)));

  const etag = `"v${VER()}"`;
  const inm = req.headers["if-none-match"];
  if (inm && inm === etag) {
    res.writeHead(304, { ETag: etag, "Cache-Control": "no-store", ...CORS });
    return res.end();
  }

  let events = BUF();
  if (since > 0) events = events.filter(e => (e.ts || 0) > since);
  if (events.length > limit) events = events.slice(0, limit);

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ETag: etag,
    ...CORS,
  });
  res.end(JSON.stringify(events));
};
