import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-app-integration',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-integration.page.html',
  styleUrls: ['./app-integration.page.scss'],
})
export class AppIntegrationPage {
  /** Kept in TS so template parsing does not treat `@` / `{` as Angular syntax. */
  readonly installCommand = 'npm install @spectyra/sdk';

  readonly quickStartCode = `import { createSpectyra } from "@spectyra/sdk";
import { createOpenAIAdapter } from "@spectyra/sdk/adapters/openai";
import OpenAI from "openai";

// 1) One Spectyra instance (reuse across requests)
const spectyra = createSpectyra({
  runMode: "on", // "observe" = preview savings; provider still gets full prompts
  licenseKey: process.env.SPECTYRA_LICENSE_KEY, // trial/paid: apply trims; omit = preview-only
});

const openai = new OpenAI();

// 2) Wrap the call you already make — same client & model, plus the adapter
const { providerResult, report, promptComparison } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Summarize…" }],
  },
  createOpenAIAdapter(openai),
);

// 3) Use the response + savings metadata
console.log(providerResult); // raw OpenAI response
console.log(report.estimatedSavingsPct, report.inputTokensBefore, report.inputTokensAfter);
console.log(report.transformsApplied, report.notes);
if (promptComparison) console.log(promptComparison.diffSummary);`;

  readonly aliasSnippet = `// Optional: same spectyra/* model aliases as OpenClaw (maps to your real models)
const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  spectyraModelAliasOverrides: {
    aliasQualityModel: "gpt-4o",
  },
});

await spectyra.complete(
  { provider: "openai", client: openai, model: "spectyra/quality", messages },
  createOpenAIAdapter(openai),
);`;
}
