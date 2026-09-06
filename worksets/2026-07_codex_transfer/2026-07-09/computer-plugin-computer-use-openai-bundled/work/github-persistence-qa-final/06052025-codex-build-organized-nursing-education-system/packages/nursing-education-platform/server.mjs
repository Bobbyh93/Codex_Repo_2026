import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { createFileBackedAttemptStore } from "./persistence-store.mjs";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || "127.0.0.1";
const attemptStore = createFileBackedAttemptStore();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, url);
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = normalize(join(root, pathname));

    if (!filePath.startsWith(root)) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Bad path");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "text/plain; charset=utf-8" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

async function handleApiRequest(request, response, url) {
  if (url.pathname === "/api/cat-attempts") {
    await handleAttemptsRequest(request, response);
    return;
  }

  writeJson(response, 404, { error: "Unknown API route" });
}

async function handleAttemptsRequest(request, response) {
  if (request.method === "GET") {
    writeJson(response, 200, persistencePayload(await attemptStore.listAttempts()));
    return;
  }

  if (request.method === "POST") {
    const payload = await readJsonBody(request);
    const attempts = await attemptStore.saveAttempt(payload.attempt || payload);
    writeJson(response, 200, persistencePayload(attempts));
    return;
  }

  if (request.method === "DELETE") {
    writeJson(response, 200, persistencePayload(await attemptStore.clearAttempts()));
    return;
  }

  writeJson(response, 405, { error: "Method not allowed" });
}

function persistencePayload(attempts) {
  return {
    source: "server",
    detail: "Server-backed JSON attempt store",
    attempts,
  };
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body too large");
  }

  return body ? JSON.parse(body) : {};
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

server.listen(port, host, () => {
  console.log(`CAT Testing Studio running at http://${host}:${port}`);
  console.log(`Attempt persistence: ${attemptStore.filePath}`);
});
