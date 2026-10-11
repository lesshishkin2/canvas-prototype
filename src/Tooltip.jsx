import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TOP } from "./toolbar-layout";

// One tooltip across mouse and keyboard; neighbouring tools share the warm delay.
export function Tooltips() {
  const ref = useRef(null),
    warmUntil = useRef(0);
  const [active, setActive] = useState(null);
  const [position, setPosition] = useState(null);
  useEffect(() => {
    const enter = (event) => {
      const button = event.target.closest?.(".tool-button");
      const keyboard = event.type === "focusin";
      if (!button || (keyboard && !button.matches(":focus-visible"))) return;
      setActive((old) =>
        old?.button === button
          ? old
          : {
              button,
              label: button.getAttribute("aria-label"),
              instant: keyboard || performance.now() < warmUntil.current,
            },
      );
    };
    const leave = (event) => {
      setActive((old) =>
        old?.button.contains(event.relatedTarget) ? old : null,
      );
    };
    const hide = () => setActive(null);
    const key = (event) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", key);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("blur", hide);
    };
  }, []);
  useLayoutEffect(() => {
    if (!active) return;
    let frame;
    const measure = () => {
      const button = active.button;
      if (!button.isConnected || button.closest('[aria-hidden="true"]')) {
        setActive(null);
        return;
      }
      const a = button.getBoundingClientRect(),
        b = ref.current.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(
          a.left + (a.width - b.width) / 2,
          document.documentElement.clientWidth - b.width - 8,
        ),
      );
      const top =
        a.bottom + 8 + b.height <= innerHeight - 8
          ? a.bottom + 8
          : Math.max(TOP + 4, a.top - b.height - 8);
      setPosition((old) =>
        old?.left === left && old?.top === top ? old : { left, top },
      );
      if (Number(getComputedStyle(ref.current).opacity) > 0)
        warmUntil.current = performance.now() + 300;
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return (
    active &&
    createPortal(
      <div
        ref={ref}
        className="tool-tooltip"
        aria-hidden="true"
        data-positioned={!!position}
        data-instant={active.instant || undefined}
        style={{ ...position, visibility: position ? "visible" : "hidden" }}
      >
        {active.label}
      </div>,
      document.body,
    )
  );
}
