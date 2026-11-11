// The runtime page's script (runtime.html): one runner, its events written into the page, and a
// Run per scenario or handler. A button's data-scenario names the scenario it loads, and its
// data-handler the handler it calls, a program's main run when it names none. Loading is lazy: the
// runner starts its worker and fetches a module only on a Run. Stop terminates the worker, which
// ends whatever runs, spin's loop among them, and the runner hands the compiled module to a fresh
// one, so the next Run instantiates afresh without a fetch.
//
// What the page shows, each element's state also on its data attributes: #output, one span per
// output event, its class and data-stream the stream; #result, the last run's answer, data-state
// resolved or rejected; #exit, the last exit code, data-code; #timings, a row per phase of the
// last Run, data-phase; and #status, data-state busy or idle.

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

/** Runs what button names, showing its answer or error; each Run clears the last one's. */
async function run(button: HTMLButtonElement) {
  const { scenario, handler } = button.dataset;
  if (!scenario) return;
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
    result.dataset.state = "resolved";
    result.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch (error) {
    result.dataset.state = "rejected";
    result.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    status.dataset.state = "idle";
    status.textContent = "Idle.";
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-scenario]")) {
  button.addEventListener("click", () => void run(button));
}

element("#stop").addEventListener("click", () => void runner.stop());
