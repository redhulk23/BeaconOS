import { Command } from "commander";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";

export const initCommand = new Command("init")
  .description("Scaffold a new BeaconOS agent project")
  .argument("[name]", "Project name", "my-beacon-agent")
  .action(async (name: string) => {
    const spinner = ora("Scaffolding project...").start();
    const dir = join(process.cwd(), name);

    if (existsSync(dir)) {
      spinner.fail(`Directory "${name}" already exists`);
      process.exit(1);
    }

    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, "agents"), { recursive: true });

    // package.json
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            build: "tsc",
            dev: "beacon dev",
          },
          dependencies: {
            "@beacon-os/sdk": "workspace:*",
          },
          devDependencies: {
            typescript: "^5.7.0",
          },
        },
        null,
        2,
      ),
    );

    // tsconfig.json
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            esModuleInterop: true,
            outDir: "dist",
            rootDir: ".",
          },
          include: ["agents"],
        },
        null,
        2,
      ),
    );

    // Sample agent manifest
    writeFileSync(
      join(dir, "agents", "hello.manifest.yaml"),
      `apiVersion: beacon-os/v1
metadata:
  name: hello-agent
  version: "0.1.0"
  description: A simple hello world agent
  tags:
    - example
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
    You are a helpful assistant. Respond concisely and accurately.
`,
    );

    // Sample agent handler
    writeFileSync(
      join(dir, "agents", "hello.handler.ts"),
      `import { defineAgent, parseManifest } from "@beacon-os/sdk";
import { readFileSync } from "node:fs";

const manifest = parseManifest(
  readFileSync(new URL("./hello.manifest.yaml", import.meta.url), "utf-8"),
);

export default defineAgent(manifest, async (ctx, input) => {
  ctx.log.info({ input }, "Hello agent started");

  const response = await ctx.model.complete([
    { role: "user", content: input.message as string ?? "Hello!" },
  ]);

  ctx.emit("completed", { response: response.content });

  return { message: response.content };
});
`,
    );

    // .env
    writeFileSync(
      join(dir, ".env"),
      `ANTHROPIC_API_KEY=sk-ant-xxxx
DATABASE_URL=postgresql://beacon:beacon_dev@localhost:5432/beacon_os
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-me
`,
    );

    spinner.succeed(`Project "${name}" created`);
    console.log();
    console.log(chalk.green("  Next steps:"));
    console.log(`    cd ${name}`);
    console.log("    pnpm install");
    console.log("    beacon dev");
    console.log("    beacon run hello-agent");
  });
