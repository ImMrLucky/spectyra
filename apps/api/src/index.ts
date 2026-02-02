import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { providersRouter } from "./routes/providers.js";
import { scenariosRouter } from "./routes/scenarios.js";
import { chatRouter } from "./routes/chat.js";
import { replayRouter } from "./routes/replay.js";
import { runsRouter } from "./routes/runs.js";
import { savingsRouter } from "./routes/savings.js";
import { adminRouter } from "./routes/admin.js";
import { optimizerLabHealthRouter, optimizerLabRouter } from "./routes/optimizerLab.js";
import { proofRouter } from "./routes/proof.js";
import { replaySimulateRouter } from "./routes/replaySimulate.js";
import { billingRouter } from "./routes/billing.js";
import { authRouter } from "./routes/auth.js";
import { integrationsRouter } from "./routes/integrations.js";
import { agentRouter } from "./routes/agent.js";
import { policiesRouter } from "./routes/policies.js";
import { auditRouter } from "./routes/audit.js";
import { usageRouter } from "./routes/usage.js";
import { providerKeysRouter } from "./routes/providerKeys.js";
import { retentionRouter } from "./routes/retention.js";
import { settingsRouter } from "./routes/settings.js";
import { scimRouter } from "./routes/scim.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { initDb } from "./services/storage/db.js";

const app = express();

// Enterprise Security: Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow API usage
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow CORS
}));

// Enterprise Security: CORS hardening
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // If ALLOWED_ORIGINS is set, enforce it
    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      // Default: allow all (for development)
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization", "X-SPECTYRA-API-KEY", "X-PROVIDER-KEY", "X-ADMIN-TOKEN"],
}));

// Stripe webhook needs raw body, so we handle it separately
app.use("/v1/billing/webhook", express.raw({ type: "application/json" }));

// All other routes use JSON
app.use(express.json({ limit: "10mb" })); // Limit request size

// Enterprise Security: Rate limiting (applied to authenticated routes)
// Note: Rate limiting is applied per-route, not globally

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
app.use("/v1/admin", optimizerLabHealthRouter); // GET /optimize/health (public, no auth)
app.use("/v1/admin", optimizerLabRouter); // Optimizer Lab POST /optimize (any authenticated user)
app.use("/v1/proof", proofRouter);
app.use("/v1/replay/simulate", replaySimulateRouter);
app.use("/v1/billing", billingRouter);
app.use("/v1/auth", authRouter);
app.use("/v1/integrations", integrationsRouter);
app.use("/v1/agent", agentRouter);
app.use("/v1/policies", policiesRouter);
app.use("/v1/audit", auditRouter);
app.use("/v1/usage", usageRouter);
app.use("/v1/orgs", providerKeysRouter); // Provider keys management
app.use("/v1/orgs", settingsRouter); // Settings management
app.use("/v1/projects", settingsRouter); // Project settings
app.use("/scim", scimRouter); // SCIM endpoints (501 for now)
app.use("/internal/retention", retentionRouter); // Retention worker (internal)

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Spectyra API listening on port ${config.port}`);
});

