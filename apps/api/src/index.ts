import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { providersRouter } from "./routes/providers.js";
import { scenariosRouter } from "./routes/scenarios.js";
import { chatRouter } from "./routes/chat.js";
import { replayRouter } from "./routes/replay.js";
import { runsRouter } from "./routes/runs.js";
import { savingsRouter } from "./routes/savings.js";
import { adminRouter } from "./routes/admin.js";
import { proofRouter } from "./routes/proof.js";
import { replaySimulateRouter } from "./routes/replaySimulate.js";
import { billingRouter } from "./routes/billing.js";
import { authRouter } from "./routes/auth.js";
import { integrationsRouter } from "./routes/integrations.js";
import { initDb } from "./services/storage/db.js";

const app = express();

app.use(cors());

// Stripe webhook needs raw body, so we handle it separately
app.use("/v1/billing/webhook", express.raw({ type: "application/json" }));

// All other routes use JSON
app.use(express.json());

// Initialize database
initDb();

// Routes
app.use("/health", healthRouter);
app.use("/v1/providers", providersRouter);
app.use("/v1/scenarios", scenariosRouter);
app.use("/v1/chat", chatRouter);
app.use("/v1/replay", replayRouter);
app.use("/v1/runs", runsRouter);
app.use("/v1/savings", savingsRouter);
app.use("/v1/admin", adminRouter);
app.use("/v1/proof", proofRouter);
app.use("/v1/replay/simulate", replaySimulateRouter);
app.use("/v1/billing", billingRouter);
app.use("/v1/auth", authRouter);
app.use("/v1/integrations", integrationsRouter);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Spectyra API listening on port ${config.port}`);
});

