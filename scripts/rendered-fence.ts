// The components page's rendered fence, a build step: the fence its Go demo state "A fence as the
// SDK's Markdown renders it, highlighted at build" holds, rendered from one fixed Markdown fence,
// RENDERED_FENCE, by the SDK's own render and Shiki highlighter, the path markdownPages renders a
// Markdown page's fences by, and written into components.html through renderedFence(), a Vite
// plugin vite.config.ts lists. The sample is therefore the SDK's output, not a copy of it, and
// follows the SDK as it changes.
//
// components.html marks the fence's place, the demo's one child, with the comment FENCE_MARKER
// names, and the rendered pre replaces the marker. The build fails when the page lacks the marker
// or holds it twice, so the state can't build without its fence. No other page holds the marker,
// and none is changed.
//
// The fence is highlighted under the SDK's built-in syntax themes, as markdownPages highlights the
// spike's Markdown pages by default; its tokens' classes take their colors from a syntax
// stylesheet, and the components page links none: the demo reads its fence and doesn't render it,
// and without script the fence shows as the page's code, unhighlighted.

import { basename } from "node:path";

import { render } from "@jaimestill/spike-html-hosting-sdk/markdown-pages.js";
import { builtinSyntax, createSyntax } from "@jaimestill/spike-html-hosting-sdk/syntax.js";
import type { Plugin } from "vite";

/** The page the rendered fence goes into, by its file under the root. */
export const FENCE_PAGE = "components.html";

/** The marker components.html holds where the rendered fence goes. */
export const FENCE_MARKER = "<!-- rendered-fence -->";

/** The fence the sample renders: its language and its one line. */
export const RENDERED_FENCE = { lang: "json", text: '{ "shiki": true, "list": [3, 1, 2] }' };

/** The fixed fence as the SDK renders a Markdown page's fence: its pre, highlighted by the SDK's
 * Shiki highlighter under its built-in themes, as markdownPages writes it, with no line break
 * after it. */
export async function renderFence(): Promise<string> {
  const { lang, text } = RENDERED_FENCE;
  const syntax = await createSyntax(builtinSyntax, [lang]);
  // A page of the one fence, titled by its front matter, so it renders no heading.
  const markdown = `---\nname: Rendered fence\n---\n\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
  const source = {
    pages: new Set(["fence.md"]),
    external: new Set<string>(),
    repository: "",
    ref: "",
  };
  const { html } = render("fence.md", markdown, source, syntax.highlight);
  if (!html.startsWith('<pre class="shiki')) {
    throw new Error(`rendered-fence: the SDK rendered the ${lang} fence unhighlighted`);
  }
  return html.trimEnd();
}

/** The page with its fence marker replaced by the rendered fence; throws, naming the page, when
 * the page holds no marker or more than one. */
export function writeFence(html: string, page: string, fence: string): string {
  const found = html.split(FENCE_MARKER).length - 1;
  if (found !== 1) {
    throw new Error(`rendered-fence: want one ${FENCE_MARKER} in ${page}, found ${found}`);
  }
  return html.replace(FENCE_MARKER, () => fence);
}

/** The plugin: components.html's fence marker replaced by the rendered fence, before Vite's own
 * transform, as siteNav writes the nav; the fence is rendered once, on the first page that needs
 * it, and every other page passes unchanged. */
export function renderedFence(): Plugin {
  let fence: Promise<string> | undefined;
  return {
    name: "spike:rendered-fence",
    transformIndexHtml: {
      order: "pre",
      async handler(html, { filename }) {
        const page = basename(filename);
        if (page !== FENCE_PAGE) return html;
        fence ??= renderFence();
        return writeFence(html, page, await fence);
      },
    },
  };
}
