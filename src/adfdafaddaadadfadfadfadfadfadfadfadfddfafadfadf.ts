import chalk from "chalk";
import { promisify } from "util";
import { exec } from "child_process";
import ora from "ora";

const execAsync = promisify(exec);

export async function getGitDiff(
  repoDir: string,
  destBranch: string = "origin/main",
): Promise<string> {
  try {
    // Use the -C flag to specify the directory for the git command
    const { stdout } = await execAsync(
      `git -C "${repoDir}" diff ${destBranch}`,
    );

    if (!stdout) {
      console.error(
        chalk.red(
          "❌  No git diff found. Please ensure you have changes in your branch.",
        ),
      );
      process.exit(1);
    }

    return stdout;
  } catch (error) {
    console.error("Error getting git diff:", error);
    throw error; // Rethrow or handle as needed
  }
}

export async function getStagedGitDiff(pathToRepo: string): Promise<string> {
  const spinner = ora(chalk.blue('Obtaining staged git diff...')).start();
  try {
    const { stdout } = await execAsync(`git -C ${pathToRepo} diff --cached`);
    spinner.succeed(chalk.blue('Staged git diff obtained'));
    return stdout;
  } catch (error) {
    spinner.fail(chalk.blue('Failed to obtain staged git diff'));
    console.error(chalk.red(error));
    process.exit(1);
  }
}


export async function getStagedFiles(pathToRepo: string): Promise<string[]> {
  const spinner = ora(chalk.blue('Obtaining staged files...')).start();
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync(`git -C "${pathToRepo}" diff --cached --name-only`);
    const files = stdout.trim().split('\n');
    spinner.succeed(chalk.blue('Staged files obtained'));
    return files;
  } catch (error) {
    spinner.fail(chalk.blue('Failed to obtain staged files'));
    console.error(chalk.red(error));
    process.exit(1);
  }
}