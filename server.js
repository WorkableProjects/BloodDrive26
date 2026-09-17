const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const HISTORY_FILE = path.join(ROOT, "history.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function readHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2));
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

if (!fs.existsSync(HISTORY_FILE)) {
  writeHistory([]);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/history") {
    if (req.method === "GET") {
      return sendJson(res, 200, readHistory());
    }
    if (req.method === "PUT") {
      try {
        const body = await readBody(req);
        const entries = JSON.parse(body || "[]");
        if (!Array.isArray(entries)) throw new Error("Expected an array");
        writeHistory(entries);
        return sendJson(res, 200, entries);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    res.writeHead(405, { Allow: "GET, PUT" });
    return res.end();
  }

  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(ROOT, filePath);

  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Mat Occupancy Tracker running at http://localhost:${PORT}`);
});
