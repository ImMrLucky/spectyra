# Web UI vs Local Proxy - Understanding the Difference

## The Confusion

**Users often ask: "How do I connect Claude Code, Cursor, etc. to the web UI?"**

The answer: **You don't!** Desktop coding tools connect via the **Local Proxy**, not the web UI.

## Two Separate Systems

### 1. Web UI (spectyra.com or localhost:4200)

**Purpose:**
- Managing test scenarios
- Running replays (baseline vs optimized)
- Viewing historical savings
- Proof mode (estimating savings)
- Settings and configuration

**What it's NOT for:**
- ❌ Connecting desktop coding tools
- ❌ Real-time coding tool optimization
- ❌ Active coding sessions

**Access:**
- Web browser
- URL: Your Spectyra web app URL
- Requires: Spectyra API key (for authentication)

### 2. Local Proxy (localhost:3001)

**Purpose:**
- Connecting desktop coding tools (Copilot, Cursor, Claude Code, etc.)
- Real-time optimization of coding workflows
- Routing requests through Spectyra

**What it's NOT for:**
- ❌ Managing scenarios
- ❌ Viewing historical data
- ❌ Running replays

**Access:**
- Runs on your local machine
- Proxy: http://localhost:3001
- Dashboard: http://localhost:3002
- Requires: Spectyra API key + Provider API key

## Architecture Diagram

```
┌─────────────────────────────────────┐
│         Web UI (Browser)             │
│  - Scenarios                          │
│  - Savings Dashboard                  │
│  - Proof Mode                         │
│  - Settings                           │
└──────────────┬────────────────────────┘
               │
               │ (API calls)
               │
┌──────────────▼────────────────────────┐
│      Spectyra API (Backend)           │
│  - Optimization engine                │
│  - Savings tracking                   │
│  - Scenario management                │
└──────────────┬────────────────────────┘
               │
               │ (uses official SDKs)
               │
┌──────────────▼────────────────────────┐
│   Provider APIs (OpenAI, etc.)        │
└───────────────────────────────────────┘

┌─────────────────────────────────────┐
│    Your Coding Tool (Desktop)        │
│  - Copilot, Cursor, Claude Code      │
└──────────────┬──────────────────────┘
               │
               │ (API calls)
               │
┌──────────────▼────────────────────────┐
│   Local Proxy (localhost:3001)       │
│  - Format conversion                  │
│  - Request routing                    │
└──────────────┬────────────────────────┘
               │
               │ (forwards to)
               │
┌──────────────▼────────────────────────┐
│      Spectyra API (Backend)           │
│  - Same backend as web UI             │
└──────────────┬────────────────────────┘
               │
               │ (uses official SDKs)
               │
┌──────────────▼────────────────────────┐
│   Provider APIs (OpenAI, etc.)        │
└───────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Proxy Dashboard (localhost:3002)   │
│  - Real-time savings                 │
│  - Request history                   │
│  - Configuration                     │
└──────────────────────────────────────┘
```

## How They Work Together

### Web UI Workflow

1. User opens web UI
2. User selects a scenario
3. User runs replay (baseline vs optimized)
4. Results shown in web UI
5. Savings tracked in database

**Use case:** Testing, benchmarking, analyzing savings

### Proxy Workflow

1. User starts proxy on their machine
2. User configures proxy with API keys
3. User configures coding tool to use proxy
4. User codes normally
5. Requests automatically optimized
6. Savings shown in proxy dashboard

**Use case:** Real-time optimization while coding

## When to Use Each

### Use Web UI When:
- ✅ You want to test optimization on scenarios
- ✅ You want to compare baseline vs optimized
- ✅ You want to view historical savings
- ✅ You want to estimate savings (proof mode)
- ✅ You want to manage settings

### Use Local Proxy When:
- ✅ You're using Copilot, Cursor, Claude Code
- ✅ You want real-time optimization while coding
- ✅ You want to see savings as you code
- ✅ You're working on actual coding projects

## Common Questions

### Q: Can I connect Copilot to the web UI?
**A:** No. Copilot connects to the Local Proxy, not the web UI. The web UI is for managing scenarios, not connecting tools.

### Q: Where do I see savings from my coding tool?
**A:** In the Proxy Dashboard (http://localhost:3002), not the web UI. The proxy dashboard shows real-time savings from your coding tool.

### Q: Can I see proxy savings in the web UI?
**A:** Not directly. The proxy tracks its own savings. The web UI shows savings from scenarios and replays. They're separate systems.

### Q: Do I need both?
**A:** 
- **For coding tools**: You only need the proxy
- **For testing/analysis**: You only need the web UI
- **For both**: Use both (they work independently)

## Summary

**Web UI** = Management & Analysis
- Scenarios, replays, historical data
- Testing and benchmarking
- Settings and configuration

**Local Proxy** = Real-Time Optimization
- Connecting desktop coding tools
- Real-time optimization while coding
- Live savings monitoring

**They're separate but complementary!**
