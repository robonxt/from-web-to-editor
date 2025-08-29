# WYSIWYG Website Editor

This editor loads pages from the read-only directory `../the-website/` and lets you visually edit them inside an iframe, then export the edited HTML files to a ZIP.

## Rules
- Do not modify any files in `the-website/`.
- All edits are kept in-memory (buffer) until you export or download.
- Relative assets (CSS/JS/images) are resolved by injecting a `<base>` tag pointing at the original page's folder.

## Quick Start (Windows)
1. Open `the-editor/index.html` in a browser (double-click or use a simple static server).
2. In the sidebar under Pages, select a file (e.g. `index.html`) and click "Load Selected".
3. Toggle "Select Element" to pick elements in the page. Use the Inspector to edit attributes/text.
4. Toggle "Editable" to directly edit text content in-place.
5. Click "Save Page To Buffer" to stage the current page.
6. Export all staged files: "Export ZIP (edited files)".
7. Optionally: "Download Current HTML" to save the single page you're viewing.

## UI Overview
- Pages list: tracks known pages (`index.html`, `404.html`). Add more paths manually (e.g. `components/icon.html`).
- Editor (iframe): in-place content editing with `contenteditable`.
- Select Mode: highlights elements for attribute edits (id/class/href/src/style). Tag name can be changed; text content editable via Inspector or directly.
- Buffer: shows the set of edited files that will be included in the ZIP.

## Notes & Limitations
- Only HTML files are edited/exported. Assets are read from `the-website/` at view time but not copied into the ZIP.
- If your page uses script-driven DOM changes, the serialized output reflects the DOM at save time.
- The iframe runs with `sandbox="allow-same-origin allow-scripts allow-forms"` for safety and DOM access.

## Export Format
The ZIP contains the edited HTML files mirroring their relative paths (e.g. `index.html`, `components/icon.html`).

## Extending
- Add fields to `updateInspector()` in `the-editor/app.js` to support more attributes.
- Add asset bundling if you want to include CSS/JS/images in the ZIP.
