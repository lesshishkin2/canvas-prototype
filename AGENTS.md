# Prototype Instructions

## Approved scope

This is the user's isolated desktop canvas UX prototype. Keep all page edits in memory only; do not persist edited content or send it to services. Reload restores the default FORMA gallery. The user has authorized a private GitHub repository and deployment to Vercel. Topbar, section actions, link editing, and image editing are intentional demos.

The closest editable target owns the visible toolbar. Maintain this action order: image replacement/editing, item link, duplicate/delete, then a separated drag handle. No arrow reorder buttons. Preserve 26 px dark element controls from the Figma reference, and the white Site Builder topbar and translucent section overlay.

Text editing, duplication, deletion with a last-item guard, and sorting within each original list are functional. Drag starts only from the handle after 6 px. Escape and dropping outside the original container cancel. Desktop Chrome at 1024, 1440, and 1920 px is the requested scope; touch and a global undo history are excluded.

The first canvas section is a menu with five initial links. Each menu label is part of its repeatable item, so hovering the label shows the shared link/copy/delete/drag toolbar above the item. Clicking the label edits plain text; Enter finishes. Links wrap into multiple rows when needed and sort within the menu only. Link editing remains an icon-only demo, consistent with the rest of the prototype.

Button, text-link, and menu toolbars align to the upper-right corner with the same 8 px right inset as other element tools. For these compact targets the toolbar sits above the element so it does not cover editable text; it flips below when the fixed editor bar leaves insufficient space above.

## Local workflow

The “Рассмотреть ближе” section after the collection contains the independent `studies` list. Its repeatable cards have ordinary inline images, not backgrounds or item links. Card tools are exactly duplicate/delete/drag; the nested image owns only replacement/editing tools. Hovering the image or text hides the parent toolbar. Keep image targets and text fields unique when duplicating, and omit editor targets from the drag preview.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
