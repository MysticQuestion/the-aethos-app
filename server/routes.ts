import type { Express } from "express";
import { createServer, type Server } from "node:http";
import {
  generateCanonicalChart,
  goldenInputToCanonicalInput,
  type GoldenInput,
} from "../lib/canonical-calculator";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/calc/canonical", (req, res) => {
    try {
      const body = req.body as GoldenInput;

      if (!body.schema_version || !body.subject_id || !body.birth || !body.config) {
        return res.status(400).json({
          error: "Missing required fields: schema_version, subject_id, birth, config",
        });
      }

      if (body.schema_version !== "1.0.0") {
        return res.status(400).json({
          error: `Unsupported schema_version: ${body.schema_version}`,
        });
      }

      const canonicalInput = goldenInputToCanonicalInput(body);
      const output = generateCanonicalChart(canonicalInput, body.config);

      return res.json(output);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("calc/canonical error:", message);
      return res.status(500).json({ error: message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
