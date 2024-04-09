import chalk from "chalk"

const FRAMES = [
  "⠁",
  "⠉",
  "⠙",
  "⠹",
  "⠽",
  "⠿",
  "⠷",
  "⠧",
  "⠇",
  "⠃",
]

const COLORS = [
  chalk.red,
  chalk.yellow,
  chalk.green,
  chalk.cyan,
  chalk.blue,
  chalk.magenta,
]

const SPINNER = {
  frames: COLORS.flatMap((color) => FRAMES.map((frame) => color(frame))),
  successFrame: chalk.bold.green("✔"),
  failFrame: chalk.bold.red("✖")
}

type Options<T> =  {
  message: string
  success: string | ((result: T) => string)
  fail: string | ((error: Error) => string),
  fps: number
}

/**
 * Displays a spinner while waiting for a promise to resolve
 * @param promise The promise to wait for
 * @param options {Options}
 * @returns 
 */
export function withSpinner<T>(
  promise: Promise<T>, 
  {
    message = "",
    success = "",
    fail = "",
    fps = 15
  }: Partial<Options<T>>
): Promise<T> {
  let frame = 0
  const successMessage = typeof success === "function" ? success : () => success
  const failMessage = typeof fail === "function" ? fail : () => fail

  const interval = setInterval(() => {
    process.stdout.write(`\r${SPINNER.frames[frame]} ${message}`)
    frame = (frame + 1) % SPINNER.frames.length
  }, 1000 / fps)

  return promise
    .finally(() => clearInterval(interval))
    .then((result) => {
      process.stdout.write(`\r${SPINNER.successFrame} ${successMessage(result).padEnd(message.length)}\n`)
      return result
    })
    .catch((error) => {
      process.stdout.write(`\r${SPINNER.failFrame} ${failMessage(error).padEnd(message.length)}\n`)
      throw error
    });
}