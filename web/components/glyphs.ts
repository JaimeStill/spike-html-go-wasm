// The components' glyphs: Octicons' svgs, written out as Lit templates. The icons layer,
// @jaimestill/spike-html-hosting-icons, is the site's source of glyphs, but the build fills it into
// a page's own markup, and no tier imports it (eslint.config.js's table), so a glyph a component
// draws in its shadow root is held here instead, each one the icons layer's module of the same
// name, its path data as that module gives it: 1em square on a 16 viewBox, drawn in currentColor,
// hidden from assistive technology, and never focusable, so the text beside it, or its control's
// name, says what it means.
// From @jaimestill/spike-html-hosting-icons (v0.1.0): dist/octicon/copy-16.js, trash-16.js,
// check-circle-16.js, and x-circle-16.js; Octicons, primer/octicons @primer/octicons@19.42.0, MIT.

import { html, type TemplateResult } from "lit";

/** Octicons' copy-16: two overlapping pages. */
export const copy: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
  />
  <path
    fill="currentColor"
    d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
  />
</svg>`;

/** Octicons' trash-16: a bin. */
export const trash: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75M4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.75 1.75 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15M6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25"
  />
</svg>`;

/** Octicons' check-circle-16: a tick in a ring. */
export const checkCircle: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m1.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 0 0-13 0m10.28-1.72l-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 .018-1.042a.75.75 0 0 1 1.042-.018l1.47 1.47l3.97-3.97a.75.75 0 0 1 1.042.018a.75.75 0 0 1 .018 1.042"
  />
</svg>`;

/** Octicons' x-circle-16: a cross in a ring. */
export const xCircle: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M2.344 2.343a8 8 0 0 1 11.314 11.314A8.002 8.002 0 0 1 .234 10.089a8 8 0 0 1 2.11-7.746m1.06 10.253a6.5 6.5 0 1 0 9.108-9.275a6.5 6.5 0 0 0-9.108 9.275M6.03 4.97L8 6.94l1.97-1.97a.749.749 0 0 1 1.275.326a.75.75 0 0 1-.215.734L9.06 8l1.97 1.97a.749.749 0 0 1-.326 1.275a.75.75 0 0 1-.734-.215L8 9.06l-1.97 1.97a.749.749 0 0 1-1.275-.326a.75.75 0 0 1 .215-.734L6.94 8L4.97 6.03a.75.75 0 0 1 .018-1.042a.75.75 0 0 1 1.042-.018"
  />
</svg>`;
