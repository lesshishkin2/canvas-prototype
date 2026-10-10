# Prototype Instructions

## Approved scope

This is the user's isolated desktop canvas UX prototype. Keep all page edits in memory only; do not persist edited content or send it to services. Reload restores the default FORMA gallery. The user has authorized a private GitHub repository and deployment to Vercel. Topbar, section actions, link editing, and image editing are intentional demos.

The closest editable target owns the contextual toolbar; its section and repeatable-item ancestors keep their own toolbars visible while the pointer is anywhere inside them. Each level has a separate panel. Maintain this action order: image replacement/editing, item link, duplicate/delete, then a separated drag handle. No arrow reorder buttons. Preserve 26 px dark element controls from the Figma reference, and the white Site Builder topbar and translucent section overlay.

Text editing, duplication, deletion with a last-item guard, and sorting within each original list are functional. Drag starts only from the handle after 6 px. Escape and dropping outside the original container cancel. Desktop Chrome at 1024, 1440, and 1920 px is the requested scope; touch and a global undo history are excluded.

The first canvas section is a menu with five initial links. Each menu label is part of its repeatable item, so hovering the label shows the shared link/copy/delete/drag toolbar above the item. Clicking the label edits plain text; Enter finishes. Links wrap into multiple rows when needed and sort within the menu only. Link editing remains an icon-only demo, consistent with the rest of the prototype.

Button, text-link, and menu toolbars align exactly with the element's right edge, without a right inset. For these compact targets the toolbar sits above the element so it does not cover editable text; it flips below when the fixed editor bar leaves insufficient space above. When scrolled under the fixed editor bar, the section toolbar touches its bottom edge with no gap. Preserve the 8 px inset for ordinary item tools.

## Local workflow

Keep persistent ancestors stable: section → repeatable card/row → hovered image/link. Place each panel at its own anchor, measuring the entire hierarchy before paint. If a child would overlap an ancestor, place it below with a 6 px gap while preserving its horizontal anchor; do not move the parent. Image tools are centered on both axes of the full image. Item tools and link tools remain right-aligned. Preserve the image center unless its tools actually collide with an ancestor or viewport boundary. Keep compact link/menu tools off their text labels. Recalculate the stack on scroll/resize. At the viewport bottom, use free space to the left if there is no room below. Moving through any active panel or its safe gap retains the whole hierarchy. Test zero image padding in `tests/hierarchical-tools-checks.js`; the page keeps its existing 6 px spacing.

The “Когда места мало” section after studies is an editable, sortable `edges` list: a wide image (centered tools with no collision), a 180 px card with a short 180 × 72 px image and zero padding (image tools collide and move below the parent by 6 px), and a link near the top-right of a card (link tools move below parent tools and below the label if needed). Keep these cases reproducible across desktop widths. `tests/edge-case-checks.js` checks their first frames, safe access, scrolling, copying, deletion, and mixed-width sorting.

The “Рассмотреть ближе” section after the collection contains the independent `studies` list. Its repeatable cards have ordinary inline images, not backgrounds or item links. Card tools are exactly duplicate/delete/drag; the nested image owns only replacement/editing tools. Hovering the image, text or button preserves the parent toolbar; only the child panel changes. Keep image targets and text fields unique when duplicating, and omit editor targets from the drag preview.

The user is testing tight image spacing in these cards: keep only 6 px between the image and the top/side card edges. Text retains its 20 px side inset. Do not reserve a large empty strip above the image for parent tools.

Each studies card also contains a button with an editable label and its own link-edit demo toolbar. It is a nested link target; the parent card still has only duplicate/delete/drag.

An already open inset item/image toolbar owns a protective hover bridge across its 8 px top and right gaps. Retain it there even over a nested image, without a DOM overlay that intercepts clicks. Test actual slow pointer paths using hit-testing, not just isolated hover states.

Hover appearance and target changes require 150 ms on the same candidate; preserve the current target until then. Movement inside that candidate does not restart the timer. Returning to the active target, its protective bridge or its toolbar cancels the pending change. Keep the existing 180 ms close delay. Keyboard focus and text editing respond immediately. Cancel stale pending targets on editing, pointer actions, drag, structural actions, scroll, resize, window exit and blur. Keep the rationale and current values in UX-PATTERNS.md up to date with code changes.

Each toolbar owner has fresh intrinsic measurements before its first visible frame; never reuse a section's positioned width for a compact toolbar. Observe the panel as well as its anchor. Hover entry/exit uses opacity only, 125 ms with cubic-bezier(0.23, 1, 0.32, 1); never animate toolbar coordinates or dimensions. A closing panel is inert, aria-hidden, non-interactive and excluded from hover resolution. Return during its exit reverses the same transition immediately. Replace owners at the same level without overlapping icon sets. Keyboard focus, editing, drag, structural actions and reduced motion bypass fades. Check first-visible-frame geometry in tests/toolbar-motion-checks.js.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
