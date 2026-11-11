// The runtime page's script (runtime.html): one runner, its events written into the page, and a
// Run per scenario or handler. A button's data-scenario names the scenario it loads, and its
// data-handler the handler it calls, a program's main run when it names none. Loading is lazy: the
// runner starts its worker and fetches a module only on a Run. Stop terminates the worker, which
// ends whatever runs, spin's loop among them, and the runner hands the compiled module to a fresh
// one, so the next Run instantiates afresh without a fetch. A Run while another is pending stops
// that one first, as the runner does every request: the earlier Run rejects with "stopped", and the
// page shows the latest Run alone, logging how each settled in #runs.
//
// What the page shows, each element's state also on its data attributes: #output, one span per
// output event, its class and data-stream the stream; #result, the last run's answer, data-state
// resolved or rejected; #exit, the last exit code, data-code; #timings, a row per phase of the
// last Run, data-phase; #status, data-state busy or idle, idle once the latest Run settles; and
// #runs, one item per Run, data-run the handler or scenario it names, data-state pending, resolved,
// or rejected, and its answer or error as text.

import { Runner } from "../runtime/runner.ts";

const runner = new Runner();

const element = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`runtime.html has no ${selector}`);
  return found;
};

const output = element("#output");
const result = element("#result");
const exit = element("#exit");
const timings = element("#timings");
const status = element("#status");
const runs = element("#runs");
const input = element<HTMLTextAreaElement>("#input");

runner.listen((event) => {
  switch (event.type) {
    case "output": {
      const span = document.createElement("span");
      span.className = event.stream;
      span.dataset.stream = event.stream;
      span.textContent = event.text;
      output.append(span);
      break;
    }
    case "exit":
      exit.dataset.code = String(event.code);
      exit.textContent = `${event.scenario} exited with code ${event.code}.`;
      break;
    case "timing": {
      const row = document.createElement("tr");
      row.dataset.phase = event.phase;
      const phase = document.createElement("th");
      phase.scope = "row";
      phase.textContent = event.phase;
      const ms = document.createElement("td");
      ms.textContent = event.ms.toFixed(1);
      row.append(phase, ms);
      timings.append(row);
      break;
    }
  }
});

/** How many Runs have started: only the latest shows its answer and sets the status idle. */
let latest = 0;

/** Runs what button names, showing its answer or error; each Run clears the last one's. */
async function run(button: HTMLButtonElement) {
  const { scenario, handler } = button.dataset;
  if (!scenario) return;
  const mine = ++latest;
  const item = document.createElement("li");
  item.dataset.run = handler ?? scenario;
  item.dataset.state = "pending";
  item.textContent = `${handler ?? scenario}: pending`;
  runs.append(item);
  /** Records how this Run settled in #runs, and in #result when it is the latest. */
  const settle = (state: "resolved" | "rejected", text: string) => {
    item.dataset.state = state;
    item.textContent = `${handler ?? scenario}: ${state}, ${text}`;
    if (mine !== latest) return;
    result.dataset.state = state;
    result.textContent = text;
  };
  output.replaceChildren();
  timings.replaceChildren();
  result.textContent = exit.textContent = "";
  delete result.dataset.state;
  delete exit.dataset.code;
  status.dataset.state = "busy";
  status.textContent = `Running ${handler ?? scenario}…`;
  try {
    await runner.load(scenario);
    const value = await runner.run(handler, input.value);
    settle("resolved", typeof value === "string" ? value : JSON.stringify(value, null, 2));
  } catch (error) {
    settle("rejected", error instanceof Error ? error.message : String(error));
  } finally {
    if (mine === latest) {
      status.dataset.state = "idle";
      status.textContent = "Idle.";
    }
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-scenario]")) {
  button.addEventListener("click", () => void run(button));
}

element("#stop").addEventListener("click", () => void runner.stop());
