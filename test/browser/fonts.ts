// The browser tier's font sets, which a test file chooses before it launches the browser: the
// machine's, the browser's own fontconfig, by default; or DejaVu, the fonts an Ubuntu runner, CI's,
// draws with, by useDejaVu(), so a layout that holds locally is proved in CI's fonts by name, on
// any machine, and CI's run doesn't hold them by accident.
//
// DejaVu is mise.toml's http:dejavu-fonts pin, the release archive at its sha256, which mise run
// install fetches and the browser task names in DEJAVU_FONTS, the archive's install directory. The
// fontconfig useDejaVu() writes is test-only, in a scratch directory under TMPDIR, and lets the
// browser see nothing but Ubuntu's fonts-dejavu-core set, Sans, Sans Mono, and Serif, each regular
// and bold, from the archive's ttf/, with every generic family the foundation's stacks end on
// (system-ui, sans-serif, monospace, serif) resolving to its DejaVu face, as Ubuntu's own
// configuration resolves them. launch() spawns the browser in the test process's environment, so
// FONTCONFIG_FILE, set here before the launch, is the browser's.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A font set: its name, for test titles and diagnostics, and, for a set the test sets up, the
 * families the page must draw in: its sans for the text, its mono for the code. */
export interface Fonts {
  name: string;
  families?: { sans: string; mono: string };
}

/** The machine's fonts, the browser's own fontconfig. */
const MACHINE: Fonts = { name: "the machine's fonts" };

/** DejaVu, as useDejaVu() sets it up. */
const DEJAVU: Fonts = {
  name: "DejaVu",
  families: { sans: "DejaVu Sans", mono: "DejaVu Sans Mono" },
};

/** The files of Ubuntu's fonts-dejavu-core, the set a runner has, in the archive's ttf/. */
const CORE = [
  "DejaVuSans.ttf",
  "DejaVuSans-Bold.ttf",
  "DejaVuSansMono.ttf",
  "DejaVuSansMono-Bold.ttf",
  "DejaVuSerif.ttf",
  "DejaVuSerif-Bold.ttf",
];

/** Each generic family the foundation's font stacks end on, and the DejaVu family it resolves to. */
const GENERICS = {
  "system-ui": "DejaVu Sans",
  "sans-serif": "DejaVu Sans",
  monospace: "DejaVu Sans Mono",
  serif: "DejaVu Serif",
};

let active = MACHINE;

/** The font set this test process draws in. */
export const fonts = (): Fonts => active;

/** XML's escape of a path or a name in the fontconfig. */
const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sets this test process up to draw in DejaVu: writes the test-only fontconfig into a scratch
 * directory, with its cache beside it, and names it in FONTCONFIG_FILE, so a browser launched after
 * this call sees DejaVu's core set alone. Throws when DEJAVU_FONTS doesn't name the pin's install,
 * as the browser task does. Answers the removal of the scratch directory, for after the browser
 * closes.
 */
export function useDejaVu(): () => void {
  const installed = process.env.DEJAVU_FONTS;
  if (!installed) {
    throw new Error("DEJAVU_FONTS names no install of http:dejavu-fonts; run the browser task");
  }
  const ttf = join(installed, "ttf");
  const dir = mkdtempSync(join(tmpdir(), "dejavu-fonts-"));
  const file = join(dir, "fonts.conf");
  const accepted = CORE.map((font) => `      <glob>${xml(join(ttf, font))}</glob>`).join("\n");
  const aliases = Object.entries(GENERICS)
    .map(
      ([generic, family]) =>
        `  <alias binding="same">\n    <family>${generic}</family>\n` +
        `    <prefer><family>${xml(family)}</family></prefer>\n  </alias>`,
    )
    .join("\n");
  writeFileSync(
    file,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${xml(ttf)}</dir>
  <cachedir>${xml(join(dir, "cache"))}</cachedir>
  <selectfont>
    <acceptfont>
${accepted}
    </acceptfont>
    <rejectfont>
      <glob>${xml(join(ttf, "*"))}</glob>
    </rejectfont>
  </selectfont>
${aliases}
</fontconfig>
`,
  );
  process.env.FONTCONFIG_FILE = file;
  active = DEJAVU;
  return () => rmSync(dir, { recursive: true, force: true });
}
