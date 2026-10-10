import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight } from "lucide-react";
import {
  EditorProvider,
  Editable,
  CanvasLink,
  Section,
  Topbar,
  useEditor,
} from "./Editor";
import {
  initialContent,
  initialLists,
  duplicateItem,
  removeItem,
  reorderItems,
} from "./data";
import "@fontsource-variable/inter";
import "@fontsource-variable/cormorant-garamond";

function ItemView({ item, list, onChange, ghost = false }) {
  const text = (key, className, as = "span") =>
    ghost ? (
      ReactText(as, { className, children: item[key] })
    ) : (
      <Editable
        as={as}
        id={`${item.id}.${key}`}
        value={item[key]}
        onChange={(value) => onChange(item.id, key, value)}
        className={className}
      />
    );
  const cta = ghost ? (
    <div
      className={`canvas-link ${list === "works" ? "card-cta" : "event-link"}`}
    >
      <span>{item.cta}</span>
      <ArrowUpRight />
    </div>
  ) : (
    <CanvasLink
      id={`${item.id}.cta`}
      value={item.cta}
      onChange={(value) => onChange(item.id, "cta", value)}
      className={list === "works" ? "card-cta" : "event-link"}
    />
  );
  if (list === "works")
    return (
      <>
        <img
          className="artwork-bg"
          src={item.image}
          alt=""
          draggable="false"
          style={{ objectPosition: item.position }}
        />
        <div className="artwork-shade" />
        <div className="card-copy">
          {text("meta", "card-meta")}
          {text("title", "card-title", "h3")}
          {cta}
        </div>
      </>
    );
  return (
    <>
      <div className="event-when">
        {text("date", "event-date")}
        {text("type", "event-type")}
      </div>
      <div className="event-copy">
        {text("title", "event-title", "h3")}
        {text("description", "event-description", "p")}
      </div>
      {cta}
    </>
  );
}
function ReactText(Tag, props) {
  return <Tag {...props} />;
}

function SortableItem({ item, list, count, onChange, over, active }) {
  const { handles } = useEditor();
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: count === 1 });
  useEffect(() => {
    handles.current.set(item.id, { attributes, listeners });
    return () => handles.current.delete(item.id);
  }, [handles, item.id, attributes, listeners]);
  const styles = { transform: CSS.Transform.toString(transform), transition };
  return (
    <article
      ref={setNodeRef}
      style={styles}
      className={`${list === "works" ? "artwork-card" : "event-row"} ${isDragging ? "sort-source" : ""} ${over === item.id && active !== item.id ? "drop-target" : ""}`}
      data-editor-target={item.id}
      data-kind="item"
      data-list={list}
      data-item={item.id}
      data-image={!!item.image}
      data-link={!!item.link}
      tabIndex={0}
      aria-label={`${list === "works" ? "Работа" : "Выставка"}: ${item.title}`}
    >
      <ItemView item={item} list={list} onChange={onChange} />
    </article>
  );
}
function Repeater({ list, items, onChange, onReorder }) {
  const { startDrag, stopDrag, pointerPosition } = useEditor(),
    container = useRef(null);
  const [active, setActive] = useState(null),
    [over, setOver] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const collision = useCallback((args) => {
    const r = container.current?.getBoundingClientRect(),
      p = args.pointerCoordinates;
    if (
      r &&
      p &&
      (p.x < r.left ||
        p.x > r.right ||
        p.y < Math.max(66, r.top) ||
        p.y > r.bottom)
    )
      return [];
    if (p) {
      const underPointer = pointerWithin(args);
      if (underPointer.length) return underPointer;
      return closestCenter({
        ...args,
        collisionRect: {
          left: p.x,
          right: p.x,
          top: p.y,
          bottom: p.y,
          width: 0,
          height: 0,
        },
      });
    }
    return closestCenter(args);
  }, []);
  const activeItem = items.find((item) => item.id === active);
  const finish = () => {
    setActive(null);
    setOver(null);
    stopDrag();
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 8 }}
      onDragStart={({ active }) => {
        setActive(active.id);
        startDrag(active.id);
      }}
      onDragOver={({ over }) => setOver(over?.id || null)}
      onDragCancel={finish}
      onDragEnd={({ active, over, activatorEvent }) => {
        let target = over?.id;
        if (activatorEvent.type === "pointerdown") {
          const point = pointerPosition.current;
          const bounds = container.current?.getBoundingClientRect();
          const contains = (rect) =>
            point &&
            rect &&
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom;
          if (!contains(bounds) || point.y < 66) target = null;
          // A quick release may precede dnd-kit's first collision measurement.
          // Resolve only a directly hit sibling, within the original list.
          else if (!target || target === active.id) {
            target = Array.from(container.current.children).find(
              (node) =>
                node.dataset.item !== active.id &&
                contains(node.getBoundingClientRect()),
            )?.dataset.item;
          }
        }
        if (target) onReorder(list, active.id, target);
        finish();
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={
          list === "works" ? rectSortingStrategy : verticalListSortingStrategy
        }
      >
        <div
          ref={container}
          data-list-container={list}
          className={list === "works" ? "artwork-grid" : "event-list"}
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              list={list}
              count={items.length}
              onChange={onChange}
              over={over}
              active={active}
            />
          ))}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeItem && (
            <article
              className={`${list === "works" ? "artwork-card" : "event-row"} drag-preview`}
            >
              <ItemView item={activeItem} list={list} ghost />
            </article>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

export function App() {
  const [content, setContent] = useState(() => ({ ...initialContent })),
    [lists, setLists] = useState(() => structuredClone(initialLists));
  const changeField = (key, value) =>
    setContent((previous) => ({ ...previous, [key]: value }));
  const changeItem = (list) => (id, key, value) =>
    setLists((previous) => ({
      ...previous,
      [list]: previous[list].map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  const duplicate = (list, id) =>
    setLists((previous) => ({
      ...previous,
      [list]: duplicateItem(previous[list], id, crypto.randomUUID()),
    }));
  const remove = (list, id) =>
    setLists((previous) => ({
      ...previous,
      [list]: removeItem(previous[list], id),
    }));
  const reorder = (list, id, over) =>
    setLists((previous) => ({
      ...previous,
      [list]: reorderItems(previous[list], id, over),
    }));
  const text = (key, className, as = "span") => (
    <Editable
      id={key}
      value={content[key]}
      onChange={(value) => changeField(key, value)}
      className={className}
      as={as}
    />
  );
  const link = (key, className) => (
    <CanvasLink
      id={key}
      value={content[key]}
      onChange={(value) => changeField(key, value)}
      className={className}
    />
  );
  return (
    <EditorProvider
      onDuplicate={duplicate}
      onRemove={remove}
      counts={{
        works: lists.works.length,
        exhibitions: lists.exhibitions.length,
      }}
    >
      <Topbar />
      <main className="canvas" aria-label="Canvas редактора FORMA">
        <Section id="hero" hasImage className="hero">
          <img
            className="hero-art"
            src="/assets/art/hero.jpg"
            alt=""
            draggable="false"
          />
          <div className="hero-shade" />
          <div className="site-masthead">
            {text("hero.brand", "wordmark")}
            {text("hero.note", "masthead-note")}
          </div>
          <div className="hero-body">
            {text("hero.eyebrow", "eyebrow")}
            {text("hero.title", "hero-title", "h1")}
            <div className="hero-bottom">
              <div>
                {text("hero.description", "hero-description", "p")}
                {link("hero.cta", "primary-link")}
              </div>
              {text("hero.bottom", "hero-categories")}
            </div>
          </div>
        </Section>
        <Section id="collection" className="collection section-padding">
          <div className="section-heading">
            <div>
              {text("collection.eyebrow", "eyebrow")}
              {text("collection.title", "section-title", "h2")}
            </div>
            {text("collection.description", "section-intro", "p")}
          </div>
          <Repeater
            list="works"
            items={lists.works}
            onChange={changeItem("works")}
            onReorder={reorder}
          />
        </Section>
        <Section id="about" className="about section-padding">
          <figure
            className="about-visual"
            data-editor-target="about.image"
            data-kind="image"
            tabIndex={0}
            aria-label="Изображение галереи"
          >
            <img
              src="/assets/art/interior.jpg"
              alt="Живописная работа в коллекции галереи FORMA"
              draggable="false"
            />
          </figure>
          <div className="about-copy">
            {text("about.eyebrow", "eyebrow")}
            {text("about.title", "section-title", "h2")}
            {text("about.description", "body-copy", "p")}
            {text("about.description2", "body-copy muted", "p")}
            {link("about.link", "text-link")}
            {text("about.caption", "about-caption")}
          </div>
        </Section>
        <Section id="exhibitions" className="exhibitions section-padding">
          <div className="section-heading">
            <div>
              {text("exhibitions.eyebrow", "eyebrow")}
              {text("exhibitions.title", "section-title", "h2")}
            </div>
            <ArrowUpRight className="program-mark" aria-hidden="true" />
          </div>
          <Repeater
            list="exhibitions"
            items={lists.exhibitions}
            onChange={changeItem("exhibitions")}
            onReorder={reorder}
          />
        </Section>
        <Section id="invite" className="invite section-padding">
          <div className="invite-content">
            {text("invite.eyebrow", "eyebrow")}
            {text("invite.title", "invite-title", "h2")}
            {text("invite.description", "invite-description", "p")}
            {link("invite.cta", "primary-link dark-link")}
          </div>
          <div className="site-footer">
            {text("invite.brand", "footer-wordmark")}
            {text("invite.footer", "footer-note")}
          </div>
        </Section>
      </main>
    </EditorProvider>
  );
}
