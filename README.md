# cosmosdb-server

A Cosmos DB server implementation for testing your apps locally. The minimum supported NodeJS version is 20.

```js
const { default: cosmosServer } = require("@vercel/cosmosdb-server");
const { CosmosClient } = require("@azure/cosmos");
# Cosmos DB Server (Self‑Contained + UI)

This repository provides a fully local, Cosmos DB–compatible HTTP server for development and testing—now with an optional built‑in web UI. It remains compatible with the original API and CLI so existing usage still works, while adding a single‑terminal, one‑command flow to explore your data visually.

- Minimum Node.js version: 20+
- Runs entirely on your machine. No Azure account and no external services required.
- All data is in memory; restarting the server clears state (same as the original).

Table of contents
- What is this and why fork it?
- Prerequisites
- Quick start (single terminal)
- HTTPS mode (optional)
- Using the UI
- Using the original API (unchanged)
- Supported operations and limitations
- CLI reference
- Development & tests
- Troubleshooting
- License & acknowledgements

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

Why this was done: to simplify onboarding and demos. New users can clone, install, and be exploring data in a browser within seconds—no extra tools, no multiple terminals, and no external dependencies. Meanwhile, existing SDK integration tests and code that talks to the HTTP API continue to work exactly as before.

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

## Supported operations and limitations

- Database operations
- Container operations
- Item (document) operations
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
- `npm start`       → HTTP, opens `/ui`
- `npm run start:https` → HTTPS, opens `/ui` (expect self-signed cert warning)

## Development & tests

Common tasks:
```sh
npm run build       # compile TypeScript to lib/
npm test            # run unit tests (if present)
npm run lint        # eslint
npm run format      # prettier
```

Azure SDK integration tests (optional, heavy):
- This repo contains scripts under `test/` that build the Azure SDK (monorepo) and run their integration tests against this server to ensure compatibility.
- Running `npm run test` may execute both Jest tests and the SDK script, which uses a git submodule (`test/azure-sdk-for-js`) and `@microsoft/rush`.
- If you haven’t initialized submodules or installed Rush, the SDK test script will take time and bandwidth and may require extra setup. See `test/sdk.sh` for exact steps.

## Troubleshooting

- Node version errors: ensure `node -v` shows `v20.x.y` or higher.
- Port in use: change with `-p`/`--port`, e.g., `npm start -- -p 4000`.
- Browser didn’t open: pass `--open` when using the CLI directly, or open `http://localhost:3000/ui` manually. On macOS, the CLI uses the `open` command.
- HTTPS warnings: expected due to the self‑signed cert; either proceed for local use or use HTTP (`--no-ssl`). For curl, use `-k`.
- Empty state on restart: by design; everything is in memory.
- Partition key query errors: if your collection is partitioned and your query does not include partition keys, either add them or enable cross‑partition for queries (the UI has a checkbox for this).

## License & acknowledgements

- License: MIT (see `LICENSE.md`).
- Based on the original work: vercel/cosmosdb-server. This fork adds an optional UI and quality‑of‑life CLI scripts while preserving API compatibility and original behavior.
It may not support newly added features yet. Please report on the Github issue if you find one.

## Developing

To build the project, use `yarn build`.

To run the server from development code, after building, use `node lib/cli.js`.
