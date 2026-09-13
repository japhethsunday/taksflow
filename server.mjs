import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const ROOT = fileURLToPath(new URL("./", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PROXY_TARGET = process.env.CLOUDNIVO_PROXY_TARGET || "https://cloudnivo-api-production.up.railway.app";
const PROXY_PREFIX = "/api";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = decodeURIComponent(url.pathname);

  if (path === PROXY_PREFIX || path.startsWith(PROXY_PREFIX + "/")) {
    const rest = path.slice(PROXY_PREFIX.length).replace(/^\//, "");
    const target = `${PROXY_TARGET}/api/v1${rest ? "/" + rest : ""}`;
    const qs = url.search || "";
    const upstreamHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (["host", "connection", "content-length", "transfer-encoding"].includes(k)) continue;
      if (typeof v === "string") upstreamHeaders[k] = v;
    }
    upstreamHeaders.host = new URL(PROXY_TARGET).host;
    const isBodyless = ["GET", "HEAD"].includes(req.method);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (!isBodyless && body.length > 0) upstreamHeaders["content-length"] = body.length;
    try {
      const upstream = await fetch(target + qs, {
        method: req.method,
        headers: upstreamHeaders,
        body: isBodyless || body.length === 0 ? undefined : body,
      });
      if (res.headersSent) return;
      const hdrs = {};
      for (const [k, v] of Object.entries(upstream.headers)) {
        if (["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"].includes(k)) continue;
        if (typeof v === "string") hdrs[k] = v;
      }
      res.writeHead(upstream.status, hdrs);
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
      else res.end();
    } catch (err) {
      console.error("proxy error:", err);
      if (res.headersSent) { res.end(); return; }
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Proxy error: " + err.message } }));
    }
    return;
  }

  try {
    let filePath = path === "/" ? "/index.html" : path;
    const file = normalize(join(ROOT, filePath));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("Forbidden"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(ROOT, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
});

server.listen(PORT, () => {
  console.log(`Greenwood Academy running at http://localhost:${PORT}`);
});
