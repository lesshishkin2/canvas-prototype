import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  defaultAnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconArrowUpRight } from "@tabler/icons-react";
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
import { useCanvasMotion } from "./useCanvasMotion";

const listStyles = {
  menu: { item: "menu-item", container: "menu-list", label: "Пункт меню" },
  works: {
    item: "artwork-card",
    container: "artwork-grid",
    label: "Работа",
    backgroundImage: true,
  },
  studies: {
    item: "study-card",
    container: "study-grid",
    label: "Деталь коллекции",
  },
  exhibitions: {
    item: "event-row",
    container: "event-list",
    label: "Выставка",
  },
  edges: {
    item: "edge-card",
    container: "edge-grid",
    label: "Пограничный сценарий",
    variants: true,
  },
  edgeSamples: {
    item: "edge-card",
    container: "edge-grid edge-samples",
    label: "Пограничный сценарий",
    variants: true,
  },
};

const itemClass = (list, item) =>
  `${listStyles[list].item}${listStyles[list].variants ? ` edge-${item.variant}` : ""}`;

function EdgeCaseView({ item, ghost, text, link }) {
  const picture = (key = "image", className = "") => (
    <figure
      className={`edge-image ${className}`}
      data-editor-target={ghost ? undefined : `${item.id}.${key}`}
      data-kind={ghost ? undefined : "image"}
      tabIndex={ghost ? undefined : 0}
      aria-label={`Изображение: ${item.title}${key === "image2" ? " · второе" : ""}`}
    >
      <img src={item[key]} alt={item.title} draggable="false" />
    </figure>
  );
  if (item.variant === "compact")
    return (
      <>
        {text("meta", "edge-meta")}
        {text("title", "edge-compact-title")}
        {link("cta", "edge-compact-link")}
      </>
    );

  let sample;
  switch (item.variant) {
    case "tiny":
      sample = (
        <div className="edge-tiny-stage">
          {picture("image", "edge-tiny-image")}
          {text("caption", "edge-sample-caption")}
        </div>
      );
      break;
    case "adjacent":
      sample = (
        <div className="edge-image-pair">
          {picture()}
          {picture("image2")}
        </div>
      );
      break;
    case "links":
      sample = (
        <div className="edge-links-stage">
          <div className="edge-nearby-links">
            {["cta", "cta2", "cta3", "cta4"].map((key) => (
              <div key={key}>{link(key, "edge-sample-link")}</div>
            ))}
          </div>
        </div>
      );
      break;
    case "empty":
      sample = (
        <div className="edge-empty-stage">
          {text("emptyText", "edge-empty-text", "p")}
          {link("cta", "edge-cta")}
        </div>
      );
      break;
    case "short":
    case "long":
      break;
    default:
      sample = item.image ? (
        picture()
      ) : (
        <div className="edge-link-head">{link()}</div>
      );
  }
  return (
    <>
      {sample}
      <div className="edge-copy">
        {text("meta", "edge-meta")}
        {text("title", "edge-title", "h3")}
        {text("description", "edge-description", "p")}
        {(item.variant === "short" || item.variant === "long") && link()}
      </div>
    </>
  );
}

function ItemView({ item, list, onChange, ghost = false }) {
  if (list === "menu")
    return ghost ? (
      <span className="menu-label">{item.title}</span>
    ) : (
      <Editable
        id={`${item.id}.title`}
        value={item.title}
        onChange={(value) => onChange(item.id, "title", value)}
        className="menu-label"
        singleLine
        itemLabel
      />
    );
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
  const ctaClass =
    list === "works"
      ? "card-cta"
      : list === "studies"
        ? "study-cta"
        : listStyles[list].variants
          ? "edge-cta"
          : "event-link";
  const link = (key = "cta", className = ctaClass) =>
    ghost ? (
      <div className={`canvas-link ${className}`}>
        <span>{item[key]}</span>
        <IconArrowUpRight />
      </div>
    ) : (
      <CanvasLink
        id={`${item.id}.${key}`}
        value={item[key]}
        onChange={(value) => onChange(item.id, key, value)}
        className={className}
      />
    );
  const cta = link();
  if (listStyles[list].variants)
    return <EdgeCaseView item={item} ghost={ghost} text={text} link={link} />;
  if (list === "studies")
    return (
      <>
        <figure
          className="study-image"
          data-editor-target={ghost ? undefined : `${item.id}.image`}
          data-kind={ghost ? undefined : "image"}
          tabIndex={ghost ? undefined : 0}
          aria-label={`Изображение: ${item.title}`}
        >
          <img src={item.image} alt={item.title} draggable="false" />
        </figure>
        <div className="study-copy">
          {text("meta", "study-meta")}
          {text("title", "study-title", "h3")}
          {text("description", "study-description", "p")}
          {cta}
        </div>
      </>
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
  const Tag = list === "menu" ? "li" : "article";
  const { handles } = useEditor();
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: count === 1,
    animateLayoutChanges: (args) =>
      args.items.length === args.previousItems.length &&
      defaultAnimateLayoutChanges(args),
  });
  useEffect(() => {
    handles.current.set(item.id, { attributes, listeners });
    return () => handles.current.delete(item.id);
  }, [handles, item.id, attributes, listeners]);
  const styles = { transform: CSS.Transform.toString(transform), transition };
  return (
    <Tag
      ref={setNodeRef}
      style={styles}
      className={`${itemClass(list, item)} ${isDragging ? "sort-source" : ""} ${over === item.id && active !== item.id ? "drop-target" : ""}`}
      data-editor-target={item.id}
      data-kind="item"
      data-list={list}
      data-item={item.id}
      data-image={!!listStyles[list].backgroundImage && !!item.image}
      data-link={!!item.link}
      data-tool-placement={list === "menu" ? "above" : undefined}
      tabIndex={0}
      aria-label={`${listStyles[list].label}: ${item.title}`}
    >
      <ItemView item={item} list={list} onChange={onChange} />
    </Tag>
  );
}
function Repeater({ list, items, onChange, onReorder }) {
  const Container = list === "menu" ? "ul" : "div";
  const { startDrag, stopDrag, pointerPosition } = useEditor(),
    container = useRef(null);
  // A new array on each hover render makes useSortable disable transitions.
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const grabOffset = useRef({ x: 0, y: 0 });
  const dragPoint = useCallback((point) => {
    if (!point || point.y < 66) return point;
    const projected = {
      x: point.x + grabOffset.current.x,
      y: point.y + grabOffset.current.y,
    };
    const r = container.current?.getBoundingClientRect();
    const inside = (p) =>
      r &&
      p.x >= r.left &&
      p.x <= r.right &&
      p.y >= Math.max(66, r.top) &&
      p.y <= r.bottom;
    // Also accept a direct drop on a label: moving up from an external handle
    // must not reject the item just because the projected grip is above it.
    return !inside(projected) && inside(point) ? point : projected;
  }, []);
  const [active, setActive] = useState(null),
    [over, setOver] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const collision = useCallback(
    (args) => {
      const r = container.current?.getBoundingClientRect(),
        p = dragPoint(args.pointerCoordinates);
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
        const underPointer = pointerWithin({ ...args, pointerCoordinates: p });
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
    },
    [dragPoint],
  );
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
      onDragStart={({ active, activatorEvent }) => {
        startDrag(active.id);
        const rect = Array.from(container.current?.children || [])
          .find((node) => node.dataset.item === active.id)
          ?.getBoundingClientRect();
        const { clientX: x, clientY: y } = activatorEvent;
        // A portal handle may sit outside a compact item. Track a point inside
        // the dragged item, preserving that grip offset for collision and drop.
        grabOffset.current = {
          x:
            rect && (x < rect.left || x > rect.right)
              ? rect.left + rect.width / 2 - x
              : 0,
          y:
            rect && (y < rect.top || y > rect.bottom)
              ? rect.top + rect.height / 2 - y
              : 0,
        };
        setActive(active.id);
      }}
      onDragOver={({ over }) => setOver(over?.id || null)}
      onDragCancel={finish}
      onDragEnd={({ active, over, activatorEvent }) => {
        let target = over?.id;
        if (activatorEvent.type === "pointerdown") {
          const point = dragPoint(pointerPosition.current);
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
        items={itemIds}
        strategy={
          list === "exhibitions"
            ? verticalListSortingStrategy
            : rectSortingStrategy
        }
      >
        <Container
          ref={container}
          data-list-container={list}
          className={listStyles[list].container}
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
        </Container>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeItem && (
            <article className={`${itemClass(list, activeItem)} drag-preview`}>
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
  const motion = useCanvasMotion();
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
  const duplicate = (list, id, event) => {
    const added = crypto.randomUUID();
    motion.change(
      () =>
        setLists((previous) => ({
          ...previous,
          [list]: duplicateItem(previous[list], id, added),
        })),
      { source: id, added, keyboard: event?.detail === 0 },
    );
  };
  const remove = (list, id, event) => {
    if (lists[list].length <= 1 || !lists[list].some((item) => item.id === id))
      return;
    motion.change(
      () =>
        setLists((previous) => ({
          ...previous,
          [list]: removeItem(previous[list], id),
        })),
      { source: id, removed: true, keyboard: event?.detail === 0 },
    );
  };
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
      onBeforeDrag={motion.finish}
      onDuplicate={duplicate}
      onRemove={remove}
      counts={{
        menu: lists.menu.length,
        works: lists.works.length,
        studies: lists.studies.length,
        exhibitions: lists.exhibitions.length,
        edges: lists.edges.length,
        edgeSamples: lists.edgeSamples.length,
      }}
    >
      <Topbar />
      <main className="canvas" aria-label="Canvas редактора FORMA">
        <Section id="menu" className="site-menu">
          <nav className="menu-content" aria-label="Меню галереи">
            <figure
              className="menu-logo"
              data-editor-target="menu.logo"
              data-kind="image"
              tabIndex={0}
              aria-label="Логотип галереи FORMA"
            >
              <img src="/assets/forma-logo.svg" alt="FORMA" draggable="false" />
            </figure>
            <Repeater
              list="menu"
              items={lists.menu}
              onChange={changeItem("menu")}
              onReorder={reorder}
            />
            {link("menu.login", "menu-login")}
          </nav>
        </Section>
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
        <Section id="studies" className="studies section-padding">
          <div className="section-heading">
            <div>
              {text("studies.eyebrow", "eyebrow")}
              {text("studies.title", "section-title", "h2")}
            </div>
            {text("studies.description", "section-intro", "p")}
          </div>
          <Repeater
            list="studies"
            items={lists.studies}
            onChange={changeItem("studies")}
            onReorder={reorder}
          />
        </Section>
        <Section id="edges" className="edge-cases section-padding">
          <div className="section-heading">
            <div>
              {text("edges.eyebrow", "eyebrow")}
              {text("edges.title", "section-title", "h2")}
            </div>
            {text("edges.description", "section-intro", "p")}
          </div>
          <Repeater
            list="edges"
            items={lists.edges}
            onChange={changeItem("edges")}
            onReorder={reorder}
          />
          <Repeater
            list="edgeSamples"
            items={lists.edgeSamples}
            onChange={changeItem("edgeSamples")}
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
            <IconArrowUpRight className="program-mark" aria-hidden="true" />
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
