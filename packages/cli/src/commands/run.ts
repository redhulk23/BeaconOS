import { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import chalk from "chalk";
import ora from "ora";

export const runCommand = new Command("run")
  .description("Run an agent locally")
  .argument("<agent>", "Agent name or path to manifest")
  .option("-i, --input <json>", "JSON input for the agent", "{}")
  .option("--dry-run", "Validate manifest without executing")
  .action(async (agent: string, options: { input: string; dryRun?: boolean }) => {
    const spinner = ora(`Loading agent "${agent}"...`).start();

    // Find manifest
    let manifestPath: string | null = null;
    const candidates = [
      resolve(agent),
      join(process.cwd(), "agents", `${agent}.manifest.yaml`),
      join(process.cwd(), `${agent}.manifest.yaml`),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        manifestPath = candidate;
        break;
      }
    }

    if (!manifestPath) {
      spinner.fail(`Agent manifest not found: ${agent}`);
      console.log(chalk.dim("  Searched:"));
      for (const c of candidates) {
        console.log(chalk.dim(`    ${c}`));
      }
      process.exit(1);
    }

    // Parse manifest
    const content = readFileSync(manifestPath, "utf-8");
    let manifest: Record<string, unknown>;
    try {
      manifest = parseYaml(content) as Record<string, unknown>;
    } catch (err) {
      spinner.fail("Invalid YAML manifest");
      console.error(err);
      process.exit(1);
    }

    const metadata = manifest.metadata as Record<string, unknown>;
    spinner.succeed(`Loaded: ${metadata.name} v${metadata.version}`);

    if (options.dryRun) {
      console.log(chalk.green("\nManifest is valid."));
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }

    // Parse input
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(options.input);
    } catch {
      console.error(chalk.red("Invalid JSON input"));
      process.exit(1);
    }

    // Execute via API
    const apiUrl = process.env.BEACON_API_URL ?? "http://localhost:3000";
    const token = process.env.BEACON_TOKEN;

    if (!token) {
      console.log(
        chalk.yellow(
          "\nNo BEACON_TOKEN set. To run against the API, set BEACON_TOKEN in your environment.",
        ),
      );
      console.log(chalk.dim("For local development, the agent manifest is valid and ready to run."));
      return;
    }

    const runSpinner = ora("Starting agent run...").start();

    try {
      const response = await fetch(`${apiUrl}/api/v1/agents/${metadata.name}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const error = await response.json();
        runSpinner.fail(`Run failed: ${JSON.stringify(error)}`);
        process.exit(1);
      }

      const result = await response.json();
      runSpinner.succeed("Agent run started");
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      runSpinner.fail(`Failed to connect to API at ${apiUrl}`);
      console.error(err instanceof Error ? err.message : err);
    }
  });
