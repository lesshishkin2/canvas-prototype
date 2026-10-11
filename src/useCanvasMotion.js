import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";

// FLIP only structural edits. Text input and dnd-kit keep their own lifecycles.
export function useCanvasMotion() {
  const running = useRef(new Set());
  const frame = useRef(null);
  const notify = () => window.dispatchEvent(new Event("canvaslayout"));
  const finish = useCallback(() => {
    cancelAnimationFrame(frame.current);
    for (const entry of running.current) {
      entry.animation.cancel();
      entry.cleanup();
    }
    running.current.clear();
    notify();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", finish);
    window.addEventListener("resize", finish);
    return () => {
      finish();
      media.removeEventListener("change", finish);
      window.removeEventListener("resize", finish);
    };
  }, [finish]);

  const change = (mutate, { source, added, removed, keyboard }) => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sections = [...document.querySelectorAll(".canvas-section")];
    const items = [
      ...document.querySelectorAll("[data-list-container] > [data-item]"),
    ];
    const sectionBefore = new Map(
      sections.map((node) => [node, node.getBoundingClientRect()]),
    );
    const before = new Map(
      items.map((node) => {
        const rect = node.getBoundingClientRect();
        const parent = sectionBefore.get(node.closest(".canvas-section"));
        return [
          node.dataset.item,
          {
            rect,
            x: rect.left - parent.left,
            y: rect.top - parent.top,
            opacity: getComputedStyle(node).opacity,
          },
        ];
      }),
    );
    const original = items.find((node) => node.dataset.item === source);
    // Keep a non-interactive visual of a deleted item, never duplicate its editor IDs.
    let ghost;
    if (removed && original && !keyboard) {
      const rect = original.getBoundingClientRect();
      const parent = original.parentElement.getBoundingClientRect();
      ghost = original.cloneNode(true);
      for (const node of [ghost, ...ghost.querySelectorAll("*")]) {
        for (const attribute of [...node.attributes])
          if (
            attribute.name.startsWith("data-") ||
            ["id", "tabindex", "contenteditable", "autofocus"].includes(
              attribute.name,
            )
          )
            node.removeAttribute(attribute.name);
      }
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.classList.add("item-exit-ghost");
      Object.assign(ghost.style, {
        position: "absolute",
        margin: "0",
        left: `${rect.left - parent.left}px`,
        top: `${rect.top - parent.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: "none",
        transition: "none",
        opacity: getComputedStyle(original).opacity,
      });
      original.parentElement.append(ghost);
    }
    // Capture the current visual frame before cancelling an interrupted transition.
    finish();
    flushSync(mutate);
    if (keyboard) return;
    const tokens = getComputedStyle(document.documentElement);
    const easeOut = tokens.getPropertyValue("--ease-out").trim();
    const easeMove = tokens.getPropertyValue("--ease-in-out").trim();
    const play = (
      node,
      keyframes,
      duration,
      easing,
      cleanup = () => {},
      delay = 0,
    ) => {
      node.dataset.layoutAnimating = "true";
      const animation = node.animate(keyframes, {
        duration,
        easing,
        delay,
        fill: "both",
      });
      const entry = {
        animation,
        cleanup: () => {
          delete node.dataset.layoutAnimating;
          cleanup();
        },
      };
      running.current.add(entry);
      animation.finished.then(
        () => {
          if (running.current.delete(entry)) {
            animation.cancel();
            entry.cleanup();
          }
        },
        () => {},
      );
    };
    const sectionAfter = new Map(
      sections.map((node) => [node, node.getBoundingClientRect()]),
    );
    if (!reduce) {
      for (const node of sections) {
        const from = sectionBefore.get(node),
          to = sectionAfter.get(node);
        const dx = from.left - to.left,
          dy = from.top - to.top;
        if (Math.abs(dx) + Math.abs(dy) > 0.5)
          play(
            node,
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "none" },
            ],
            240,
            easeMove,
          );
      }
    }
    for (const node of document.querySelectorAll(
      "[data-list-container] > [data-item]",
    )) {
      const id = node.dataset.item;
      const to = node.getBoundingClientRect();
      // Subtract the section's animated position to avoid moving children twice.
      const parent = node.closest(".canvas-section").getBoundingClientRect();
      const from = before.get(id);
      if (id === added) {
        const origin = before.get(source)?.rect;
        const dx = origin ? Math.sign(origin.left - to.left) * 12 : 0;
        const dy = origin ? Math.sign(origin.top - to.top) * 12 : 0;
        play(
          node,
          reduce
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                {
                  opacity: 0,
                  transform: `translate(${dx}px, ${dy}px) scale(0.97)`,
                },
                { opacity: 1, transform: "none" },
              ],
          reduce ? 125 : 200,
          easeOut,
          undefined,
          reduce ? 0 : 40,
        );
      } else if (from) {
        const dx = from.x - (to.left - parent.left),
          dy = from.y - (to.top - parent.top);
        const sx = from.rect.width / to.width,
          sy = from.rect.height / to.height;
        if (
          (!reduce &&
            (Math.abs(dx) + Math.abs(dy) > 0.5 ||
              Math.abs(sx - 1) + Math.abs(sy - 1) > 0.001)) ||
          Number(from.opacity) < 1
        )
          play(
            node,
            [
              {
                opacity: from.opacity,
                transformOrigin: "0 0",
                transform: reduce
                  ? "none"
                  : `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
              },
              { opacity: 1, transform: "none", transformOrigin: "0 0" },
            ],
            reduce ? 125 : 240,
            easeMove,
          );
      }
    }
    if (ghost)
      play(
        ghost,
        reduce
          ? [{ opacity: ghost.style.opacity }, { opacity: 0 }]
          : [
              { opacity: ghost.style.opacity, transform: "none" },
              { opacity: 0, transform: "scale(0.97)" },
            ],
        reduce ? 125 : 160,
        easeOut,
        () => ghost.remove(),
      );
    const tick = () => {
      notify();
      if (running.current.size) frame.current = requestAnimationFrame(tick);
    };
    tick();
  };
  return { change, finish };
}
