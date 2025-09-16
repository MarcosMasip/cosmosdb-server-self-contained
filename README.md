# Cosmos DB Server (Self‑Contained + UI)

Fully local, Cosmos DB–compatible HTTP server for development and testing—now with an optional built‑in web UI. It preserves the original API and CLI behavior, and adds a single‑terminal flow so you can run everything with one command.

- Node.js 20+ required (see `engines` in `package.json`)
- No Azure account needed; runs entirely on your machine
- In‑memory data store; restart clears state (just like the original)

Table of contents
- What is this and why fork it?
- Prerequisites
- Quick start (single terminal)
- HTTPS mode (optional)
- Using the UI
- Using the original API (unchanged)
- Architecture
- Supported operations and limitations
- CLI reference
- Troubleshooting
- License & acknowledgements
- Developing

## What is this and why fork it?

Original project (backend only): vercel/cosmosdb-server
- Purpose: emulate Azure Cosmos DB locally via an HTTP API so you can run and test apps without a real Cosmos account.
- Behavior: backend-only, JSON API; in-memory state; HTTPS by default (self-signed cert).

This fork (full‑stack and self‑contained): cosmosdb-server-self-contained
- What’s new (fully local):
  - A static web UI served only under `/ui` to create databases/containers/documents and run queries.
  - A new `--open` CLI flag to auto-open the UI in your browser.
  - Convenience npm scripts (`npm start`, `npm run start:https`) for a single-terminal workflow.
- What’s unchanged (backward compatible):
  - All existing API endpoints, shapes, and headers remain the same.
  - The root path `/` still returns the original account metadata JSON.
  - The CLI usage is compatible; you can still run `node lib/cli.js` with the original flags.

Why this was done: to simplify onboarding and demos. New users can clone, install, and be exploring data in a browser within seconds—no extra tools, no multiple terminals, and no external dependencies. Meanwhile, apps and SDK clients that talk to the HTTP API continue to work exactly as before.

## Prerequisites

- Node.js 20 or higher
- npm (included with Node)
- A web browser (for the optional UI)

## Quick start (single terminal)

Clone this repo, then run the following in the project root:

1) Install dependencies
```sh
npm install
```
What this does: downloads and installs all Node dependencies.
Expected output: a `node_modules/` directory and no errors.

2) Build TypeScript
```sh
npm run build
```
What this does: compiles TypeScript to `lib/` for the CLI and server runtime.
Expected output: a `lib/` directory with compiled `.js` files.

3) Start the server and open the UI (HTTP)
```sh
npm start
```
What this does: starts the server on `http://localhost:3000` and opens `http://localhost:3000/ui` in your default browser. The terminal shows a line like:
```
Ready to accept HTTP connections at localhost:3000
```
Expected UI: a dashboard to create databases/containers/docs and run queries, all locally.

That’s it—one terminal, one command after build. The API is still available under the same endpoints (e.g., `GET /dbs`), and the root path `/` still returns account metadata JSON.

## HTTPS mode (optional)

To start with HTTPS (uses the repo’s self-signed certificate):
```sh
npm run start:https
```
What this does: starts `https://localhost:3000` and opens `https://localhost:3000/ui`.
Expected: your browser will warn about the self‑signed certificate. You can proceed for local testing, or prefer HTTP for zero warnings.

Curl tips with HTTPS:
```sh
curl -ik https://localhost:3000/
```
`-k` skips certificate verification. You should see account metadata JSON and headers like `x-ms-activity-id` and `x-ms-request-charge: 1`.

## Using the UI

Open `http://localhost:3000/ui` (or `https://localhost:3000/ui`). The UI is a static site bundled with this repo and served only from the `/ui` path, keeping the original API untouched.

You can:
- Databases: list, create, delete
- Containers: list, create (optionally set a partition key path like `/pk`)
- Documents: list, create, delete
- Queries: run SQL (e.g., `SELECT * FROM c`). Toggle cross-partition if your collection is partitioned and your query doesn’t include partition keys.

Notes:
- Data is in memory; restarting the server resets everything. Your app (or you) should create databases/containers at startup as needed.
- Same origin: the UI talks to the API on the same host/port, so no CORS configuration is needed.
- HTTPS: the certificate is self‑signed and intended for local use only.

## Using the original API (unchanged)

Root endpoint (account metadata):
```sh
curl -i http://localhost:3000/
```
Expected: `200 OK` with JSON account metadata.

CLI (original way):
```sh
node lib/cli.js -p 3000          # HTTPS by default (self-signed)
node lib/cli.js -p 3000 --no-ssl # HTTP
```

Programmatic usage (example):
```js
const { default: createHttpsServer } = require("@vercel/cosmosdb-server");
const https = require("https");

const server = createHttpsServer();
server.listen(3000, async () => {
  console.log("Cosmos DB server running at https://localhost:3000");
  // Example with official SDK
  const { CosmosClient } = require("@azure/cosmos");
  const client = new CosmosClient({
    endpoint: "https://localhost:3000",
    key: "dummy key",
    agent: new https.Agent({ rejectUnauthorized: false }) // self-signed cert
  });
  const { database } = await client.databases.createIfNotExists({ id: "test-db" });
  const { container } = await database.containers.createIfNotExists({ id: "test-container" });
});
```

Available factories (unchanged):
```js
const { createHttpServer, createHttpsServer } = require("@vercel/cosmosdb-server");
```

## Architecture

- HTTP/HTTPS servers: `src/index.ts` exports `createHttpServer` and `createHttpsServer`, wiring request handling and standard Cosmos‑style headers (e.g., `x-ms-activity-id`, `x-ms-request-charge`, `etag`).
- Router and routes: `src/router.ts` and `src/routes.ts` map HTTP method + path to a specific handler.
- Handlers: `src/handler/*` implement each API operation (create/read/replace/delete/upsert for databases, containers, items; queries; patch; UDFs) and translate to proper status codes and shapes.
- In‑memory model: `src/account/*` holds the account state (databases, containers, items, partition key ranges, resource IDs, etags), reset on process restart.
- Static UI: files in `public/` are served only under `/ui` so API routes remain untouched. Unknown `/ui/*` paths fall back to `index.html`.
- CLI: `src/cli.ts` parses flags (`-p/--port`, `--host`, `--no-ssl`, `--open`) and prints connection info; `--open` launches your default browser to `/ui`.

## Supported operations and limitations

- Database operations
- Container operations
- Item (document) operations
- Patch operations (set/replace/remove/add/incr/move with optional condition)
- User-defined function operations
- SQL queries (most). Spatial notes:
  - `ST_ISVALID` and `ST_ISVALIDDETAILED` are not supported.
  - Other spatial functions work, but `ST_DISTANCE` uses centroid distances, so results can differ from Cosmos DB.

New features in Azure Cosmos DB may not be supported yet in this emulator. Please open an issue if you find mismatches.

## CLI reference

From this repo (after `npm run build`):
```sh
node lib/cli.js [options]
```

Options:
- `-h, --help`           Show help
- `-p, --port <number>`  Port to listen on
- `--host <hostname>`    Hostname to bind to
- `--no-ssl`             Use HTTP instead of HTTPS
- `--open`               Open the UI in your default browser at `/ui`

NPM scripts (single-terminal convenience):
- `npm start`             → HTTP on port 3000, opens `/ui`
- `npm run start:https`   → HTTPS on port 3000, opens `/ui` (expect self-signed cert warning)

Tip: You can pass CLI flags through npm by adding them after `--`. For example, to change the port:
```sh
npm start -- -p 4000       # HTTP on port 4000
npm run start:https -- -p 4443   # HTTPS on port 4443
```

 

## Troubleshooting

- Node version errors: ensure `node -v` shows `v20.x.y` or higher.
- Port in use: change with `-p`/`--port`, e.g., `npm start -- -p 4000`.
- Browser didn’t open: pass `--open` when using the CLI directly, or open `http://localhost:3000/ui` manually. On macOS, the CLI uses the `open` command.
- HTTPS warnings: expected due to the self‑signed cert; either proceed for local use or use HTTP (`--no-ssl`). For curl, use `-k`.
- Empty state on restart: by design; everything is in memory.
- Partition key query errors: if your collection is partitioned and your query does not include partition keys, either add them or enable cross‑partition for queries (the UI has a checkbox for this).

## License & acknowledgements

- License: MIT (see `LICENSE.md`).
- Based on the original work: vercel/cosmosdb-server. This fork adds an optional UI and quality‑of‑life CLI scripts while preserving API compatibility and original behavior. It may not support newly added features yet. Please open an issue if you find a mismatch.

## Developing

- Build the project: `npm run build`
- Run from compiled code: `node lib/cli.js -p 3000 --no-ssl --open`
