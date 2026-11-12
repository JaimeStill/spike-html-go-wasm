// mise run screenshots: the tooling's spike-html-apps-screenshots on scripts/screenshots.config.ts,
// with one flag of the task's own, --width <px> (or --width=<px>), which the bin doesn't know. The
// script takes it from the arguments, checks it is one of the SDK's capture widths, and hands it
// to the capture file in SCREENSHOTS_WIDTH, which captures only that width; then runs the bin's
// command, main, on the capture file and the other arguments, as the bin does, exiting with its
// code. A width not among the SDK's, a --width with no value, or a second --width is a usage error,
// exit 2, naming the widths, before the server or the browser starts. With --help, the bin's help
// is followed by --width's line. Without --width, every width is captured.

import { join } from "node:path";

import { main } from "@jaimestill/spike-html-apps-tooling/screenshots.js";
import { WIDTHS } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";

/** The environment variable the capture file reads the width from, as it names it. The script
 * imports nothing from the capture file: the bin loads it once the width is set, and a module
 * already loaded would have read it unset. */
const WIDTH = "SCREENSHOTS_WIDTH";

const config = join(import.meta.dirname, "screenshots.config.ts");
const widths = WIDTHS.map(({ width }) => width).join(", ");
const help = `  --width <px>  capture only this width, one of ${widths}; every width by default`;

/** The arguments without --width, and the width it gave, if any; or the misuse, said. */
function split(args: string[]): { rest: string[]; width?: string } | { misuse: string } {
  const rest: string[] = [];
  let width: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    let value: string | undefined;
    if (arg === "--width") {
      value = args[++i];
      if (value === undefined) return { misuse: `--width takes a width, one of ${widths}` };
    } else if (arg.startsWith("--width=")) {
      value = arg.slice("--width=".length);
    } else {
      rest.push(arg);
      continue;
    }
    if (width !== undefined) return { misuse: `--width takes one width, one of ${widths}` };
    if (!WIDTHS.some(({ width: known }) => String(known) === value)) {
      return { misuse: `unknown --width ${value}; the widths: ${widths}` };
    }
    width = value;
  }
  return { rest, width };
}

const given = split(process.argv.slice(2));
if ("misuse" in given) {
  console.error(`mise run screenshots: ${given.misuse}\n${help}`);
  process.exitCode = 2;
} else {
  if (given.width === undefined) delete process.env[WIDTH];
  else process.env[WIDTH] = given.width;
  process.exitCode = await main([config, ...given.rest]);
  if (given.rest.some((arg) => arg === "--help" || arg === "-h")) console.log(help);
}
