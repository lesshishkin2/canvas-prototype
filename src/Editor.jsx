import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Settings,
  Palette,
  Eye,
  Plus,
  Link2,
  Pencil,
  ArrowUpRight,
} from "lucide-react";

const EditorContext = createContext(null);
export const useEditor = () => useContext(EditorContext);
const TOP = 66;
const TOOL_INSET = 8;

export function EditorProvider({ children, onDuplicate, onRemove, counts }) {
  const [active, setActive] = useState(null),
    [editing, setEditing] = useState(null),
    [dragging, setDragging] = useState(null);
  const activeRef = useRef(null),
    editingRef = useRef(null),
    dragRef = useRef(null),
    hideTimer = useRef(null),
    locked = useRef(false),
    lastPoint = useRef(null),
    handlePressed = useRef(false);
  const handles = useRef(new Map());
  const choose = useCallback((target) => {
    activeRef.current = target;
    setActive((old) =>
      old?.id === target?.id && old?.node === target?.node ? old : target,
    );
  }, []);
  const clear = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = null;
    choose(null);
  }, [choose]);
  const suppress = useCallback(() => {
    locked.current = true;
    clear();
  }, [clear]);
  const startEditing = useCallback(
    (id) => {
      editingRef.current = id;
      setEditing(id);
      clear();
    },
    [clear],
  );
  const stopEditing = useCallback(() => {
    editingRef.current = null;
    setEditing(null);
  }, []);
  const startDrag = useCallback((id) => {
    clearTimeout(hideTimer.current);
    hideTimer.current = null;
    dragRef.current = id;
    setDragging(id);
  }, []);
  const stopDrag = useCallback(() => {
    handlePressed.current = false;
    dragRef.current = null;
    setDragging(null);
    suppress();
  }, [suppress]);
  useEffect(() => {
    function resolve(event) {
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
      } else if (event.type === "focusin") locked.current = false;
      if (
        locked.current ||
        editingRef.current ||
        dragRef.current ||
        handlePressed.current
      )
        return;
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("[data-editor-toolbar]")) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
        return;
      }
      const source = element?.closest("[data-editor-target]");
      const previous = activeRef.current;
      const panel = document.querySelector(".floating-tools");
      // Join an inset panel to its owner's top/right edges. This only retains
      // an already open panel; nested targets elsewhere still resolve normally.
      if (
        event.type === "pointermove" &&
        (previous?.kind === "item" || previous?.kind === "image") &&
        previous.placement !== "above" &&
        previous.node.contains(source) &&
        panel?.dataset.owner === previous.id &&
        panel.style.visibility === "visible"
      ) {
        const owner = previous.node.getBoundingClientRect(),
          tools = panel.getBoundingClientRect();
        if (
          event.clientX >= Math.max(owner.left, tools.left) &&
          event.clientX <= Math.min(owner.right, tools.right + TOOL_INSET) &&
          event.clientY >= Math.max(TOP, owner.top, tools.top - TOOL_INSET) &&
          event.clientY <= Math.min(owner.bottom, tools.bottom)
        ) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
          return;
        }
      }
      // A short bridge lets the pointer cross the gap above/below a link.
      if (
        event.type === "pointermove" &&
        (previous?.kind === "link" || previous?.placement === "above") &&
        panel &&
        (!source || source.contains(previous.node))
      ) {
        const a = previous.node.getBoundingClientRect(),
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
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
          return;
        }
      }
      if (!source) {
        if (!hideTimer.current)
          hideTimer.current = setTimeout(() => {
            hideTimer.current = null;
            choose(null);
          }, 180);
        return;
      }
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
      const node =
        source.dataset.kind === "link"
          ? source.closest(".canvas-link") || source
          : source;
      const section = source.closest("[data-section]");
      choose({
        node,
        id: source.dataset.editorTarget,
        kind: source.dataset.kind,
        list: source.dataset.list,
        item: source.dataset.item,
        hasImage: source.dataset.image === "true",
        hasLink: source.dataset.link === "true",
        placement: source.dataset.toolPlacement,
        section: section?.dataset.section,
      });
    }
    function leave() {
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        choose(null);
      }, 180);
    }
    function pointerDown(event) {
      const handle = event.target.closest(".drag-handle");
      if (handle && handle.getAttribute("aria-disabled") !== "true") {
        handlePressed.current = true;
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (editingRef.current && !event.target.closest("[contenteditable]"))
        document.activeElement?.blur();
    }
    function releaseHandle(event) {
      lastPoint.current = { x: event.clientX, y: event.clientY };
      handlePressed.current = false;
    }
    document.addEventListener("pointerup", releaseHandle, true);
    document.addEventListener("pointercancel", releaseHandle, true);
    document.addEventListener("pointermove", resolve);
    document.addEventListener("focusin", resolve);
    document.addEventListener("pointerdown", pointerDown, true);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      clearTimeout(hideTimer.current);
      document.removeEventListener("pointerup", releaseHandle, true);
      document.removeEventListener("pointercancel", releaseHandle, true);
      document.removeEventListener("pointermove", resolve);
      document.removeEventListener("focusin", resolve);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [choose]);
  useEffect(() => {
    document.body.dataset.editorMode = dragging
      ? "dragging"
      : editing
        ? "editing"
        : active
          ? "hover"
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
    if (!editing && !dragging && active?.node)
      active.node.setAttribute("data-target-hover", "true");
    return () => {
      active?.node?.removeAttribute("data-target-hover");
    };
  }, [active, editing, dragging]);
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
    pointerPosition: lastPoint,
  };
  return (
    <EditorContext.Provider value={context}>
      {children}
      {active && !editing && (
        <FloatingTools
          hidden={!!dragging}
          target={active}
          counts={counts}
          onDuplicate={() => {
            onDuplicate(active.list, active.item);
            suppress();
          }}
          onRemove={() => {
            onRemove(active.list, active.item);
            suppress();
          }}
        />
      )}
    </EditorContext.Provider>
  );
}

function AssetIcon({ name }) {
  return (
    <img
      src={`/assets/icons/${["trash", "grip"].includes(name) ? `${name}-active` : name}.svg`}
      alt=""
      draggable="false"
    />
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

function FloatingTools({ target, counts, onDuplicate, onRemove, hidden }) {
  const ref = useRef(null),
    [position, setPosition] = useState(null);
  const { handles } = useEditor();
  const isSection = target.kind === "section";
  useLayoutEffect(() => {
    const update = () => {
      if (!target.node.isConnected) return setPosition(null);
      const r = target.node.getBoundingClientRect(),
        p = ref.current?.getBoundingClientRect();
      if (!p || r.bottom < TOP + 4 || r.top > innerHeight)
        return setPosition(null);
      let left, top;
      if (isSection) {
        left = r.left;
        top = Math.max(TOP, r.top);
        if (top + 40 > r.bottom) return setPosition(null);
      } else if (target.kind === "link" || target.placement === "above") {
        left = r.right - p.width - TOOL_INSET;
        top = r.top - p.height - 7;
        if (top < TOP + 6) top = r.bottom + 7;
      } else {
        left = r.right - p.width - TOOL_INSET;
        top = Math.max(TOP + 6, r.top + TOOL_INSET);
      }
      left = Math.max(8, Math.min(left, innerWidth - p.width - 12));
      top = Math.max(TOP + 4, Math.min(top, innerHeight - p.height - 8));
      setPosition({
        left: isSection ? r.left : left,
        top,
        width: isSection ? r.width : undefined,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(target.node);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [target, isSection]);
  if (target.kind === "text") return null;
  const single = counts[target.list] === 1;
  const h = handles.current.get(target.item);
  const imgTools = (
    <div className="tool-group">
      <ToolButton label="Заменить изображение · демо">
        <AssetIcon name="replace" />
      </ToolButton>
      <ToolButton label="Редактировать изображение · демо">
        <Pencil />
      </ToolButton>
    </div>
  );
  return createPortal(
    <div
      ref={ref}
      data-editor-toolbar="true"
      data-toolbar-kind={target.kind}
      data-owner={target.id}
      className={`floating-tools ${isSection ? "section-tools" : ""}`}
      style={{
        ...position,
        visibility: position && !hidden ? "visible" : "hidden",
        pointerEvents: hidden ? "none" : undefined,
      }}
      role="toolbar"
      aria-label={
        isSection
          ? "Действия секции"
          : target.kind === "item"
            ? "Действия элемента"
            : "Действия объекта"
      }
    >
      {isSection ? (
        <>
          <ToolButton label="Настройки секции · демо">
            <Settings />
          </ToolButton>
          {target.hasImage && (
            <div className="section-background-tools">{imgTools}</div>
          )}
          <div className="section-tools-end">
            <ToolButton label="Секция выше · демо">
              <ChevronUp />
            </ToolButton>
            <ToolButton label="Секция ниже · демо">
              <ChevronDown />
            </ToolButton>
            <ToolButton label="Видимость секции · демо">
              <Eye />
            </ToolButton>
            <ToolButton label="Удалить секцию · демо">
              <AssetIcon name="trash" />
            </ToolButton>
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
                    ? "Редактировать ссылку элемента · демо"
                    : "Редактировать ссылку · демо"
                }
              >
                <Link2 />
              </ToolButton>
            </div>
          )}
          {target.kind === "item" && (
            <>
              <div className="tool-group">
                <ToolButton label="Копировать элемент" onClick={onDuplicate}>
                  <AssetIcon name="copy" />
                </ToolButton>
                <ToolButton
                  label={
                    single
                      ? "Последний элемент нельзя удалить"
                      : "Удалить элемент"
                  }
                  disabled={single}
                  onClick={onRemove}
                >
                  <AssetIcon name="trash" />
                </ToolButton>
              </div>
              <div className="tool-group drag-group">
                <ToolButton
                  {...(!single ? h?.attributes : {})}
                  {...(!single ? h?.listeners : {})}
                  label={
                    single
                      ? "Один элемент — перемещение недоступно"
                      : "Перетащить элемент"
                  }
                  disabled={single}
                  className="tool-button drag-handle"
                  onClick={undefined}
                >
                  <AssetIcon name="grip" />
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
    { startEditing, stopEditing } = useEditor();
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
      data-placeholder="Введите текст"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={
        label || `Редактировать: ${value.slice(0, 45) || "пустой текст"}`
      }
      aria-multiline={!singleLine}
      tabIndex={0}
      spellCheck="false"
      onFocus={() => startEditing(id)}
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
      {arrow && <ArrowUpRight aria-hidden="true" />}
    </div>
  );
}
export function Section({ id, hasImage = false, className = "", children }) {
  return (
    <section
      data-section={id}
      data-editor-target={id}
      data-kind="section"
      data-image={hasImage}
      className={`canvas-section ${className}`}
    >
      <div className="section-divider section-divider-start">
        <button aria-label="Добавить секцию · демо" data-editor-toolbar="true">
          <Plus />
        </button>
      </div>
      {children}
      <div className="section-divider section-divider-end">
        <button aria-label="Добавить секцию · демо" data-editor-toolbar="true">
          <Plus />
        </button>
      </div>
    </section>
  );
}
export function Topbar() {
  return (
    <header className="editor-topbar">
      <div className="topbar-left">
        <button
          className="back-button"
          title="Назад · демо"
          aria-label="Назад · демо"
        >
          <ChevronLeft size={18} />
        </button>
        <button className="page-switch" title="Переключение страниц · демо">
          <span>
            Page: <strong>Main page</strong>
          </span>
          <ChevronDown size={16} />
        </button>
      </div>
      <div className="topbar-right">
        <button
          className="bare-button"
          title="Настройки страницы · демо"
          aria-label="Настройки страницы · демо"
        >
          <Settings size={20} />
        </button>
        <button
          className="bare-button"
          title="Настройки темы · демо"
          aria-label="Настройки темы · демо"
        >
          <Palette size={20} />
        </button>
        <button className="preview-button" title="Предпросмотр · демо">
          <Eye size={19} />
          Preview
        </button>
        <button
          className="save-button"
          title="Демонстрация: изменения не сохраняются"
        >
          Save Changes
        </button>
      </div>
    </header>
  );
}
