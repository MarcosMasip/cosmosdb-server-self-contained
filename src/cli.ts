#!/usr/bin/env node
import * as net from "net";
import { spawn } from "child_process";
import { createHttpServer, createHttpsServer } from ".";

const argv = process.argv.slice(2);
const args: {
  help?: boolean;
  port?: number;
  hostname?: string;
  nossl?: boolean;
  open?: boolean;
} = {};
while (argv.length) {
  const key = argv.shift();
  switch (key) {
    case "-h":
    case "--help":
      args.help = true;
      break;
    case "-p":
    case "--port":
      args.port = parseInt(argv.shift(), 10);
      break;
    case "--host":
      args.hostname = argv.shift();
      break;
    case "--no-ssl":
      args.nossl = true;
      break;
    case "--open":
      args.open = true;
      break;
    default:
      break;
  }
}

if (args.help) {
  // eslint-disable-next-line no-console
  console.log(`
Usage: cosmosdb-server [options]

Options:

  -h, --help
  -p, --port
  --no-ssl
  --host
  --open
`);
  process.exit();
}

const cosmosDBServer = args.nossl ? createHttpServer : createHttpsServer;
const server = cosmosDBServer().listen(args.port, args.hostname, () => {
  const { address, family, port } = server.address() as net.AddressInfo;
  // eslint-disable-next-line no-nested-ternary
  const hostname = args.hostname
    ? args.hostname
    : family === "IPv6"
    ? `[${address}]`
    : address;
  // eslint-disable-next-line no-console
  console.log(
    `Ready to accept HTTP${
      args.nossl ? "" : "S"
    } connections at ${hostname}:${port}`
  );

  if (args.open) {
    const scheme = args.nossl ? "http" : "https";
    const url = `${scheme}://${hostname}:${port}/ui`;
    tryOpen(url);
  }
});

function tryOpen(url: string) {
  // macOS default path
  if (process.platform === "darwin") {
    const child = spawn("open", [url], { detached: true, stdio: "ignore" });
    child.unref();
    return;
  }
  // Linux common fallback
  if (process.platform === "linux") {
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
    return;
  }
  // Windows (best-effort)
  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`Open UI at: ${url}`);
}
