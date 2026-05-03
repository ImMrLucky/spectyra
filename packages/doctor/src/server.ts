import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScan } from "./scanner/index.js";
import { verifyIntegration } from "./scanner/verifyEngine.js";
import { getLastResult, getUserPlacement, setLastResult, setUserPlacement } from "./state.js";
import type { ProgressEvent, UserPlacementAnswer } from "./scanner/types.js";

function maxScanBytesFromQuery(query: express.Request["query"]): number {
  const rawBytes = query.maxFileSizeBytes ?? query.maxFileSize;
  if (rawBytes !== undefined) {
    const n = parseInt(String(rawBytes), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const maxMb = parseFloat(String(query.maxFileSizeMb ?? "1"));
  return Number.isFinite(maxMb) && maxMb > 0 ? Math.round(maxMb * 1_000_000) : 1_000_000;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DoctorServerOptions = {
  projectRoot: string;
  port: number;
};

export function createDoctorApp(projectRoot: string): express.Express {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  const uiDir = join(__dirname, "ui");
  app.use(express.static(uiDir));

  const sseClients = new Set<(ev: ProgressEvent) => void>();

  function broadcast(ev: ProgressEvent) {
    for (const fn of sseClients) {
      try {
        fn(ev);
      } catch {
        /* ignore */
      }
    }
  }

  app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (ev: ProgressEvent) => {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };
    sseClients.add(send);
    send({ type: "progress", message: "Connected to Spectyra Doctor" });
    req.on("close", () => {
      sseClients.delete(send);
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "spectyra-doctor" });
  });

  app.get("/api/result", (_req, res) => {
    res.json(getLastResult());
  });

  app.get("/api/scan", async (req, res) => {
    const maxBytes = maxScanBytesFromQuery(req.query);
    try {
      const r = await runScan(projectRoot, {
        userPlacement: getUserPlacement(),
        onProgress: (ev) => broadcast(ev),
        maxFileSizeBytes: maxBytes,
      });
      setLastResult(r);
      res.json(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      broadcast({ type: "error", message: msg });
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/rescan", async (req, res) => {
    const maxBytes = maxScanBytesFromQuery(req.query);
    try {
      const r = await runScan(projectRoot, {
        userPlacement: getUserPlacement(),
        onProgress: (ev) => broadcast(ev),
        maxFileSizeBytes: maxBytes,
      });
      setLastResult(r);
      res.json(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      broadcast({ type: "error", message: msg });
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/set-user-answer", (req, res) => {
    const body = req.body as { placement?: UserPlacementAnswer };
    const p = body?.placement;
    if (p === "backend" || p === "frontend" || p === "both" || p === "not_sure") {
      setUserPlacement(p);
    }
    res.json({ ok: true, placement: getUserPlacement() });
  });

  app.get("/api/verify", async (req, res) => {
    let r = getLastResult();
    if (!r) {
      try {
        r = await runScan(projectRoot, { maxFileSizeBytes: 1_000_000 });
        setLastResult(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
        return;
      }
    }
    const runtimeUrl = typeof req.query.runtimeUrl === "string" ? req.query.runtimeUrl : undefined;
    const { lines, runtime } = await verifyIntegration(r, { runtimeUrl });
    res.json({ lines, runtime });
  });

  app.get("/", (_req, res) => {
    res.sendFile(join(uiDir, "index.html"));
  });

  return app;
}

export async function startDoctorServer(opts: DoctorServerOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createDoctorApp(opts.projectRoot);
  const server = createServer(app);
  let closePromise: Promise<void> | undefined;
  await new Promise<void>((resolve, reject) => {
    server.listen(opts.port, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
  const url = `http://127.0.0.1:${opts.port}`;
  return {
    url,
    close: () => {
      if (closePromise) return closePromise;
      if (!server.listening) return Promise.resolve();
      closePromise = new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      return closePromise;
    },
  };
}
