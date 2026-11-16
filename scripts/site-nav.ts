// The site's own nav, a build step: one list of the spike's pages, SITE_NAV, written into every
// page the build writes, the four hand pages and each page markdownPages renders into
// markdown-shell.html, through siteNav(), a Vite plugin vite.config.ts lists. The SDK's sl-site-nav
// links between sites and its Pages drawer lists the Markdown pages alone, so the nav between this
// site's own pages is the spike's.
//
// The plugin rewrites each page's markup before Vite's own transform, so the script it adds is
// bundled into the page's one entry, and before markdownPages' post transform, which fills the
// glyph marker it adds as it fills every other. Into each page it writes, from SITE_NAV alone:
// - the row, a nav landmark named "Site", as the header's first child, where sl-site-nav would
//   stand: the spike's name linking home, then Playground, sqlate, Library demos, and Components,
//   the page's own link marked aria-current="page";
// - the drawer's opener, a glyph button named "Site", showing Octicons' three-bars-16 and the key
//   hint N, bound to N through data-keys, as the header-actions group's first button;
// - the drawer, an sl-drawer labeled "Site", its id site, holding the same links, the last child
//   of the body; and
// - the drawer's script, web/pages/site-nav.ts, which loads the drawer's module and wires the
//   opener, the last script of the head.
// Into the index alone it writes, from SITE_NAV too, the where-to-go list: a section headed
// "Where to go", its id where-to-go, holding a list of every page SITE_NAV links but home, in its
// order, each item the page's link and its line, Library demos' item listing its Markdown pages
// under it, each by its title, as markdownPages titles it, in markdownPages' order. The index marks
// its place with the comment WHERE_TO_GO names, and the list replaces the marker.
// Each is written once per page and failed on when the page lacks its place, so a page whose
// header changes can't build without its nav, and an index can't build without its list. web/pages/page.css shows the row where it fits and
// the opener where it doesn't.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { indexOrder, pageFile, render } from "@jaimestill/spike-html-hosting-sdk/markdown-pages.js";
import type { Plugin } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

/** One link of the nav: its text, its href, relative to the root's pages, and the pages, each by
 * its file under the root, that mark it as the current page; and, on every link but home's, its
 * line in the index's where-to-go list, what the reader finds there. */
export interface NavLink {
  label: string;
  href: string;
  pages: string[];
  description?: string;
}

/** The Markdown files markdownPages renders from markdown/, in its site index's order. */
const markdownFiles = indexOrder(
  readdirSync(join(root, "markdown")).filter((name) => name.endsWith(".md")),
);

/** The pages markdownPages renders from markdown/, in its site index's order. */
const markdownPages = markdownFiles.map(pageFile);

/** Each Markdown page's title, as markdownPages titles it, by render, from its front matter name
 * or its h1; render throws, as the build does, on a file with neither. The tree links nothing
 * outside itself, so its source names no repository or ref. */
export const MARKDOWN_TITLES: ReadonlyMap<string, string> = new Map(
  markdownFiles.map((file) => {
    const source = {
      pages: new Set(markdownFiles),
      external: new Set<string>(),
      repository: "",
      ref: "",
    };
    const { title } = render(file, readFileSync(join(root, "markdown", file), "utf8"), source);
    return [pageFile(file), title];
  }),
);

/** The site's name, package.json's, the repository's, the one place it is written. */
const name = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string })
  .name;

/** The nav's links, in order: the one list every page's row and drawer are written from. Library
 * demos links the first Markdown page, and every Markdown page marks it current. */
export const SITE_NAV: NavLink[] = [
  { label: name, href: "./", pages: ["index.html"] },
  {
    label: "Playground",
    href: "playground.html",
    pages: ["playground.html"],
    description:
      "Write your own Go, or start from a calculator or one of four programs, and compile and run it in the page with Go's own compiler and linker.",
  },
  {
    label: "sqlate",
    href: "sqlate.html",
    pages: ["sqlate.html"],
    description:
      "Edit SQL patterns and statements, compiled by sqlate for PostgreSQL and run as a guarded edit over a scripted driver, all built in the page.",
  },
  {
    label: "Library demos",
    href: markdownPages[0],
    pages: markdownPages,
    description:
      "Three rendered Markdown pages, live demos of a service wired on go-core's graph, of go-web-sdk's handlers called in-process, and of sqlate's compile handler.",
  },
  {
    label: "Components",
    href: "components.html",
    pages: ["components.html"],
    description:
      "The spike's components in each of their states, its Go demos running hello and the probe's handlers in a worker.",
  },
];

/** The drawer's dock: a width no viewport reaches, so the drawer is a modal at every width. Below
 * the switch (page.css) its opener shows; above it, the row. */
export const DOCK = "10000rem";

/** The list of links, the page's own marked current. */
function list(page: string, indent: string): string {
  const items = SITE_NAV.map(({ label, href, pages }) => {
    const current = pages.includes(page) ? ' aria-current="page"' : "";
    return `${indent}  <li><a href="${href}"${current}>${label}</a></li>`;
  });
  return `${indent}<ul>\n${items.join("\n")}\n${indent}</ul>`;
}

/** The row: the nav landmark, as the header's first child. */
const row = (page: string) =>
  `\n      <nav class="site-nav" aria-label="Site">\n${list(page, "        ")}\n      </nav>`;

/** The drawer's opener, a glyph button with its interest hint, the group's first. */
const opener = `
        <button
          type="button"
          class="glyph-button site-opener"
          aria-controls="site"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-label="Site"
          data-keys="n"
          interestfor="site-hint"
          aria-description=""
        >
          <svg data-icon="octicon/three-bars-16"></svg>
          <span aria-hidden="true"><kbd>N</kbd></span>
        </button>
        <div id="site-hint" class="glyph-hint" popover="hint" aria-hidden="true">Site</div>`;

/** The drawer, holding the same links. */
const drawer = (page: string) =>
  `\n    <sl-drawer id="site" label="Site" dock="${DOCK}">\n${list(page, "      ")}\n    </sl-drawer>`;

/** The drawer's script, render-blocking as every module script of a page is. */
const script = `\n    <script type="module" blocking="render" src="./web/pages/site-nav.ts"></script>`;

/** The index's where-to-go list's place, the marker the list replaces. */
export const WHERE_TO_GO = "<!-- site-nav: where-to-go -->";

/** The where-to-go list: a section headed "Where to go", an item for each page SITE_NAV links but
 * home, its link and its line, Library demos' listing its Markdown pages, each by its title. */
function whereToGo(indent: string): string {
  const pageList = (pad: string) =>
    [
      `${pad}<ul>`,
      ...markdownPages.map(
        (file) => `${pad}  <li><a href="${file}">${MARKDOWN_TITLES.get(file)}</a></li>`,
      ),
      `${pad}</ul>`,
    ].join("\n");
  const items = SITE_NAV.filter(({ description }) => description !== undefined).map(
    ({ label, href, pages, description }) => {
      const head = `${indent}    <li>\n${indent}      <a href="${href}">${label}</a>: ${description}`;
      const nested = pages === markdownPages ? `\n${pageList(`${indent}      `)}` : "";
      return `${head}${nested}\n${indent}    </li>`;
    },
  );
  return [
    `<section class="where-to-go" aria-labelledby="where-to-go">`,
    `${indent}  <h2 id="where-to-go">Where to go</h2>`,
    `${indent}  <ul>`,
    ...items,
    `${indent}  </ul>`,
    `${indent}</section>`,
  ].join("\n");
}

/** The page's markup with the nav written in, and on the index the where-to-go list; throws naming
 * the page and the place it lacks. */
export function writeNav(html: string, page: string): string {
  const places: [RegExp, (match: string) => string][] = [
    [/<body\b[^>]*>\s*<header>/, (match) => match + row(page)],
    [/<div class="header-actions">/, (match) => match + opener],
    [/\n\s*<\/head>/, (match) => script + match],
    [/\n\s*<\/body>/, (match) => drawer(page) + match],
  ];
  if (page === "index.html") {
    places.push([
      /( *)<!-- site-nav: where-to-go -->/,
      (match) => match.replace(WHERE_TO_GO, whereToGo(match.slice(0, match.indexOf("<")))),
    ]);
  }
  let out = html;
  for (const [place, write] of places) {
    const found = out.match(new RegExp(place, "g"))?.length ?? 0;
    if (found !== 1)
      throw new Error(`site-nav: want one ${place.source} in ${page}, found ${found}`);
    out = out.replace(place, write);
  }
  return out;
}

/** The plugin: every page the build writes, a hand page or a rendered one, takes the nav. */
export function siteNav(): Plugin {
  return {
    name: "spike:site-nav",
    transformIndexHtml: {
      order: "pre",
      handler: (html, { filename }) => writeNav(html, basename(filename)),
    },
  };
}
