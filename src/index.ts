import { readFileSync, existsSync, statSync, createReadStream } from "fs";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import { join, resolve, relative, isAbsolute, extname } from "path";
import * as tls from "tls";
import { randomUUID } from "crypto";
import Account from "./account";
import routes from "./routes";

const generateRequestHandler = ({
  keepAlive = false
}: {
  /**
   * If set to `true` adds `Connection: keep-alive` header, otherwise uses
   * `Connection: close`.
   */
  keepAlive?: boolean | undefined;
}) => (account: Account, req: http.IncomingMessage, res: http.ServerResponse) => {
  // Serve static UI under /ui without affecting existing JSON API routes
  const serveStaticIfUI = (): boolean => {
    try {
      if (!req.url || req.method !== "GET") return false;
      const { host: reqHost } = (req.headers as any);
      const host = reqHost || "localhost";
  const parsedUrl = new URL(req.url, `http://${host}`);
  const { pathname } = parsedUrl;

      const publicDir = resolve(__dirname, "..", "public");

      const contentTypeFor = (fp: string): string => {
        switch (extname(fp)) {
          case ".html":
            return "text/html; charset=utf-8";
          case ".js":
            return "text/javascript; charset=utf-8";
          case ".css":
            return "text/css; charset=utf-8";
          case ".svg":
            return "image/svg+xml";
          case ".png":
            return "image/png";
          case ".jpg":
          case ".jpeg":
            return "image/jpeg";
          case ".ico":
            return "image/x-icon";
          case ".json":
            return "application/json; charset=utf-8";
          default:
            return "application/octet-stream";
        }
      };

      const serveFile = (relativePath: string): boolean => {
        const filePath = resolve(publicDir, relativePath);
        const diff = relative(publicDir, filePath);
        if (diff.startsWith("..") || isAbsolute(diff)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return true;
        }
        let target = filePath;
        if (!existsSync(target)) {
          // Fallback to index.html for unknown paths under /ui (simple SPA routing)
          target = join(publicDir, "index.html");
        } else if (statSync(target).isDirectory()) {
          target = join(target, "index.html");
        }
        if (!existsSync(target)) {
          res.statusCode = 404;
          res.end("Not Found");
          return true;
        }
        const type = contentTypeFor(target);
        res.statusCode = 200;
        res.setHeader("content-type", type);
        res.setHeader("cache-control", "no-cache, no-store, must-revalidate");
        res.setHeader("pragma", "no-cache");
        res.setHeader("expires", "0");
        createReadStream(target).pipe(res);
        return true;
      };

      if (pathname === "/ui" || pathname === "/ui/") {
        return serveFile("index.html");
      }
      if (pathname.startsWith("/ui/")) {
        const relPath = pathname.substring("/ui/".length);
        return serveFile(relPath || "index.html");
      }
      return false;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      return false;
    }
  };

  if (serveStaticIfUI()) return; // static file served

  const route = routes(req);

  (async () => {
    let body: any;
    if (route) {
      const [params, handler] = route as any;
      try {
        body = await (handler as any)(account, req, res, params);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error(err);
        body = { message: err.message };
        res.statusCode = 500;
      }
      if (res.statusCode > 399 && body && !body.message) {
        body.message = "";
      }
    } else {
      res.statusCode = 400;
      body = { message: "no route" };
    }

    if (body && (body as any)._etag) {
      res.setHeader("etag", (body as any)._etag);
    }

    res.setHeader("content-type", "application/json");
    const isHttps = (req.socket as any) && (req.socket as any).encrypted === true;
    const scheme = isHttps ? "https" : "http";
    res.setHeader("content-location", `${scheme}://${req.headers.host}${req.url}`);
    res.setHeader("connection", keepAlive ? "keep-alive" : "close");
    res.setHeader("x-ms-activity-id", randomUUID());
    res.setHeader("x-ms-request-charge", "1");
    if ((req.headers as any)["x-ms-documentdb-populatequerymetrics"]) {
      res.setHeader(
        "x-ms-documentdb-query-metrics",
        "totalExecutionTimeInMs=0.00;queryCompileTimeInMs=0.00;queryLogicalPlanBuildTimeInMs=0.00;queryPhysicalPlanBuildTimeInMs=0.00;queryOptimizationTimeInMs=0.00;VMExecutionTimeInMs=0.00;indexLookupTimeInMs=0.00;documentLoadTimeInMs=0.00;systemFunctionExecuteTimeInMs=0.00;userFunctionExecuteTimeInMs=0.00;retrievedDocumentCount=0;retrievedDocumentSize=0;outputDocumentCount=1;outputDocumentSize=0;writeOutputTimeInMs=0.00;indexUtilizationRatio=0.00"
      );
    }

    if (req.headers["a-im"] && res.statusCode === 200) {
      if (req.headers["if-none-match"]) {
        res.statusCode = 304;
      }
      res.setHeader("etag", "1");
    }
    res.end(JSON.stringify(body));
  })().catch((err: any) => {
    // eslint-disable-next-line no-console
    console.error(err);
    if (!res.finished) {
      res.statusCode = 500;
      res.end("");
    }
  });
};

const createAccount = (address: string | net.AddressInfo) => {
  if (!address || typeof address !== "object") {
    throw new Error(`Unexpected address type: ${address}`);
  }
  const { address: host, port } = address as net.AddressInfo;
  const hostname = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  return new Account(hostname, port);
};

export function createHttpServer(opts: http.ServerOptions = {}) {
  let account: Account | undefined;

  const handleRequest = generateRequestHandler({
    keepAlive: opts.keepAlive
  });
  const server = http
    .createServer(opts, (req: http.IncomingMessage, res: http.ServerResponse) => {
      handleRequest(account as any, req, res);
    })
    .on("listening", () => {
      account = createAccount(server.address());
    });

  return server;
}

export function createHttpsServer(opts?: https.ServerOptions) {
  let account: Account | undefined;

  const options: https.ServerOptions = {
    cert: readFileSync(join(__dirname, "..", "cert.pem")),
    key: readFileSync(join(__dirname, "..", "key.pem")),
    minVersion: "TLSv1" as tls.SecureVersion,
    rejectUnauthorized: false,
    requestCert: false,
    ...opts
  };

  const handleRequest = generateRequestHandler({
    keepAlive: options.keepAlive
  });
  const server = https
    .createServer(options, (req: http.IncomingMessage, res: http.ServerResponse) => {
      handleRequest(account as any, req, res);
    })
    .on("listening", () => {
      account = createAccount(server.address());
    });

  return server;
}

export default createHttpsServer;
