import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import {
  IconPencil,
  IconEye,
  IconPlus,
  IconLink,
  IconPhotoUp,
  IconPhotoEdit,
  IconCopyPlus,
  IconTrash,
  IconArrowsMove,
  IconArrowUpRight,
} from "@tabler/icons-react";
import {
  ChevronLeft,
  ChevronDown,
  Settings,
  Palette,
  Eye,
  MoreVertical,
} from "lucide-react";
import { placeToolbar, TOOL_INSET } from "./toolbar-layout";
import { Tooltips } from "./Tooltip";
import {
  getViewportBounds,
  intersectsViewport,
  syncViewport,
  revealCaret,
} from "./viewport";
import { useCanvasTouch, useTouchAutoScroll } from "./useCanvasTouch";
import { EditorMenu } from "./EditorMenu";

const EditorContext = createContext(null);
export const useEditor = () => useContext(EditorContext);
const HOVER_DWELL = 150;
const HOVER_CLOSE = 180;

function readTarget(source, instant = false) {
  return {
    node:
      source.dataset.kind === "link"
        ? source.closest(".canvas-link") || source
        : source,
    id: source.dataset.editorTarget,
    kind: source.dataset.kind,
    list: source.dataset.list,
    item: source.dataset.item,
    hasImage: source.dataset.image === "true",
    hasLink: source.dataset.link === "true",
    placement: source.dataset.toolPlacement,
    section: source.closest("[data-section]")?.dataset.section,
    instant,
  };
}

function toolTargets(active) {
  if (!active) return [null, null, null];
  const section = active.node.closest('[data-kind="section"]');
  const item = active.node.closest('[data-kind="item"]');
  return [
    section ? readTarget(section, active.instant) : null,
    item ? readTarget(item, active.instant) : null,
    ["image", "link"].includes(active.kind) ? active : null,
  ];
}

export function EditorProvider({
  children,
  onDuplicate,
  onRemove,
  counts,
  onBeforeDrag,
}) {
  const [active, setActive] = useState(null),
    [immediateExit, setImmediateExit] = useState(false),
    [editing, setEditing] = useState(null),
    [dragging, setDragging] = useState(null),
    [inputMode, setInputMode] = useState(() =>
      matchMedia("(pointer: coarse)").matches ? "touch" : "mouse",
    ),
    [menu, setMenu] = useState(null),
    [narrow, setNarrow] = useState(
      () => matchMedia("(max-width: 767px)").matches,
    );
  const inputRef = useRef(inputMode),
    menuRef = useRef(null);
  const activeRef = useRef(null),
    editingRef = useRef(null),
    dragRef = useRef(null),
    hideTimer = useRef(null),
    pendingHover = useRef(null),
    locked = useRef(false),
    lastPoint = useRef(null),
    handlePressed = useRef(false);
  const handles = useRef(new Map());
  const toolPanels = useRef(new Map());
  const targets = useMemo(() => toolTargets(active), [active]);
  useEffect(() => {
    const query = matchMedia("(max-width: 767px)");
    const update = () => setNarrow(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const layoutTools = useCallback(() => {
    const viewport = {
      ...getViewportBounds(),
      touch: inputRef.current === "touch",
    };
    const ownerVisible =
      !viewport.touch ||
      (activeRef.current?.node.isConnected &&
        intersectsViewport(
          activeRef.current.node.getBoundingClientRect(),
          viewport,
        ));
    const placed = [];
    for (const entry of [...toolPanels.current.values()].sort(
      (a, b) => a.level - b.level,
    )) {
      const { target, panel, setPositioned, hidden } = entry;
      // Measure wrapped section groups at their final width before descendants.
      if (target.kind === "section") {
        panel.style.width = `${Math.min(target.node.getBoundingClientRect().width, viewport.right - viewport.left)}px`;
      }
      const rect =
        !hidden &&
        ownerVisible &&
        target.node.isConnected &&
        placeToolbar(
          target,
          target.node.getBoundingClientRect(),
          panel.getBoundingClientRect(),
          viewport,
          placed
            .filter((parent) => parent.target.node.contains(target.node))
            .flatMap((parent) => parent.obstacles),
        );
      if (rect) {
        // Normal tools scroll natively with the document. Only the pinned
        // section panel is viewport-fixed. Write geometry synchronously: a
        // React render must not add a frame of lag during scroll or reflow.
        const pinned = target.kind === "section" && rect.top === viewport.top;
        panel.style.position = pinned ? "fixed" : "absolute";
        panel.style.left = `${rect.left + (pinned ? 0 : scrollX)}px`;
        panel.style.top = `${rect.top + (pinned ? 0 : scrollY)}px`;
        panel.style.width =
          rect.sectionWidth === undefined ? "" : `${rect.sectionWidth}px`;
      }
      setPositioned(!!rect);
      if (rect) {
        // The section strip is transparent. Only its visible button groups
        // occupy space; descendants can share the empty part of that row.
        const obstacles =
          target.kind === "section"
            ? Array.from(panel.querySelectorAll(".tool-group"), (group) =>
                group.getBoundingClientRect(),
              )
            : [rect];
        placed.push({ target, obstacles });
      }
    }
  }, []);
  const choose = useCallback((target, immediate = false) => {
    activeRef.current = target;
    setImmediateExit(immediate);
    setActive((old) =>
      old?.id === target?.id &&
      old?.node === target?.node &&
      old?.instant === target?.instant
        ? old
        : target,
    );
  }, []);
  const cancelPendingHover = useCallback(() => {
    clearTimeout(pendingHover.current?.timer);
    pendingHover.current = null;
  }, []);
  const cancelHoverTimers = useCallback(() => {
    cancelPendingHover();
    clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, [cancelPendingHover]);
  const clear = useCallback(() => {
    cancelHoverTimers();
    choose(null, true);
  }, [choose, cancelHoverTimers]);
  const closeMenu = useCallback(() => {
    menuRef.current = null;
    setMenu(null);
  }, []);
  const toggleMenu = useCallback(
    (next) => {
      cancelHoverTimers();
      const value = menuRef.current?.anchor === next.anchor ? null : next;
      menuRef.current = value;
      setMenu(value);
    },
    [cancelHoverTimers],
  );
  const suppress = useCallback(() => {
    locked.current = true;
    clear();
  }, [clear]);
  const startEditing = useCallback(
    (id) => {
      if (editingRef.current === id) return;
      closeMenu();
      editingRef.current = id;
      setEditing(id);
      clear();
    },
    [clear, closeMenu],
  );
  const stopEditing = useCallback(() => {
    editingRef.current = null;
    setEditing(null);
  }, []);
  const startDrag = useCallback(
    (id) => {
      onBeforeDrag?.();
      cancelHoverTimers();
      dragRef.current = id;
      setDragging(id);
    },
    [cancelHoverTimers, onBeforeDrag],
  );
  const stopDrag = useCallback(
    (selectedId) => {
      handlePressed.current = false;
      dragRef.current = null;
      setDragging(null);
      suppress();
      if (selectedId && inputRef.current === "touch") {
        const node = document.querySelector(
          `[data-editor-target="${CSS.escape(selectedId)}"]`,
        );
        if (node) {
          locked.current = false;
          choose(readTarget(node));
        }
      }
    },
    [suppress, choose],
  );
  const selectTouch = useCallback(
    (target) => {
      locked.current = false;
      cancelHoverTimers();
      choose(target);
    },
    [choose, cancelHoverTimers],
  );
  useCanvasTouch({
    inputRef,
    setInputMode,
    activeRef,
    editingRef,
    dragRef,
    handlePressed,
    menuRef,
    closeMenu,
    cancelHoverTimers,
    pointerPosition: lastPoint,
    readTarget,
    startEditing,
    clear,
    select: selectTouch,
  });
  useTouchAutoScroll(dragging, inputMode === "touch", lastPoint);
  useLayoutEffect(() => {
    document.body.dataset.editorInput = inputMode;
    syncViewport();
    layoutTools();
  }, [inputMode, editing, menu, layoutTools]);
  useEffect(() => {
    let viewportFrame = null;
    function resolve(event) {
      if (inputRef.current === "touch" || menuRef.current) return;
      if (event.type === "pointermove") {
        if (event.buttons === 0 && !dragRef.current)
          handlePressed.current = false;
        const point = { x: event.clientX, y: event.clientY };
        const moved =
          !lastPoint.current ||
          Math.hypot(
            point.x - lastPoint.current.x,
            point.y - lastPoint.current.y,
          ) > 2;
        lastPoint.current = point;
        if (locked.current && !moved) return;
        if (moved) locked.current = false;
      } else if (event.type === "focusin") {
        locked.current = false;
        // Keyboard focus owns its tools until the pointer moves again.
        lastPoint.current = null;
      }
      if (
        locked.current ||
        editingRef.current ||
        dragRef.current ||
        handlePressed.current
      )
        return;
      const element = event.target instanceof Element ? event.target : null;
      if (
        event.type !== "viewportchange" &&
        element?.closest("[data-editor-toolbar]")
      ) {
        cancelHoverTimers();
        return;
      }
      const source = element?.closest("[data-editor-target]");
      let previous = activeRef.current;
      if (event.type === "viewportchange" && previous) {
        // Scrolling changes the target even when the pointer has not moved.
        // Keep only shared ancestors; obsolete tools must not float over new content.
        const shared = source
          ? [previous, ...toolTargets(previous).reverse()].find((target) =>
              target?.node.contains(source),
            )
          : null;
        if (shared?.id !== previous.id) {
          cancelHoverTimers();
          choose(shared || null, true);
          previous = shared || null;
        }
      }
      const panels = [...toolPanels.current.values()].filter(
        ({ panel }) =>
          panel.dataset.exiting !== "true" &&
          panel.style.visibility === "visible",
      );
      // Join an inset panel to its owner's top/right edges. This only retains
      // an already open panel; nested targets elsewhere still resolve normally.
      for (const { target: ownerTarget, panel } of panels) {
        if (
          event.type === "pointermove" &&
          (ownerTarget.kind === "item" || ownerTarget.kind === "image") &&
          ownerTarget.placement !== "above" &&
          ownerTarget.node.contains(source)
        ) {
          const owner = ownerTarget.node.getBoundingClientRect(),
            tools = panel.getBoundingClientRect();
          if (
            event.clientX >= Math.max(owner.left, tools.left) &&
            event.clientX <= Math.min(owner.right, tools.right + TOOL_INSET) &&
            event.clientY >=
              Math.max(
                getViewportBounds().top,
                owner.top,
                tools.top - TOOL_INSET,
              ) &&
            event.clientY <= Math.min(owner.bottom, tools.bottom)
          ) {
            cancelHoverTimers();
            return;
          }
        }
        // Keep access when a link or a collision-shifted image panel sits outside its owner.
        if (
          event.type === "pointermove" &&
          (ownerTarget.kind === "link" ||
            ownerTarget.kind === "image" ||
            ownerTarget.placement === "above") &&
          (!source || source.contains(ownerTarget.node))
        ) {
          const a = ownerTarget.node.getBoundingClientRect(),
            b = panel.getBoundingClientRect();
          const left = Math.min(a.left, b.left) - 3,
            right = Math.max(a.right, b.right) + 3;
          const top = Math.min(a.top, b.top),
            bottom = Math.max(a.bottom, b.bottom);
          if (
            event.clientX >= left &&
            event.clientX <= right &&
            event.clientY >= top &&
            event.clientY <= bottom
          ) {
            cancelHoverTimers();
            return;
          }
        }
      }
      if (!source) {
        cancelPendingHover();
        if (!hideTimer.current)
          hideTimer.current = setTimeout(() => {
            hideTimer.current = null;
            choose(null);
          }, HOVER_CLOSE);
        return;
      }
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
      const target = readTarget(source, event.type === "focusin");
      const { node } = target;
      if (event.type === "focusin") {
        cancelPendingHover();
        choose(target);
        return;
      }
      // Returning during fade-out reverses the same panel instead of waiting
      // through another dwell and restarting its entrance from zero.
      if (
        [...toolPanels.current.values()].some(
          ({ panel }) =>
            panel.dataset.exiting === "true" &&
            panel.dataset.owner === target.id,
        )
      ) {
        cancelPendingHover();
        choose(target);
        return;
      }
      if (previous?.id === target.id && previous.node === node) {
        cancelPendingHover();
        return;
      }
      // Movement within one candidate must not restart its dwell time.
      if (
        pendingHover.current?.target.id === target.id &&
        pendingHover.current.target.node === node
      )
        return;
      cancelPendingHover();
      const pending = { target, timer: null };
      pendingHover.current = pending;
      pending.timer = setTimeout(() => {
        if (pendingHover.current !== pending) return;
        pendingHover.current = null;
        if (
          !locked.current &&
          !editingRef.current &&
          !dragRef.current &&
          !handlePressed.current &&
          node.isConnected
        )
          choose(target);
      }, HOVER_DWELL);
    }
    function viewportChanged() {
      cancelPendingHover();
      syncViewport();
      layoutTools();
      if (inputRef.current === "touch") return;
      if (viewportFrame !== null) return;
      viewportFrame = requestAnimationFrame(() => {
        viewportFrame = null;
        const point = lastPoint.current;
        if (point) {
          // Portal tools can otherwise keep themselves hovered over a departed owner.
          const element = document
            .elementsFromPoint(point.x, point.y)
            .find((node) => !node.closest(".floating-tools"));
          resolve({
            type: "viewportchange",
            target: element,
            clientX: point.x,
            clientY: point.y,
          });
        }
      });
    }
    function leave() {
      if (inputRef.current === "touch") return;
      lastPoint.current = null;
      cancelHoverTimers();
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        choose(null);
      }, HOVER_CLOSE);
    }
    function pointerDown(event) {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      cancelHoverTimers();
      const handle = event.target.closest(".drag-handle");
      if (handle && handle.getAttribute("aria-disabled") !== "true") {
        handlePressed.current = true;
      }
      if (
        editingRef.current &&
        !event.target.closest(
          '[contenteditable="plaintext-only"], [data-finish-editing]',
        )
      )
        document.activeElement?.blur();
    }
    function releaseHandle(event) {
      lastPoint.current = { x: event.clientX, y: event.clientY };
      handlePressed.current = false;
    }
    function visibilityChange() {
      if (document.hidden) windowBlur();
    }
    function windowBlur() {
      lastPoint.current = null;
      closeMenu();
      clear();
    }
    function viewportResized() {
      viewportChanged();
      if (inputRef.current === "touch") revealCaret();
    }
    function pageScrolled(event) {
      if (
        event.target instanceof Element &&
        event.target.closest(".editor-menu")
      )
        return;
      if (menuRef.current) closeMenu();
      viewportChanged();
    }
    const headerObserver = new ResizeObserver(viewportChanged);
    const header = document.querySelector(".editor-topbar");
    if (header) headerObserver.observe(header);
    document.addEventListener("pointerup", releaseHandle, true);
    document.addEventListener("pointercancel", releaseHandle, true);
    document.addEventListener("pointermove", resolve);
    document.addEventListener("focusin", resolve);
    document.addEventListener("pointerdown", pointerDown, true);
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", pageScrolled, true);
    window.addEventListener("resize", viewportResized);
    window.visualViewport?.addEventListener("resize", viewportResized);
    window.visualViewport?.addEventListener("scroll", viewportChanged);
    window.addEventListener("canvaslayout", viewportChanged);
    window.addEventListener("blur", windowBlur);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      cancelHoverTimers();
      cancelAnimationFrame(viewportFrame);
      document.removeEventListener("pointerup", releaseHandle, true);
      document.removeEventListener("pointercancel", releaseHandle, true);
      document.removeEventListener("pointermove", resolve);
      document.removeEventListener("focusin", resolve);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.documentElement.removeEventListener("pointerleave", leave);
      headerObserver.disconnect();
      window.removeEventListener("scroll", pageScrolled, true);
      window.removeEventListener("resize", viewportResized);
      window.visualViewport?.removeEventListener("resize", viewportResized);
      window.visualViewport?.removeEventListener("scroll", viewportChanged);
      window.removeEventListener("canvaslayout", viewportChanged);
      window.removeEventListener("blur", windowBlur);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [
    choose,
    clear,
    cancelPendingHover,
    cancelHoverTimers,
    layoutTools,
    closeMenu,
  ]);
  useEffect(() => {
    document.body.dataset.editorMode = dragging
      ? "dragging"
      : editing
        ? "editing"
        : active
          ? inputMode === "touch"
            ? "selected"
            : "hover"
          : "idle";
    document
      .querySelectorAll("[data-active-section]")
      .forEach((n) => n.removeAttribute("data-active-section"));
    if (!editing && !dragging && active?.section)
      document
        .querySelector(`[data-section="${active.section}"]`)
        ?.setAttribute("data-active-section", "true");
    document
      .querySelectorAll("[data-target-hover]")
      .forEach((n) => n.removeAttribute("data-target-hover"));
    const highlighted = [active, ...targets].filter(Boolean);
    if (!editing && !dragging)
      highlighted.forEach(({ node }) =>
        node.setAttribute("data-target-hover", "true"),
      );
    return () => {
      highlighted.forEach(({ node }) =>
        node.removeAttribute("data-target-hover"),
      );
    };
  }, [active, targets, editing, dragging, inputMode]);
  const context = {
    active,
    editing,
    dragging,
    startEditing,
    stopEditing,
    startDrag,
    stopDrag,
    suppress,
    handles,
    toolPanels,
    layoutTools,
    pointerPosition: lastPoint,
    inputMode,
    narrow,
    menu,
    toggleMenu,
    closeMenu,
  };
  return (
    <EditorContext.Provider value={context}>
      {children}
      <Tooltips />
      {menu && <EditorMenu menu={menu} onClose={closeMenu} />}
      {targets.map((target, level) => (
        <ToolLayer
          key={level}
          level={level}
          target={editing ? null : target}
          hidden={!!dragging || !!menu}
          immediate={
            immediateExit || !!editing || !!dragging || !!active?.instant
          }
          counts={counts}
          onDuplicate={(list, id, event) => {
            suppress();
            onDuplicate(list, id, event);
          }}
          onRemove={(list, id, event) => {
            suppress();
            onRemove(list, id, event);
          }}
        />
      ))}
    </EditorContext.Provider>
  );
}

export function ToolButton({
  label,
  disabled = false,
  children,
  onClick,
  ...rest
}) {
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-tip={label}
      onClick={disabled ? undefined : onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

function ToolLayer({
  level,
  target,
  hidden,
  immediate,
  counts,
  onDuplicate,
  onRemove,
}) {
  const requested = target?.kind === "text" ? null : target;
  const [retained, setRetained] = useState(requested);
  useLayoutEffect(() => {
    if (requested) setRetained(requested);
    else if (immediate) setRetained(null);
  }, [requested, immediate]);
  const displayed = requested || (!immediate ? retained : null);
  const exiting = !!displayed && !requested;
  const finishExit = useCallback(() => {
    setRetained((previous) => (previous === displayed ? null : previous));
  }, [displayed]);
  if (!displayed) return null;
  return (
    <FloatingTools
      // Each owner starts with intrinsic dimensions, never the section's width.
      key={`${displayed.kind}:${displayed.id}`}
      target={displayed}
      level={level}
      hidden={hidden}
      immediate={immediate || !!displayed.instant}
      exiting={exiting}
      onExitComplete={finishExit}
      counts={counts}
      onDuplicate={(event) =>
        !exiting &&
        !hidden &&
        onDuplicate(displayed.list, displayed.item, event)
      }
      onRemove={(event) =>
        !exiting && !hidden && onRemove(displayed.list, displayed.item, event)
      }
    />
  );
}

function FloatingTools({
  target,
  level,
  counts,
  onDuplicate,
  onRemove,
  hidden,
  immediate,
  exiting,
  onExitComplete,
}) {
  const ref = useRef(null),
    [positioned, setPositioned] = useState(false);
  const { handles, toolPanels, layoutTools, inputMode } = useEditor();
  const isSection = target.kind === "section";
  useLayoutEffect(() => {
    const entry = { target, panel: ref.current, level, setPositioned, hidden };
    toolPanels.current.set(level, entry);
    layoutTools();
    const observer = new ResizeObserver(layoutTools);
    observer.observe(target.node);
    if (ref.current) observer.observe(ref.current);
    return () => {
      toolPanels.current.delete(level);
      observer.disconnect();
    };
  }, [target, level, toolPanels, layoutTools, hidden, inputMode]);
  useLayoutEffect(() => {
    if (!exiting) return;
    const panel = ref.current;
    const duration = panel
      ? parseFloat(getComputedStyle(panel).transitionDuration) * 1000
      : 0;
    if (immediate || !positioned || !duration) {
      onExitComplete();
      return;
    }
    // transitionend normally removes it; the timeout also covers cancellation.
    const timeout = setTimeout(onExitComplete, duration + 32);
    return () => clearTimeout(timeout);
  }, [exiting, immediate, positioned, onExitComplete]);
  const single = counts[target.list] === 1;
  const h = handles.current.get(isSection ? target.id : target.item);
  const imgTools = (
    <div className="tool-group">
      <ToolButton label="Replace image · demo">
        <IconPhotoUp aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Edit image · demo">
        <IconPhotoEdit aria-hidden="true" />
      </ToolButton>
    </div>
  );
  return createPortal(
    <div
      ref={ref}
      data-editor-toolbar={exiting ? undefined : "true"}
      data-toolbar-kind={target.kind}
      data-toolbar-level={level}
      data-owner={target.id}
      data-positioned={positioned ? "true" : undefined}
      data-instant={immediate ? "true" : undefined}
      data-exiting={exiting ? "true" : undefined}
      inert={exiting || hidden || !positioned}
      aria-hidden={exiting || hidden || !positioned ? true : undefined}
      className={`floating-tools ${isSection ? "section-tools" : ""}`}
      style={{
        visibility: positioned && !hidden ? "visible" : "hidden",
        pointerEvents: hidden || exiting || !positioned ? "none" : undefined,
      }}
      onTransitionEnd={(event) => {
        if (
          exiting &&
          event.target === ref.current &&
          event.propertyName === "opacity"
        )
          onExitComplete();
      }}
      role="toolbar"
      aria-label={
        isSection
          ? "Block actions"
          : target.kind === "item"
            ? "Item actions"
            : "Object actions"
      }
    >
      {isSection ? (
        <>
          <div className="tool-group">
            <ToolButton
              label="Edit block · demo"
              className="tool-button section-edit-button"
            >
              <IconPencil aria-hidden="true" />
              <span>Edit block</span>
            </ToolButton>
          </div>
          {target.hasImage && (
            <div className="section-background-tools">{imgTools}</div>
          )}
          <div className="section-tools-end">
            <div className="tool-group">
              <ToolButton label="Block visibility · demo">
                <IconEye aria-hidden="true" />
              </ToolButton>
              <ToolButton label="Delete block · demo">
                <IconTrash aria-hidden="true" />
              </ToolButton>
            </div>
            <div className="tool-group">
              <ToolButton
                {...h?.attributes}
                {...h?.listeners}
                label="Drag block"
                className="tool-button drag-handle section-drag-handle"
              >
                <IconArrowsMove aria-hidden="true" />
              </ToolButton>
            </div>
          </div>
        </>
      ) : (
        <>
          {(target.kind === "image" || target.hasImage) && imgTools}
          {(target.kind === "link" || target.hasLink) && (
            <div className="tool-group">
              <ToolButton
                label={
                  target.kind === "item"
                    ? "Edit item link · demo"
                    : "Edit link · demo"
                }
              >
                <IconLink aria-hidden="true" />
              </ToolButton>
            </div>
          )}
          {target.kind === "item" && (
            <>
              <div className="tool-group">
                <ToolButton label="Duplicate item" onClick={onDuplicate}>
                  <IconCopyPlus aria-hidden="true" />
                </ToolButton>
                <ToolButton
                  label={single ? "Cannot delete the last item" : "Delete item"}
                  disabled={single}
                  onClick={onRemove}
                >
                  <IconTrash aria-hidden="true" />
                </ToolButton>
              </div>
              <div className="tool-group drag-group">
                <ToolButton
                  {...(!single ? h?.attributes : {})}
                  {...(!single ? h?.listeners : {})}
                  label={single ? "Cannot move the only item" : "Drag item"}
                  disabled={single}
                  className="tool-button drag-handle"
                  onClick={undefined}
                >
                  <IconArrowsMove aria-hidden="true" />
                </ToolButton>
              </div>
            </>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

export function Editable({
  id,
  value,
  onChange,
  as: Tag = "span",
  className = "",
  singleLine = false,
  itemLabel = false,
  kind = "text",
  label,
}) {
  const ref = useRef(null),
    { startEditing, stopEditing, editing, inputMode } = useEditor();
  useLayoutEffect(() => {
    if (
      ref.current &&
      document.activeElement !== ref.current &&
      ref.current.innerText !== value
    )
      ref.current.textContent = value;
  }, [value]);
  const commit = (e) => onChange(e.currentTarget.innerText.replace(/\r/g, ""));
  return (
    <Tag
      ref={ref}
      className={`editable ${className}`}
      data-editor-target={itemLabel ? undefined : id}
      data-kind={itemLabel ? undefined : kind}
      data-field={id}
      data-empty={!value.trim() || undefined}
      data-placeholder="Enter text"
      contentEditable={
        inputMode !== "touch" || editing === id ? "plaintext-only" : false
      }
      suppressContentEditableWarning
      role="textbox"
      aria-label={label || `Edit text: ${value.slice(0, 45) || "empty text"}`}
      aria-multiline={!singleLine}
      tabIndex={0}
      spellCheck="false"
      onFocus={(event) => {
        if (event.currentTarget.isContentEditable) startEditing(id);
      }}
      onInput={commit}
      onBlur={(e) => {
        commit(e);
        stopEditing();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape" || (singleLine && e.key === "Enter")) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onPaste={(e) => {
        if (singleLine) {
          e.preventDefault();
          document.execCommand(
            "insertText",
            false,
            e.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " "),
          );
        }
      }}
    />
  );
}
export function CanvasLink({
  id,
  value,
  onChange,
  className = "",
  arrow = true,
}) {
  return (
    <div
      className={`canvas-link ${className}`}
      data-editor-target={id}
      data-kind="link"
    >
      <Editable
        id={id}
        value={value}
        onChange={onChange}
        kind="link"
        singleLine
      />
      {arrow && <IconArrowUpRight aria-hidden="true" />}
    </div>
  );
}
export function Section({ id, hasImage = false, className = "", children }) {
  const { handles } = useEditor();
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
    active,
    index,
  } = useSortable({ id, animateLayoutChanges: defaultAnimateLayoutChanges });
  useEffect(() => {
    handles.current.set(id, { attributes, listeners });
    return () => handles.current.delete(id);
  }, [handles, id, attributes, listeners]);
  return (
    <section
      ref={setNodeRef}
      style={{ transform: DndCSS.Translate.toString(transform), transition }}
      data-section={id}
      data-editor-target={id}
      data-kind="section"
      data-image={hasImage}
      className={`canvas-section ${className} ${isDragging ? "sort-source" : ""} ${isOver && active?.id !== id ? "section-drop-target" : ""}`}
      data-drop-edge={
        isOver && active?.id !== id
          ? active?.data.current?.sortable.index < index
            ? "after"
            : "before"
          : undefined
      }
    >
      <div className="section-divider section-divider-start">
        <button aria-label="Add block · demo" data-editor-toolbar="true">
          <IconPlus aria-hidden="true" />
        </button>
      </div>
      {children}
      <div className="section-divider section-divider-end">
        <button aria-label="Add block · demo" data-editor-toolbar="true">
          <IconPlus aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
export function Topbar() {
  const { editing, inputMode, menu, toggleMenu } = useEditor();
  const done = !!editing && inputMode === "touch";
  return (
    <header className="editor-topbar">
      <div className="topbar-left">
        <button
          className="back-button"
          title="Back · demo"
          aria-label="Back · demo"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button className="page-switch" title="Switch page · demo">
          <span>
            <span className="desktop-only">Page: </span>
            <strong>Main page</strong>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="topbar-right">
        <button
          className="bare-button desktop-only"
          title="Page settings · demo"
          aria-label="Page settings · demo"
        >
          <Settings size={20} aria-hidden="true" />
        </button>
        <button
          className="bare-button desktop-only"
          title="Change theme · demo"
          aria-label="Change theme · demo"
        >
          <Palette size={20} aria-hidden="true" />
        </button>
        <button className="preview-button desktop-only" title="Preview · demo">
          <Eye size={19} aria-hidden="true" />
          Preview
        </button>
        <button
          className="save-button"
          title={done ? "Finish editing" : "Demo: changes are not saved"}
          data-finish-editing={done || undefined}
          onPointerDown={(event) => {
            if (done) event.preventDefault();
          }}
          onClick={() => {
            if (done) document.activeElement?.blur();
          }}
        >
          {done ? (
            "Done"
          ) : (
            <>
              <span className="desktop-only">Save Changes</span>
              <span className="mobile-only">Save</span>
            </>
          )}
        </button>
        <button
          className="bare-button mobile-only"
          aria-label="More editor actions"
          aria-haspopup="menu"
          aria-expanded={menu?.kind === "topbar"}
          onClick={(event) =>
            toggleMenu({ kind: "topbar", anchor: event.currentTarget })
          }
        >
          <MoreVertical size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
