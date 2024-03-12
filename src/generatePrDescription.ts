import * as fs from "fs";
import prompts from "prompts";
import { config } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { copyToClipboard } from "./copyToClipboard";
import { callChatGPTApi } from "./ChatGPTApi";
import { extraContextPrompt, maybeRewritePrompt } from "./utils";
import { getGitDiff } from "./git";

const DEFAULT_BRANCH = "main";

process.chdir(process.env.CURRENT_DIR || process.cwd());

// Parse arguments
const argv = yargs(hideBin(process.argv))
  .option("branch", {
    alias: "b",
    description: "Specify the branch to compare with",
    type: "string",
    default: "main",
  })
  .help()
  .alias("help", "h")
  .parseSync();

if (argv?.branch != DEFAULT_BRANCH) {
  console.log(chalk.yellow(`Comparing with branch ${chalk.bold(argv.branch)}`));
}

config(); // Load .env file

// Register SIGINT handler
process.on("SIGINT", () => {
  console.log(chalk.red("\nExiting gracefully..."));
  process.exit(0);
});

const DIR_PATH = process.env.CURRENT_DIR || process.cwd();
export const CUSTOM_PROMPT_PATH = `./customPrDescriptionPrompt.txt`;

async function findTemplate(): Promise<[string, string] | null> {
  const templatePaths = [
    `${DIR_PATH}/.github/pull_request_template.md`,
    `${DIR_PATH}/pull_request_template.md`,
    `${DIR_PATH}/.github/PULL_REQUEST_TEMPLATE.md`,
    `${DIR_PATH}/PULL_REQUEST_TEMPLATE.md`,
  ];
  for (const templatePath of templatePaths) {
    if (fs.existsSync(templatePath)) {
      return [fs.readFileSync(templatePath, "utf8"), templatePath];
    }
  }
  return null;
}

function loadCustomPrompt(): string | null {
  try {
    if (fs.existsSync(CUSTOM_PROMPT_PATH)) {
      return fs.readFileSync(CUSTOM_PROMPT_PATH, "utf8");
    }
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Warning: Failed to load custom prompt from ${CUSTOM_PROMPT_PATH}`,
      ),
    );
  }
  return null;
}

async function getPRDescription(
  systemContent: string,
  diffContent: string,
): Promise<string> {
  console.log(chalk.blue("🤖 Generating PR description..."));
  return await callChatGPTApi(systemContent, diffContent);
}

async function main() {
  const diff = await getGitDiff(DIR_PATH, "origin/main");

  if (!DIR_PATH) {
    console.error(
      chalk.red(
        "❌ Environment variable CURRENT_DIR is not set. Please run this script in a git repository.",
      ),
    );
    process.exit(1);
  }

  console.log(chalk.blue("🤖 Let's prepare your PR description. 🚀"));

  const result = await findTemplate();
  let template, templatePath;

  if (result !== null) {
    [template, templatePath] = result;
  }

  let attachTemplate: prompts.Answers<string> = { value: false };

  if (template) {
    attachTemplate = await prompts({
      type: "toggle",
      name: "value",
      active: "yes",
      inactive: "no",
      message: chalk.yellow(
        `📄 PR template found at ${chalk.yellow(templatePath)} - apply it to the description?`,
      ),
      initial: true,
    });
  }

  let prompt =
    loadCustomPrompt() ||
    `You are a helpful assistant. Generate a clear, concise and structured PR description using the provided git diff. 
    Use bullet-points and numbered lists where necessary and appropriate, especially when detailing changes.`;

  console.log(
    chalk.blue(`Here's the prompt so far:\n\t${chalk.green(prompt)}`),
  );

  prompt = await maybeRewritePrompt(prompt);
  prompt += await extraContextPrompt(prompt);

  if (attachTemplate.value && template) {
    const pullRequestTemplatePrompt = `
    
    Please make the PR description fit this pull request template format:\n${template}`;
    prompt += pullRequestTemplatePrompt;
  } else {
    prompt += `Unless you believe there's a better one, the description structure is as follows:
    ## What (if applied, this commit will)
    ## Why (A clear explanation of why this change is necessary)
    ## Testing (The best way to verify the implementation)`;
  }

  const prDescription = await getPRDescription(prompt, diff);
  console.log(chalk.green(`\n🚀 Generated PR Description:\n`));
  console.log(prDescription);

  // Ask if the user wants to copy the response to the clipboard
  const copyToClipboardPrompt = await prompts({
    type: "toggle",
    name: "value",
    message: chalk.yellow("📋 Copy the PR description to the clipboard?"),
    initial: true,
    active: "yes",
    inactive: "no",
  });

  if (copyToClipboardPrompt.value) {
    await copyToClipboard(prDescription);
    console.log(chalk.green("✅  PR description copied to clipboard!"));
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  console.error(error);
  process.exit(1);
});
