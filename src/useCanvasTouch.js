import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { getViewportBounds, revealCaret } from "./viewport";

function placeCaret(field, x, y) {
  field.focus({ preventScroll: true });
  const position = document.caretPositionFromPoint?.(x, y);
  let range;
  if (position && field.contains(position.offsetNode)) {
    range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
  } else {
    const hit = document.caretRangeFromPoint?.(x, y);
    if (hit && field.contains(hit.startContainer)) range = hit;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  revealCaret();
}

// Touch chooses on release, never on hover/focus or during a scrolling gesture.
export function useCanvasTouch(editor) {
  const api = useRef(editor);
  api.current = editor;
  useEffect(() => {
    const pointers = new Set();
    let gesture = null,
      selectedField = null,
      blockClickUntil = 0,
      dismissed = null;
    const fieldAt = (element) =>
      element?.closest("[data-field]") ||
      element
        ?.closest(".canvas-link,.menu-item")
        ?.querySelector("[data-field]");
    const switchInput = (mode) => {
      const e = api.current;
      if (e.inputRef.current === mode) return;
      e.inputRef.current = mode;
      e.setInputMode(mode);
      document.body.dataset.editorInput = mode;
      document.querySelectorAll(".editable[data-field]").forEach((node) => {
        node.contentEditable =
          mode !== "touch" || node.dataset.field === e.editingRef.current
            ? "plaintext-only"
            : "false";
      });
      if (!e.editingRef.current && !e.dragRef.current) e.clear();
      selectedField = null;
    };
    const cancelDrag = () => {
      if (api.current.dragRef.current)
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          }),
        );
    };
    function down(event) {
      const e = api.current,
        element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      const mode = event.pointerType === "touch" ? "touch" : "mouse";
      switchInput(mode);
      blockClickUntil = 0;
      if (
        e.menuRef.current &&
        !element.closest("[data-editor-menu]") &&
        !e.menuRef.current.anchor.contains(element)
      ) {
        e.closeMenu();
        gesture = null;
        dismissed = event.pointerId;
        blockClickUntil = performance.now() + 800;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (mode !== "touch") return;
      pointers.add(event.pointerId);
      if (pointers.size > 1) {
        gesture = null;
        cancelDrag();
        return;
      }
      e.cancelHoverTimers();
      e.pointerPosition.current = { x: event.clientX, y: event.clientY };
      if (
        element.closest(
          "[data-editor-toolbar], [data-editor-menu], .editor-topbar",
        )
      )
        return;
      const field = fieldAt(element);
      if (e.editingRef.current && field?.dataset.field === e.editingRef.current)
        return;
      if (e.editingRef.current) {
        document.activeElement?.blur();
        selectedField = null;
      }
      const source = element.closest("[data-editor-target]");
      gesture = {
        id: event.pointerId,
        source,
        field,
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        cancelled: false,
      };
    }
    function move(event) {
      if (event.pointerType !== "touch") {
        if (
          !event.buttons &&
          !api.current.editingRef.current &&
          !api.current.dragRef.current
        )
          switchInput("mouse");
        return;
      }
      api.current.pointerPosition.current = {
        x: event.clientX,
        y: event.clientY,
      };
      if (
        gesture?.id === event.pointerId &&
        Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10
      )
        gesture.cancelled = true;
    }
    function up(event) {
      if (dismissed === event.pointerId) {
        dismissed = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.pointerType !== "touch") return;
      const e = api.current;
      pointers.delete(event.pointerId);
      e.pointerPosition.current = { x: event.clientX, y: event.clientY };
      if (e.dragRef.current || e.handlePressed.current) {
        gesture = null;
        selectedField = null;
        blockClickUntil = performance.now() + 600;
        return;
      }
      const tap = gesture;
      gesture = null;
      if (
        !tap ||
        tap.id !== event.pointerId ||
        pointers.size ||
        tap.cancelled ||
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10 ||
        performance.now() - tap.time > 300 ||
        e.menuRef.current
      )
        return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (tap.source && !tap.source.contains(hit)) return;
      blockClickUntil = performance.now() + 600;
      event.preventDefault();
      if (!tap.source) {
        selectedField = null;
        e.clear();
        return;
      }
      const id = tap.field?.dataset.field;
      if (id && selectedField === id && e.activeRef.current) {
        selectedField = null;
        tap.field.style.setProperty(
          "--editing-font-size",
          `${Math.max(16, parseFloat(getComputedStyle(tap.field).fontSize))}px`,
        );
        flushSync(() => e.startEditing(id));
        // Must remain in the trusted pointerup stack for the native keyboard.
        placeCaret(tap.field, event.clientX, event.clientY);
      } else {
        const target = e.readTarget(tap.source);
        if (!id && e.activeRef.current?.id === target.id) {
          selectedField = null;
          e.select(null);
        } else {
          selectedField = id || null;
          e.select(target);
        }
      }
    }
    function cancel(event) {
      pointers.delete(event.pointerId);
      gesture = null;
      if (event.pointerType === "touch") cancelDrag();
    }
    function scroll() {
      if (gesture) gesture.cancelled = true;
    }
    function click(event) {
      if (performance.now() < blockClickUntil) {
        blockClickUntil = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
    function key(event) {
      if (event.key === "Escape") {
        if (api.current.menuRef.current) api.current.closeMenu();
        else if (
          !api.current.editingRef.current &&
          !api.current.dragRef.current
        )
          api.current.clear();
      }
      if (event.key === "Tab") switchInput("mouse");
    }
    function contextMenu(event) {
      if (
        api.current.inputRef.current === "touch" &&
        !event.target.closest('[contenteditable="plaintext-only"]') &&
        event.target.closest("[data-editor-target]")
      )
        event.preventDefault();
    }
    function reset() {
      pointers.clear();
      gesture = null;
      selectedField = null;
    }
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("contextmenu", contextMenu);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("contextmenu", contextMenu);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("blur", reset);
    };
  }, []);
}

export function useTouchAutoScroll(dragging, touch, pointerPosition) {
  useEffect(() => {
    if (!dragging || !touch) return;
    let frame,
      last = performance.now();
    const tick = (now) => {
      const point = pointerPosition.current,
        bounds = getViewportBounds();
      const source = document.querySelector(
        `[data-editor-target="${CSS.escape(dragging)}"]`,
      );
      const list = source
        ?.closest(
          source.dataset.kind === "section"
            ? "[data-section-list]"
            : "[data-list-container]",
        )
        ?.getBoundingClientRect();
      if (point && list && point.x >= list.left && point.x <= list.right) {
        const edge = Math.min(80, (bounds.bottom - bounds.top) / 4);
        let velocity = 0;
        if (point.y < bounds.top + edge && list.top < bounds.top)
          velocity = -Math.min(1, (bounds.top + edge - point.y) / edge);
        else if (point.y > bounds.bottom - edge && list.bottom > bounds.bottom)
          velocity = Math.min(1, (point.y - bounds.bottom + edge) / edge);
        window.scrollBy(0, velocity * Math.min(32, now - last) * 0.6);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging, touch, pointerPosition]);
}
