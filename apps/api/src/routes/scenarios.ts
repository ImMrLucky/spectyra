import { Router } from "express";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import type { Scenario } from "@spectyra/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scenariosDir = join(__dirname, "../../scenarios");

export const scenariosRouter = Router();

scenariosRouter.get("/", (req, res) => {
  try {
    const files = readdirSync(scenariosDir).filter(f => f.endsWith(".json"));
    const scenarios = files.map(file => {
      const content = readFileSync(join(scenariosDir, file), "utf-8");
      const scenario: Scenario = JSON.parse(content);
      return {
        id: scenario.id,
        path: scenario.path,
        title: scenario.title,
      };
    });
    res.json(scenarios);
  } catch (error) {
    res.status(500).json({ error: "Failed to load scenarios" });
  }
});

scenariosRouter.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const filePath = join(scenariosDir, `${id}.json`);
    const content = readFileSync(filePath, "utf-8");
    const scenario: Scenario = JSON.parse(content);
    res.json(scenario);
  } catch (error) {
    res.status(404).json({ error: "Scenario not found" });
  }
});
