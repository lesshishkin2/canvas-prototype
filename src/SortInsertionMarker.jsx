import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getViewportBounds } from "./viewport";

// Mark the insertion boundary rather than outlining a second item. Follow the
// displaced neighbour through its transition so the line stays in the gap.
export function SortInsertionMarker({ container, active, over, vertical }) {
  const marker = useRef(null);
  useLayoutEffect(() => {
    if (!active || !over || active === over) return;
    const nodes = [...container.current.children];
    const target = nodes.find((node) => node.dataset.item === over);
    if (!target) return;
    const after =
      nodes.findIndex((node) => node.dataset.item === active) <
      nodes.indexOf(target);
    let frame;
    const update = () => {
      const r = target.getBoundingClientRect();
      const bounds = getViewportBounds();
      const left = vertical
        ? Math.max(r.left, bounds.left)
        : after
          ? r.right + 3
          : r.left - 6;
      const top = vertical
        ? after
          ? r.bottom + 3
          : r.top - 6
        : Math.max(r.top, bounds.top);
      const width = vertical ? Math.min(r.right, bounds.right) - left : 3;
      const height = vertical ? 3 : Math.min(r.bottom, bounds.bottom) - top;
      Object.assign(marker.current.style, {
        left: `${left + scrollX}px`,
        top: `${top + scrollY}px`,
        width: `${Math.max(0, width)}px`,
        height: `${Math.max(0, height)}px`,
        visibility:
          width > 0 &&
          height > 0 &&
          left >= bounds.left &&
          left + width <= bounds.right &&
          top >= bounds.top &&
          top + height <= bounds.bottom
            ? "visible"
            : "hidden",
      });
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [container, active, over, vertical]);

  return active && over && active !== over
    ? createPortal(
        <div
          ref={marker}
          className="sort-insertion-marker"
          aria-hidden="true"
        />,
        document.body,
      )
    : null;
}
