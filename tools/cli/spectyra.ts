#!/usr/bin/env node

/**
 * Spectyra CLI
 * 
 * Command-line interface for running Spectyra optimizations.
 * Supports both talk and code workflows.
 */

import { Command } from "commander";

const SPECTYRA_API = process.env.SPECTYRA_API_URL || "http://localhost:8080";

const program = new Command();

program
  .name("spectyra")
  .description("Spectyra CLI - Token & Cost Reduction Engine")
  .version("0.1.0");

program
  .command("talk")
  .description("Run a chat/Q&A conversation (optimized)")
  .option("-p, --provider <provider>", "Provider (openai, anthropic, gemini, grok)", "openai")
  .option("-m, --model <model>", "Model name", "gpt-4o-mini")
  .option("-i, --input <input>", "Input text or file path")
  .action(async (options) => {
    try {
      let content = options.input;
      
      // If input looks like a file path, read it
      if (content && (content.startsWith("./") || content.startsWith("/"))) {
        const fs = await import("fs");
        content = fs.readFileSync(content, "utf-8");
      }
      
      if (!content) {
        console.error("Error: Input required. Use -i <text> or -i <file>");
        process.exit(1);
      }
      
      const response = await fetch(`${SPECTYRA_API}/v1/chat?mode=optimized`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "talk",
          provider: options.provider,
          model: options.model,
          messages: [{ role: "user", content }],
        }),
      });
      
      const data = await response.json();
      
      console.log("\n=== Response ===");
      console.log(data.responseText);
      console.log("\n=== Usage ===");
      console.log(`Input: ${data.usage.input_tokens} tokens`);
      console.log(`Output: ${data.usage.output_tokens} tokens`);
      console.log(`Total: ${data.usage.total_tokens} tokens`);
      console.log(`Cost: $${data.costUsd.toFixed(6)}`);
      console.log(`Quality: ${data.quality.pass ? "PASS" : "FAIL"}`);
    } catch (error: any) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program
  .command("code")
  .description("Run a coding assistant workflow (optimized)")
  .option("-p, --provider <provider>", "Provider (openai, anthropic, gemini, grok)", "anthropic")
  .option("-m, --model <model>", "Model name", "claude-3-5-sonnet-20241022")
  .option("-i, --input <input>", "Input text or file path")
  .option("-f, --file <file>", "Code file to analyze")
  .action(async (options) => {
    try {
      let content = options.input;
      
      if (options.file) {
        const fs = await import("fs");
        const fileContent = fs.readFileSync(options.file, "utf-8");
        content = content 
          ? `${content}\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``
          : `Please help with this code:\n\`\`\`\n${fileContent}\n\`\`\``;
      }
      
      if (!content) {
        console.error("Error: Input required. Use -i <text> or -f <file>");
        process.exit(1);
      }
      
      const response = await fetch(`${SPECTYRA_API}/v1/chat?mode=optimized`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "code",
          provider: options.provider,
          model: options.model,
          messages: [{ role: "user", content }],
        }),
      });
      
      const data = await response.json();
      
      console.log("\n=== Response ===");
      console.log(data.responseText);
      console.log("\n=== Usage ===");
      console.log(`Input: ${data.usage.input_tokens} tokens`);
      console.log(`Output: ${data.usage.output_tokens} tokens`);
      console.log(`Total: ${data.usage.total_tokens} tokens`);
      console.log(`Cost: $${data.costUsd.toFixed(6)}`);
      console.log(`Quality: ${data.quality.pass ? "PASS" : "FAIL"}`);
      
      if (data.debug.spectral) {
        console.log("\n=== Spectral Analysis ===");
        console.log(`Stability Index: ${data.debug.spectral.stabilityIndex.toFixed(3)}`);
        console.log(`Recommendation: ${data.debug.spectral.recommendation}`);
      }
    } catch (error: any) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program
  .command("replay")
  .description("Run a scenario replay (baseline vs optimized)")
  .requiredOption("-s, --scenario <id>", "Scenario ID")
  .option("-p, --provider <provider>", "Provider", "openai")
  .option("-m, --model <model>", "Model name")
  .action(async (options) => {
    try {
      const response = await (globalThis as any).fetch(`${SPECTYRA_API}/v1/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: options.scenario,
          provider: options.provider,
          model: options.model || (options.provider === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022"),
        }),
      });
      
      const data = await response.json();
      
      console.log("\n=== Replay Results ===");
      console.log(`Scenario: ${data.scenario_id}`);
      console.log(`\nBaseline:`);
      console.log(`  Tokens: ${data.baseline.usage.total_tokens}`);
      console.log(`  Cost: $${data.baseline.costUsd.toFixed(6)}`);
      console.log(`  Quality: ${data.baseline.quality.pass ? "PASS" : "FAIL"}`);
      console.log(`\nOptimized:`);
      console.log(`  Tokens: ${data.optimized.usage.total_tokens}`);
      console.log(`  Cost: $${data.optimized.costUsd.toFixed(6)}`);
      console.log(`  Quality: ${data.optimized.quality.pass ? "PASS" : "FAIL"}`);
      console.log(`\nSavings:`);
      console.log(`  Tokens: ${data.savings.tokensSaved} (${data.savings.pctSaved.toFixed(1)}%)`);
      console.log(`  Cost: $${data.savings.costSavedUsd.toFixed(6)}`);
    } catch (error: any) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program.parse();
