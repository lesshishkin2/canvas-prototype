// Run via import() in the local browser. Uses hit-testing for every activation.
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const assert = (value, message) => {
  if (!value) throw Error(message);
};
const target = (id) => document.querySelector(`[data-editor-target="${id}"]`);
const panel = (id) =>
  document.querySelector(
    `.floating-tools[data-owner="${id}"]:not([data-exiting])`,
  );
const rect = (n) => n.getBoundingClientRect();
const reserved = (n) => Number(n.dataset.toolbarClearance || 0);
const buttonsBottom = (id) =>
  Math.max(
    ...[...panel(id).querySelectorAll(".tool-button")].map(
      (n) => rect(n).bottom,
    ),
  );

export async function runToolbarClearanceChecks(pointerType = "touch") {
  await document.fonts.ready;
  const results = [];
  function pointer(n, type, x, y) {
    n.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType,
        isPrimary: true,
        clientX: x,
        clientY: y,
        buttons: type === "pointerdown" ? 1 : 0,
      }),
    );
  }
  async function activate(n) {
    const r = rect(n),
      x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    assert(
      hit && n.contains(hit),
      `Activation obstructed: ${n.dataset.editorTarget}`,
    );
    if (pointerType === "touch") {
      pointer(hit, "pointerdown", x, y);
      pointer(hit, "pointerup", x, y);
    } else pointer(hit, "pointermove", x, y);
    await wait();
  }
  async function reset() {
    document.activeElement?.blur();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await wait(400);
  }
  async function show(n) {
    await reset();
    n.scrollIntoView({ block: "start" });
    scrollBy(0, -180);
    await wait();
    await reset();
    await activate(n);
  }

  await reset();
  scrollTo(0, 0);
  await wait();
  await reset();
  const menu = target("menu"),
    logo = target("menu.logo");
  const beforeMenu = rect(menu).height;
  await activate(logo);
  assert(reserved(menu) > 0, "Section did not reserve space above logo/login");
  assert(
    rect(menu).height > beforeMenu,
    "Section clearance did not enter flow",
  );
  assert(
    rect(target("menu.login")).top >= buttonsBottom("menu") + 5.5,
    "Section buttons still cover login",
  );
  const menuAmount = reserved(menu);
  await wait(350);
  assert(reserved(menu) === menuAmount, "Section clearance oscillates");
  results.push("section reserves only missing space and remains stable");

  const image = target("edge-narrow.image"),
    card = target("edge-narrow");
  await show(image);
  assert(reserved(card) > 0, "Card did not reserve space");
  assert(
    rect(image).top >= buttonsBottom("edge-narrow") + 5.5,
    "Image remains under card controls",
  );
  assert(
    Math.abs(
      rect(panel("edge-narrow.image")).top + 18 - (rect(image).top + 36),
    ) < 1,
    "Image tools are not centered in the displaced image",
  );
  const amount = reserved(card);
  scrollBy(0, 8);
  await wait();
  assert(reserved(card) === amount, "Scroll changed clearance");
  await wait(500);
  assert(reserved(card) === amount, "Idle layout oscillates");
  results.push(
    "card image shifts below controls; image tools remain centered; scroll does not accumulate padding",
  );

  const title = target("edge-narrow.title");
  await activate(title);
  assert(reserved(card) === amount, "Changing descendant collapses clearance");
  const beforeEdit = rect(title).top;
  if (pointerType === "touch") await activate(title);
  else title.focus({ preventScroll: true });
  await wait();
  assert(
    title.isContentEditable && document.activeElement === title,
    "Text editing did not start",
  );
  assert(
    reserved(card) === amount && Math.abs(rect(title).top - beforeEdit) < 1,
    "Editing moved the text",
  );
  title.blur();
  await wait(400);
  assert(!reserved(card), "Finished editing leaves idle padding");
  results.push(
    "descendant selection and text editing retain clearance; blur cleans it up",
  );

  const study = document.querySelector(".study-card"),
    studyImage = study.querySelector(".study-image");
  study.style.paddingTop = "26px";
  await show(studyImage);
  assert(!reserved(study), "Exactly 50% must not trigger clearance");
  await reset();
  study.style.paddingTop = "25px";
  await show(studyImage);
  assert(reserved(study) === 25, "19px overlap must trigger 25px clearance");
  await reset();
  assert(
    study.style.paddingTop === "25px",
    "Original inline padding was not restored",
  );
  study.style.removeProperty("padding-top");
  results.push("strict 50% threshold; original inline styles restored");

  await show(target("edge-link.cta"));
  const link = target("edge-link.cta"),
    owner = link.closest('[data-kind="item"]');
  assert(reserved(owner) > 0, "Link overlap did not trigger clearance");
  assert(
    rect(link).top >= buttonsBottom(owner.dataset.editorTarget) + 5.5,
    "Link remains obstructed",
  );
  await reset();
  assert(
    !document.querySelector("[data-toolbar-clearance]"),
    "Deselection leaks clearance",
  );
  await show(image);
  const grip = panel("edge-narrow").querySelector(".drag-handle");
  const gr = rect(grip),
    gx = gr.left + gr.width / 2,
    gy = gr.top + gr.height / 2;
  const padding = getComputedStyle(card).paddingTop;
  pointer(grip, "pointerdown", gx, gy);
  document.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      pointerType,
      isPrimary: true,
      clientX: gx + 10,
      clientY: gy,
      buttons: 1,
    }),
  );
  await wait();
  const preview = document.querySelector(".drag-preview");
  assert(
    preview && getComputedStyle(preview).paddingTop === padding,
    "Drag preview lost reserved image spacing",
  );
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
  pointer(document, "pointerup", gx + 10, gy);
  await wait();
  assert(
    !document.querySelector(".drag-preview"),
    "Cancelled drag leaked a preview",
  );
  await reset();
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    "Horizontal overflow",
  );
  results.push(
    "links receive clearance; deselection restores layout without horizontal overflow",
  );
  results.push("drag copy retains clearance and cancellation cleans up");
  return { pointerType, width: innerWidth, results };
}
