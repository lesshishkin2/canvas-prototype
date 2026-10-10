export const initialContent = {
  "hero.brand": "FORMA",
  "hero.note": "НЕЗАВИСИМАЯ ГАЛЕРЕЯ · МОСКВА",
  "hero.eyebrow": "ИСКУССТВО БЫТЬ ЗДЕСЬ",
  "hero.title": "Новый взгляд\nна привычное.",
  "hero.description":
    "Искусство, которое меняет пространство.\nИ пространство, которое меняет нас.",
  "hero.cta": "Открыть коллекцию",
  "hero.bottom": "ЖИВОПИСЬ / ОБЪЕКТЫ / НОВЫЕ ИМЕНА",
  "collection.eyebrow": "01 / ИЗБРАННОЕ",
  "collection.title": "Вне очевидного.",
  "collection.description": "Шесть работ. Шесть способов\nувидеть мир иначе.",
  "studies.eyebrow": "02 / ДЕТАЛИ КОЛЛЕКЦИИ",
  "studies.title": "Рассмотреть ближе.",
  "studies.description": "Цвет, линия, фактура.\nУ каждой работы свой язык.",
  "edges.eyebrow": "UX / ПРОВЕРКА ГРАНИЦ",
  "edges.title": "Когда места мало.",
  "edges.description":
    "Наведите на изображения и ссылку.\nПанели уступают место друг другу.",
  "about.eyebrow": "03 / О ГАЛЕРЕЕ",
  "about.title": "Место для\nдругого взгляда.",
  "about.description":
    "Мы верим, что искусство начинается с любопытства. FORMA объединяет художников, коллекционеров и тех, кто просто хочет остановиться и посмотреть внимательнее.",
  "about.description2":
    "Здесь нет правильного способа чувствовать. Есть цвет, форма, тишина — и ваша собственная история.",
  "about.link": "Познакомиться с галереей",
  "about.caption": "ПРОСТРАНСТВО ДЛЯ ДИАЛОГА",
  "exhibitions.eyebrow": "04 / ПРОГРАММА",
  "exhibitions.title": "Встречаемся\nв пространстве.",
  "invite.eyebrow": "ПРОДОЛЖИМ РАЗГОВОР",
  "invite.title": "Искусство ближе,\nчем кажется.",
  "invite.description": "Приходите за вдохновением. Оставайтесь ради открытий.",
  "invite.cta": "Спланировать визит",
  "invite.brand": "FORMA",
  "invite.footer": "МОСКВА · СР–ВС, 12:00–20:00",
};

export const initialLists = {
  menu: [
    { id: "menu-1", title: "Коллекция", link: true },
    { id: "menu-2", title: "О галерее", link: true },
    { id: "menu-3", title: "Выставки", link: true },
    { id: "menu-4", title: "Спланировать визит", link: true },
    { id: "menu-5", title: "Контакты", link: true },
  ],
  works: [
    {
      id: "work-1",
      image: "/assets/art/hero.jpg",
      position: "50% 40%",
      link: true,
      title: "Тихое присутствие",
      meta: "Мария Ветрова · Живопись, 2026",
      cta: "О работе",
    },
    {
      id: "work-2",
      image: "/assets/art/abstract.jpg",
      position: "center",
      link: true,
      title: "Слои памяти",
      meta: "Александр Ли · Акрил, 2025",
      cta: "Рассмотреть",
    },
    {
      id: "work-3",
      image: "/assets/art/landscape.jpg",
      position: "center",
      link: true,
      title: "За пределами",
      meta: "Анна Белая · Смешанная техника, 2026",
      cta: "О работе",
    },
    {
      id: "work-4",
      image: "/assets/art/drawing.jpg",
      position: "center",
      link: true,
      title: "Линия горизонта",
      meta: "Никита Орлов · Графика, 2025",
      cta: "Рассмотреть",
    },
    {
      id: "work-5",
      image: "/assets/art/color.jpg",
      position: "center",
      link: true,
      title: "Внутренний свет",
      meta: "Елена Ким · Живопись, 2026",
      cta: "О работе",
    },
    {
      id: "work-6",
      image: "/assets/art/interior.jpg",
      position: "center",
      link: true,
      title: "Время между",
      meta: "Павел Мир · Холст, масло, 2025",
      cta: "Рассмотреть",
    },
  ],
  studies: [
    {
      id: "study-1",
      cta: "Подробнее",
      image: "/assets/art/abstract.jpg",
      meta: "01 / ЦВЕТ",
      title: "Чувствовать цвет",
      description:
        "Оттенки встречаются, спорят и находят равновесие. Абстракция как пространство для собственных ассоциаций.",
    },
    {
      id: "study-2",
      cta: "Подробнее",
      image: "/assets/art/drawing.jpg",
      meta: "02 / ЛИНИЯ",
      title: "След движения",
      description:
        "Один жест меняет всё. Наблюдаем, как из простых линий рождаются ритм, глубина и новая история.",
    },
    {
      id: "study-3",
      cta: "Подробнее",
      image: "/assets/art/landscape.jpg",
      meta: "03 / ПРОСТРАНСТВО",
      title: "За горизонтом",
      description:
        "Место, которое хочется запомнить. Свет и воздух становятся такими же важными, как сама форма.",
    },
  ],
  exhibitions: [
    {
      id: "event-1",
      link: true,
      date: "10.10 — 22.11",
      type: "ВЫСТАВКА",
      title: "Всё, что остаётся",
      description: "О памяти, следах и повседневной красоте.",
      cta: "Подробнее",
    },
    {
      id: "event-2",
      link: true,
      date: "24.10 / 19:00",
      type: "ВСТРЕЧА С ХУДОЖНИКОМ",
      title: "Разговор о цвете",
      description: "Мария Ветрова — о поиске собственного языка.",
      cta: "Подробнее",
    },
    {
      id: "event-3",
      link: true,
      date: "07.11 / 14:00",
      type: "МЕДИАЦИЯ",
      title: "Смотреть медленнее",
      description: "Неспешная прогулка по новой экспозиции.",
      cta: "Подробнее",
    },
  ],
  edges: [
    {
      id: "edge-wide",
      variant: "wide",
      image: "/assets/art/color.jpg",
      meta: "01 / СВОБОДНОЕ МЕСТО",
      title: "У каждого свой центр.",
      description:
        "У широкой картинки инструменты по центру. Действия карточки остаются справа — обе панели помещаются на одной высоте.",
    },
    {
      id: "edge-narrow",
      variant: "narrow",
      image: "/assets/art/abstract.jpg",
      meta: "02 / БЕЗ ПОЛЕЙ",
      title: "Ближе к краю.",
      description:
        "Узкая карточка, нулевой отступ. Панель картинки опускается под действия карточки.",
    },
    {
      id: "edge-link",
      variant: "link",
      cta: "Открыть",
      meta: "03 / ССЫЛКА У КРАЯ",
      title: "Место для действия.",
      description:
        "Ссылка рядом с общими инструментами. Её панель уходит ниже, сохраняя доступ и к действиям карточки, и к тексту ссылки.",
    },
  ],
};

export function duplicateItem(items, id, newId) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const copy = { ...items[index], id: newId };
  return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
}
export function removeItem(items, id) {
  return items.length > 1 ? items.filter((item) => item.id !== id) : items;
}
export function reorderItems(items, activeId, overId) {
  const from = items.findIndex((item) => item.id === activeId),
    to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
