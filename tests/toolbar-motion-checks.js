// Browser checks sample rendered frames, including the first visible frame.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise(requestAnimationFrame);
const query = (selector) => document.querySelector(selector);
const panels = () => [
  ...document.querySelectorAll('.floating-tools:not([data-exiting="true"])'),
];
const panel = (id) =>
  id ? panels().find((p) => p.dataset.owner === id) : panels().at(-1);
const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
function move(x, y) {
  const hit = document.elementFromPoint(x, y);
  assert(hit, "Pointer left the viewport");
  hit.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerType: "mouse",
    }),
  );
}
function pointAt(node) {
  const r = node.getBoundingClientRect();
  if (node.dataset.kind === "section") move(r.left + 25, r.top + 80);
  else if (node.dataset.kind === "item") move(r.left + 3, r.top + 3);
  else move(r.left + r.width / 2, r.top + Math.min(80, r.height / 2));
}
async function prepare() {
  document.activeElement?.blur();
  await document.fonts.ready;
  const section = query('[data-section="studies"]');
  window.scrollTo(0, section.offsetTop - 90);
  await wait(100);
  move(400, 20);
  await wait(350);
}
function checkPosition(tools, owner) {
  const p = tools.getBoundingClientRect(),
    r = owner.getBoundingClientRect();
  if (owner.dataset.kind === "section") {
    assert(
      Math.abs(p.left - r.left) < 1 &&
        Math.abs(p.width - r.width) < 1 &&
        Math.abs(p.top - Math.max(66, r.top)) < 1,
      "Section geometry is stale",
    );
  } else if (owner.dataset.kind === "image") {
    assert(
      Math.abs(p.left + p.width / 2 - (r.left + r.width / 2)) < 1,
      "Image tools are not centered from their first visible frame",
    );
    assert(
      Math.abs(p.top + p.height / 2 - (r.top + r.height / 2)) < 1,
      "Image tools are not vertically centered",
    );
  } else {
    const right =
      r.right -
      (owner.dataset.kind === "link" || owner.dataset.toolPlacement === "above"
        ? 0
        : 8);
    assert(
      Math.abs(p.right - right) < 1,
      `First-frame horizontal jump for ${tools.dataset.owner}: ${p.right} instead of ${right}`,
    );
    if (owner.dataset.kind !== "link")
      assert(Math.abs(p.top - (r.top + 8)) < 1, "Toolbar top position jumped");
    else
      assert(
        p.bottom <= r.top || p.top >= r.bottom,
        "Link tools cover the label",
      );
  }
  return { left: p.left, top: p.top, width: p.width };
}

export async function runToolbarMotionChecks() {
  assert(
    !matchMedia("(prefers-reduced-motion: reduce)").matches,
    "Use the reduced-motion check in this mode",
  );
  await prepare();
  const targets = [
    "studies",
    "study-1.image",
    "study-1",
    "study-1.cta",
    "studies",
    "study-2.image",
    "studies",
    "study-1.image",
  ];
  const transitions = [];
  for (const id of targets) {
    const owner = query(`[data-editor-target="${id}"]`);
    const existing = panel(id);
    pointAt(owner);
    const samples = [];
    const start = performance.now();
    while (performance.now() - start < 1200) {
      await frame();
      const tools = panel(id);
      const visible = panels().filter((p) => p.style.visibility === "visible");
      for (let i = 0; i < visible.length; i++)
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i].getBoundingClientRect(),
            b = visible[j].getBoundingClientRect();
          assert(
            !(
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top
            ),
            "Ancestor and child tools overlap",
          );
        }
      if (existing)
        assert(panel(id) === existing, "Persistent ancestor remounted");
      if (tools?.dataset.owner !== id) continue;
      const css = getComputedStyle(tools),
        opacity = Number(css.opacity);
      if (css.visibility !== "visible" || opacity === 0) continue;
      const rect = checkPosition(tools, owner);
      assert(
        css.transform === "none" && css.transitionProperty === "opacity",
        "Layout or transform is being animated",
      );
      samples.push({ ...rect, opacity });
      if (opacity === 1 && samples.length >= 3) break;
    }
    assert(samples.length > 0, `No visible frames for ${id}`);
    assert(
      existing || samples.some((s) => s.opacity > 0 && s.opacity < 1),
      `No fade-in frames for ${id}`,
    );
    assert(samples.at(-1).opacity === 1, `Fade-in did not finish for ${id}`);
    transitions.push({
      id,
      visibleFrames: samples.length,
      first: samples[0],
      last: samples.at(-1),
      persistent: !!existing,
    });
    await wait(200);
  }
  // Fade-out stays in place and immediately gives up clicks and keyboard focus.
  const last = panel(),
    lastRect = last.getBoundingClientRect();
  move(400, 20);
  const exits = [];
  const start = performance.now();
  while (performance.now() - start < 400) {
    await frame();
    const closing = query(
      '.floating-tools[data-owner="study-1.image"][data-exiting="true"]',
    );
    if (!closing) continue;
    const css = getComputedStyle(closing),
      r = closing.getBoundingClientRect();
    assert(
      closing.inert &&
        closing.getAttribute("aria-hidden") === "true" &&
        css.pointerEvents === "none",
      "Exiting tools remain actionable",
    );
    assert(
      !closing.hasAttribute("data-editor-toolbar"),
      "Exiting tools still capture hover",
    );
    assert(
      Math.abs(r.left - lastRect.left) < 1 &&
        Math.abs(r.top - lastRect.top) < 1,
      "Exit moved the panel",
    );
    exits.push(Number(css.opacity));
  }
  assert(
    exits.some((o) => o > 0 && o < 1),
    "No intermediate fade-out frames",
  );
  assert(!query(".floating-tools"), "Finished exit remains mounted");

  const image = query('[data-editor-target="study-1.image"]');
  pointAt(image);
  await wait(330);
  const retained = panel();
  move(400, 20);
  await wait(210);
  assert(retained.dataset.exiting === "true", "Exit did not begin");
  pointAt(image);
  await frame();
  await frame();
  assert(
    panel() === retained && !retained.inert,
    "Return restarted/remounted the panel instead of reversing",
  );
  await wait(180);
  assert(
    getComputedStyle(retained).opacity === "1",
    "Interrupted fade did not recover",
  );

  const card = query('[data-item="study-1"]');
  card.focus();
  await frame();
  await frame();
  assert(
    panel()?.dataset.owner === "study-1" &&
      getComputedStyle(panel()).opacity === "1" &&
      getComputedStyle(panel()).transitionDuration === "0s",
    "Keyboard focus waits for animation",
  );
  query('[data-field="study-1.title"]').focus();
  await frame();
  assert(!query(".floating-tools"), "Editing left a fading panel behind");
  document.activeElement.blur();
  return {
    viewport: { width: innerWidth, height: innerHeight },
    transitions,
    exitFrames: exits,
    interruptedExit: "passed",
    keyboardAndEditing: "passed",
  };
}

export async function checkReducedToolbarMotion() {
  assert(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
    "Reduced motion must be emulated by the browser",
  );
  await prepare();
  pointAt(query('[data-editor-target="study-1.image"]'));
  await wait(190);
  assert(
    panel()?.dataset.owner === "study-1.image" &&
      getComputedStyle(panel()).opacity === "1" &&
      getComputedStyle(panel()).transitionDuration === "0s",
    "Reduced motion still animates entry",
  );
  move(400, 20);
  await wait(220);
  assert(
    !query(".floating-tools"),
    "Reduced motion still waits for an exit transition",
  );
  return { reducedMotion: "passed" };
}
