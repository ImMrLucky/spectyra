import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScan } from "./scanner/index.js";
import { verifyIntegration } from "./scanner/verifyEngine.js";
import { getLastResult, getUserPlacement, setLastResult, setUserPlacement } from "./state.js";
import type { ProgressEvent, UserPlacementAnswer } from "./scanner/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DoctorServerOptions = {
  projectRoot: string;
  port: number;
};

export function createDoctorApp(projectRoot: string): express.Express {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  const uiDir = join(__dirname, "..", "ui");
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

  app.get("/api/result", (_req, res) => {
    res.json(getLastResult());
  });

  app.get("/api/scan", async (_req, res) => {
    try {
      const r = await runScan(projectRoot, {
        userPlacement: getUserPlacement(),
        onProgress: (ev) => broadcast(ev),
      });
      setLastResult(r);
      res.json(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      broadcast({ type: "error", message: msg });
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/rescan", async (_req, res) => {
    try {
      const r = await runScan(projectRoot, {
        userPlacement: getUserPlacement(),
        onProgress: (ev) => broadcast(ev),
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

  app.get("/api/verify", async (_req, res) => {
    let r = getLastResult();
    if (!r) {
      try {
        r = await runScan(projectRoot, {});
        setLastResult(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
        return;
      }
    }
    res.json({ lines: verifyIntegration(r) });
  });

  app.get("/", (_req, res) => {
    res.sendFile(join(uiDir, "index.html"));
  });

  return app;
}

export async function startDoctorServer(opts: DoctorServerOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createDoctorApp(opts.projectRoot);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(opts.port, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
  const url = `http://127.0.0.1:${opts.port}`;
  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
