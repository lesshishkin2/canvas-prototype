import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Settings, Palette, Eye } from "lucide-react";
import { getViewportBounds } from "./viewport";

export function EditorMenu({ menu, onClose }) {
  const ref = useRef(null);
  const entries = [
    [Settings, "Settings"],
    [Palette, "Change theme"],
    [Eye, "Preview"],
  ];
  useLayoutEffect(() => {
    const panel = ref.current;
    const layout = () => {
      if (!menu.anchor.isConnected) {
        onClose();
        return;
      }
      const a = menu.anchor.getBoundingClientRect(),
        bounds = getViewportBounds();
      panel.style.maxHeight = `${Math.max(44, bounds.bottom - bounds.top - 16)}px`;
      const r = panel.getBoundingClientRect();
      const left = Math.max(
        bounds.left + 8,
        Math.min(a.right - r.width, bounds.right - r.width - 8),
      );
      let top = a.bottom + 6;
      if (
        top + r.height > bounds.bottom - 8 &&
        a.top - r.height - 6 >= bounds.top + 8
      )
        top = a.top - r.height - 6;
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(bounds.top + 8, Math.min(top, bounds.bottom - r.height - 8))}px`;
      panel.style.visibility = "visible";
    };
    layout();
    window.addEventListener("resize", layout);
    window.visualViewport?.addEventListener("resize", layout);
    return () => {
      window.removeEventListener("resize", layout);
      window.visualViewport?.removeEventListener("resize", layout);
    };
  }, [menu, onClose]);
  return createPortal(
    <div
      ref={ref}
      className="editor-menu"
      data-editor-menu="true"
      role="menu"
      aria-label="Editor actions"
      style={{ visibility: "hidden" }}
      onKeyDown={(event) => {
        const items = [...ref.current.querySelectorAll("button")],
          current = items.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          items[
            (current +
              (event.key === "ArrowDown" ? 1 : items.length - 1) +
              items.length) %
              items.length
          ]?.focus();
        }
      }}
    >
      {entries.map(([Icon, label]) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          aria-label={label}
          onClick={onClose}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
