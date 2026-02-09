import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { runCommand } from "./commands/run.js";
import { agentCommand } from "./commands/agent.js";

const program = new Command();

program
  .name("beacon")
  .description("BeaconOS CLI — build and run AI agents for Commercial Real Estate")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(runCommand);
program.addCommand(agentCommand);

program.parse();
