import {
  Children,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEditor } from "./Editor";
import { getViewportBounds } from "./viewport";
import { useTouchAutoScroll } from "./useCanvasTouch";

function previewOf(source) {
  const clone = source.cloneNode(true);
  clone.querySelectorAll(".section-divider").forEach((node) => node.remove());
  for (const node of [clone, ...clone.querySelectorAll("*")]) {
    for (const { name } of [...node.attributes]) {
      if (
        name.startsWith("data-") ||
        ["id", "tabindex", "contenteditable", "autofocus"].includes(name)
      )
        node.removeAttribute(name);
    }
  }
  clone.inert = true;
  clone.setAttribute("aria-hidden", "true");
  clone.classList.remove("sort-source", "section-drop-target");
  clone.classList.add("section-drag-preview");
  Object.assign(clone.style, {
    transform: "none",
    transition: "none",
    width: `${source.offsetWidth}px`,
    height: `${source.offsetHeight}px`,
  });
  return clone;
}

function SectionPreview({ snapshot }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    ref.current.replaceChildren(snapshot);
  }, [snapshot]);
  return (
    <div ref={ref} className="section-preview-host" inert aria-hidden="true" />
  );
}

// Separate from the nested repeaters: their handles never start a section drag.
export function SectionList({ children }) {
  const sections = Children.toArray(children);
  const [order, setOrder] = useState(() =>
    sections.map((node) => node.props.id),
  );
  const [drag, setDrag] = useState(null);
  const container = useRef(null);
  const { startDrag, stopDrag, pointerPosition, inputMode } = useEditor();
  // The editor already runs touch autoscroll; use the same measured bounds for mouse.
  useTouchAutoScroll(
    drag?.pointer ? drag.id : null,
    inputMode !== "touch",
    pointerPosition,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const containsPointer = useCallback((point) => {
    const bounds = getViewportBounds();
    const rect = container.current.getBoundingClientRect();
    return (
      point &&
      point.x >= Math.max(rect.left, bounds.left) &&
      point.x <= Math.min(rect.right, bounds.right) &&
      point.y >= Math.max(rect.top, bounds.top) &&
      point.y <= Math.min(rect.bottom, bounds.bottom)
    );
  }, []);
  const collision = useCallback(
    (args) => {
      if (args.pointerCoordinates) {
        if (!containsPointer(args.pointerCoordinates)) return [];
        // Full-width sections have very different heights. Resolve at the grip,
        // not at the centre of the (possibly several screens tall) dragged block.
        return pointerWithin(args);
      }
      return closestCenter(args);
    },
    [containsPointer],
  );
  const finish = (selected = null) => {
    setDrag(null);
    stopDrag(selected);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      autoScroll={false}
      onDragStart={({ active, activatorEvent }) => {
        startDrag(active.id);
        const source = [...container.current.children].find(
          (node) => node.dataset.section === active.id,
        );
        setDrag({
          id: active.id,
          pointer: activatorEvent.type === "pointerdown",
          snapshot: previewOf(source),
        });
      }}
      onDragCancel={() => finish()}
      onDragEnd={({ active, over, activatorEvent }) => {
        let target = over?.id;
        if (activatorEvent.type === "pointerdown") {
          const point = pointerPosition.current;
          if (!containsPointer(point)) target = null;
          else if (!target || target === active.id) {
            // Fast release may happen before the first collision pass. Use the
            // stable layout boxes so animated neighbours cannot change the result.
            target = [...container.current.children].find((node) => {
              const top = node.offsetTop - scrollY;
              return point.y >= top && point.y <= top + node.offsetHeight;
            })?.dataset.section;
          }
        }
        if (target && order.includes(target)) {
          setOrder((previous) =>
            arrayMove(
              previous,
              previous.indexOf(active.id),
              previous.indexOf(target),
            ),
          );
          finish(active.id);
        } else finish();
      }}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <main
          ref={container}
          className="canvas"
          data-section-list="true"
          aria-label="FORMA editor canvas"
        >
          {order.map((id) => sections.find((node) => node.props.id === id))}
        </main>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null} adjustScale={false}>
          {drag && <SectionPreview snapshot={drag.snapshot} />}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
