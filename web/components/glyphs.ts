// The components' glyphs: Octicons' svgs, written out as Lit templates. The icons layer,
// @jaimestill/spike-html-hosting-icons, is the site's source of glyphs, but the build fills it into
// a page's own markup, and no tier imports it (eslint.config.js's table), so a glyph a component
// draws in its shadow root is held here instead, each one the icons layer's module of the same
// name, its path data as that module gives it: 1em square on a 16 viewBox, drawn in currentColor,
// hidden from assistive technology, and never focusable, so the text beside it, or its control's
// name, says what it means.
// From spike-html-hosting-icons (v0.1.0): dist/octicon/copy-16.js, trash-16.js,
// check-circle-16.js, x-circle-16.js, play-16.js, square-fill-16.js, undo-16.js, file-added-16.js,
// pencil-16.js, split-view-16.js, and check-16.js; Octicons, primer/octicons
// @primer/octicons@19.42.0, MIT.

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

/** Octicons' play-16: a triangle in a ring, to start. */
export const play: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0M1.5 8a6.5 6.5 0 1 0 13 0a6.5 6.5 0 0 0-13 0m4.879-2.773l4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215"
  />
</svg>`;

/** Octicons' square-fill-16: a filled square, to stop. */
export const squareFill: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M5.75 4h4.5c.966 0 1.75.784 1.75 1.75v4.5A1.75 1.75 0 0 1 10.25 12h-4.5A1.75 1.75 0 0 1 4 10.25v-4.5C4 4.784 4.784 4 5.75 4"
  />
</svg>`;

/** Octicons' undo-16: an arrow turning back. */
export const undo: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M1.22 6.28a.75.75 0 0 1 0-1.06l3.5-3.5a.749.749 0 1 1 1.06 1.06L3.561 5h7.188l.001.007L10.749 5q.088 0 .171.019A4.501 4.501 0 0 1 10.5 14H8.796a.75.75 0 0 1 0-1.5H10.5a3 3 0 1 0 0-6H3.561L5.78 8.72a.749.749 0 1 1-1.06 1.06z"
  />
</svg>`;

/** Octicons' file-added-16: a page with a plus. */
export const fileAdded: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073Zm4.48 3.758a.75.75 0 0 1 .755.745l.01 1.497h1.497a.75.75 0 0 1 0 1.5H9v1.507a.75.75 0 0 1-1.5 0V9.005l-1.502.01a.75.75 0 0 1-.01-1.5l1.507-.01l-.01-1.492a.75.75 0 0 1 .745-.755"
  />
</svg>`;

/** Octicons' pencil-16: a pencil. */
export const pencil: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953l1.953-.558a.25.25 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44l1.263-1.263a.25.25 0 0 0 0-.354Z"
  />
</svg>`;

/** Octicons' split-view-16: a frame split down its middle, for a layout. */
export const splitView: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5c0 .464-.184.909-.513 1.237A1.75 1.75 0 0 1 14.25 16H1.75c-.464 0-.909-.184-1.237-.513A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0M1.5 1.75v12.5c0 .138.112.25.25.25H7.5v-13H1.75a.25.25 0 0 0-.25.25M9 14.5h5.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H9Z"
  />
</svg>`;

/** Octicons' check-16: a tick. */
export const check: TemplateResult = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1em"
  height="1em"
  viewBox="0 0 16 16"
  aria-hidden="true"
  focusable="false"
>
  <path
    fill="currentColor"
    d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 .018-1.042a.75.75 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0"
  />
</svg>`;
