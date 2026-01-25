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
import { initDb } from "./services/storage/db.js";

const app = express();

app.use(cors());
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

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Spectyra API listening on port ${config.port}`);
});

