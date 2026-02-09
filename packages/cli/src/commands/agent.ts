import { Command } from "commander";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";

export const agentCommand = new Command("agent").description(
  "Manage agent definitions",
);

// beacon agent create <name>
agentCommand
  .command("create")
  .argument("<name>", "Agent name")
  .option("-d, --description <desc>", "Agent description")
  .option(
    "-t, --tags <tags>",
    "Comma-separated tags",
    (val: string) => val.split(","),
    [],
  )
  .action(
    async (
      name: string,
      options: { description?: string; tags: string[] },
    ) => {
      const spinner = ora(`Creating agent "${name}"...`).start();
      const agentsDir = join(process.cwd(), "agents");

      if (!existsSync(agentsDir)) {
        mkdirSync(agentsDir, { recursive: true });
      }

      const manifestPath = join(agentsDir, `${name}.manifest.yaml`);
      const handlerPath = join(agentsDir, `${name}.handler.ts`);

      if (existsSync(manifestPath)) {
        spinner.fail(`Agent "${name}" already exists`);
        process.exit(1);
      }

      const tags = options.tags.length > 0
        ? `\n    - ${options.tags.join("\n    - ")}`
        : "";

      writeFileSync(
        manifestPath,
        `apiVersion: beacon-os/v1
metadata:
  name: ${name}
  version: "0.1.0"
  description: ${options.description ?? `${name} agent`}
  tags:${tags || "\n    - custom"}
spec:
  model:
    provider: claude
    model: claude-sonnet-4-5-20250929
    temperature: 0.7
    maxTokens: 4096
  tools: []
  memory:
    shortTerm: true
    longTerm: false
  resources:
    maxTokensPerRun: 100000
    maxStepsPerRun: 50
    timeoutMs: 300000
  permissions: []
  guardrails:
    piiDetection: true
    contentFiltering: true
  systemPrompt: |
    You are the ${name} agent. Complete the task given to you.
`,
      );

      writeFileSync(
        handlerPath,
        `import { defineAgent, parseManifest } from "@beacon-os/sdk";
import { readFileSync } from "node:fs";

const manifest = parseManifest(
  readFileSync(new URL("./${name}.manifest.yaml", import.meta.url), "utf-8"),
);

export default defineAgent(manifest, async (ctx, input) => {
  ctx.log.info({ input }, "${name} agent started");

  const response = await ctx.model.complete([
    { role: "user", content: JSON.stringify(input) },
  ]);

  return { result: response.content };
});
`,
      );

      spinner.succeed(`Agent "${name}" created`);
      console.log(chalk.dim(`  ${manifestPath}`));
      console.log(chalk.dim(`  ${handlerPath}`));
    },
  );

// beacon agent list
agentCommand
  .command("list")
  .description("List registered agents")
  .action(async () => {
    const apiUrl = process.env.BEACON_API_URL ?? "http://localhost:3000";
    const token = process.env.BEACON_TOKEN;

    if (!token) {
      console.log(chalk.yellow("Set BEACON_TOKEN to list agents from the API."));
      return;
    }

    const spinner = ora("Fetching agents...").start();

    try {
      const response = await fetch(`${apiUrl}/api/v1/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        spinner.fail("Failed to fetch agents");
        process.exit(1);
      }

      const { data } = (await response.json()) as {
        data: { id: string; name: string; version: string; status: string }[];
      };
      spinner.succeed(`Found ${data.length} agent(s)`);

      if (data.length === 0) {
        console.log(chalk.dim("  No agents registered yet."));
        return;
      }

      for (const agent of data) {
        const statusColor =
          agent.status === "active" ? chalk.green : chalk.dim;
        console.log(
          `  ${chalk.bold(agent.name)} v${agent.version} ${statusColor(`[${agent.status}]`)} ${chalk.dim(agent.id)}`,
        );
      }
    } catch (err) {
      spinner.fail(`Failed to connect to API at ${apiUrl}`);
    }
  });
