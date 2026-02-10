import { Command } from "commander";
import { execSync, spawn } from "node:child_process";
import chalk from "chalk";
import ora from "ora";

export const devCommand = new Command("dev")
  .description("Start local dev server (API + Docker services)")
  .option("--no-docker", "Skip starting Docker services")
  .action(async (options: { docker: boolean }) => {
    if (options.docker) {
      const spinner = ora("Starting Docker services...").start();
      try {
        execSync("docker-compose up -d", { stdio: "pipe" });
        spinner.succeed("Docker services running (Postgres + Redis)");
      } catch {
        spinner.warn(
          "Docker services could not start — make sure Docker is running",
        );
      }
    }

    console.log(chalk.blue("\nStarting BeaconOS API server...\n"));

    const apiProcess = spawn("pnpm", ["--filter", "@beacon-os/api", "dev"], {
      stdio: "inherit",
      shell: true,
    });

    apiProcess.on("error", (err) => {
      console.error(chalk.red(`Failed to start API: ${err.message}`));
    });

    process.on("SIGINT", () => {
      apiProcess.kill("SIGINT");
      process.exit(0);
    });
  });
