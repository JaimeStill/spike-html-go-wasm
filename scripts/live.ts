// mise run live: the deployed site, as Pages serves it. The index, <base>/, answers 200 as HTML;
// the hello module, <base>go/hello.wasm, answers 200 as application/wasm, and, asked with
// Accept-Encoding: gzip, comes back Content-Encoding: gzip. The base is the Pages URL, or the URL
// given as the first argument. One line per assertion on stdout, `✓ NAME` or `✗ NAME`; on stderr,
// what each failed one got instead, a failed request's reason among them, and the failed names.
// Exits 0 when every assertion holds, and 1 when any fails. Reads the network; writes nothing.
// Never a part of mise run check: test/unit/live.test.ts runs held() against local servers.

/** The site's URL on Pages, the base when no argument gives one. */
export const pages = "https://jaimestill.github.io/spike-html-go-wasm/";

/** An assertion's outcome: its name, and when it failed, what came back instead. */
export interface Outcome {
  name: string;
  failure?: string;
}

/** The media type of a Content-Type value, without its parameters, lowercased. */
function mediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

/** `url` fetched with `headers`, or the reason it couldn't be: fetch rejects only when no
 * response came back. */
async function get(url: URL, headers: Record<string, string> = {}): Promise<Response | string> {
  try {
    const response = await fetch(url, { headers, redirect: "follow" });
    // The body is read and dropped, so the connection is released; fetch has already decoded it.
    await response.arrayBuffer();
    return response;
  } catch (error) {
    const cause =
      error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return `${error instanceof Error ? error.message : String(error)}${cause}`;
  }
}

/** The status and media type a response came back with, as a failure reports them. */
function described(response: Response): string {
  return `${response.status} ${mediaType(response.headers.get("content-type")) || "no type"}`;
}

/** The assertions over the site at `base`, each one's outcome, in order: the index's status and
 * type, the hello module's status and type, and its encoding when gzip is accepted. A request
 * that fails fails each assertion over it, naming why. */
export async function held(base: string): Promise<Outcome[]> {
  const root = new URL(base.endsWith("/") ? base : `${base}/`);
  const index = await get(root);
  const wasmURL = new URL("go/hello.wasm", root);
  // Its own request, so the type is judged with no encoding asked for as well as with one.
  const wasm = await get(wasmURL, { "Accept-Encoding": "gzip" });

  const outcome = (
    name: string,
    response: Response | string,
    holds: (response: Response) => boolean,
    got: (response: Response) => string = described,
  ): Outcome => {
    if (typeof response === "string") return { name, failure: response };
    return holds(response) ? { name } : { name, failure: `got ${got(response)}` };
  };

  return [
    outcome(
      "index 200 text/html",
      index,
      (r) => r.status === 200 && mediaType(r.headers.get("content-type")) === "text/html",
    ),
    outcome(
      "go/hello.wasm 200 application/wasm",
      wasm,
      (r) => r.status === 200 && mediaType(r.headers.get("content-type")) === "application/wasm",
    ),
    outcome(
      "go/hello.wasm gzip",
      wasm,
      (r) => r.status === 200 && r.headers.get("content-encoding")?.toLowerCase() === "gzip",
      (r) => `${r.status} ${r.headers.get("content-encoding") ?? "no"} encoding`,
    ),
  ];
}

/** Each outcome's stdout line. */
export function lines(outcomes: Outcome[]): string[] {
  return outcomes.map(({ name, failure }) => `${failure ? "✗" : "✓"} ${name}`);
}

/** Prints the assertions over the site at `base`, and exits 1 naming each failed one. */
async function main(base: string): Promise<void> {
  const outcomes = await held(base);
  for (const line of lines(outcomes)) process.stdout.write(`${line}\n`);
  const failed = outcomes.filter(({ failure }) => failure);
  for (const { name, failure } of failed) process.stderr.write(`live: ${name}: ${failure}\n`);
  if (failed.length > 0) {
    process.stderr.write(
      `live: ${failed.length} of ${outcomes.length} failed at ${base}: ${failed.map(({ name }) => name).join("; ")}\n`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main(process.argv[2] ?? pages);
}
