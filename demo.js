/**
 * Демо-версия приложения внутри витрины.
 *
 * Это уменьшенная копия интерфейса «Манты №1» с настоящим меню и фотографиями
 * кафе: она работает целиком в браузере, без сервера. Путь заказа и правила
 * смены статусов повторяют боевые — PENDING → ACCEPTED → PREPARING → READY →
 * COMPLETED, без пропусков и возвратов.
 */
(() => {
  const money = (n) => `${n.toLocaleString("ru-RU")} ₽`;
  const el = (id) => document.getElementById(id);

  const STATUS = {
    PENDING: { label: "Ожидает подтверждения", short: "Новый", action: "Принять", next: "ACCEPTED" },
    ACCEPTED: { label: "Заказ принят", short: "Принят", action: "Начать готовить", next: "PREPARING" },
    PREPARING: { label: "Готовится", short: "Готовится", action: "Готово", next: "READY" },
    READY: { label: "Готов", short: "Готов", action: "Завершить", next: "COMPLETED" },
    COMPLETED: { label: "Завершён", short: "Завершён", action: null, next: null },
  };
  const PATH = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

  const ICONS = {
    menu: '<path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2"/><path d="M5 11v11"/><path d="M15 2v20"/><path d="M15 9c0-4 2-7 4-7v7"/>',
    orders: '<path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2Z"/><path d="M8 8h8"/><path d="M8 12h6"/>',
    cart: '<path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4Z"/><path d="M4 6h16"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M22 20H2"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
  };

  // Час пик уже прошёл: в панели лежит один новый заказ и один в работе.
  const now = new Date();
  const minutesAgo = (m) => new Date(now.getTime() - m * 60_000);
  const clock = (d) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const state = {
    role: "guest",
    screen: "menu",
    category: null,
    cart: [],
    sheet: null,
    orders: [
      {
        number: 1007, name: "Алина", phone: "+7 950 671-25-88", comment: "Без острого",
        items: [{ name: "Плов", detail: null, qty: 2, sum: 800 }], total: 800,
        status: "PREPARING", at: minutesAgo(18), mine: false,
      },
      {
        number: 1008, name: "Сергей", phone: "+7 900 351-19-47", comment: null,
        items: [{ name: "Лагман жареный", detail: null, qty: 1, sum: 400 },
                { name: "Американо", detail: "300 мл", qty: 1, sum: 145 }],
        total: 545, status: "PENDING", at: minutesAgo(4), mine: false,
      },
    ],
    done: 6,
    revenue: 3120,
    viewing: null,
    ownerScreen: "queue",
    next: 1009,
  };

  let menu = null;
  const app = el("app");

  /* ── Мелкие помощники разметки ─────────────────────────────────────────── */
  const variantLabel = (v) =>
    v.name ?? [v.volumeMl && `${v.volumeMl} мл`, v.pieces && `${v.pieces} шт`, v.weightGrams && `${v.weightGrams} г`]
      .filter(Boolean).join(" · ");
  const productSub = (p) => variantLabel(p.variants[0]) || "";
  const fromPrice = (p) => Math.min(...p.variants.map((v) => v.price));

  function toast(text) {
    const box = el("app-toast");
    box.textContent = text;
    box.classList.add("on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove("on"), 2200);
  }

  const cartTotal = () => state.cart.reduce((sum, line) => sum + line.unit * line.qty, 0);
  const cartCount = () => state.cart.reduce((n, line) => n + line.qty, 0);

  /* ── Экраны гостя ──────────────────────────────────────────────────────── */
  function screenMenu() {
    const category = menu.categories.find((c) => c.slug === state.category) ?? menu.categories[0];
    return `
      <div class="app-top">
        <h3>${menu.cafe.name}</h3>
        <div class="where">${menu.cafe.location} · самовывоз</div>
      </div>
      <div class="app-body">
        <div class="chips" role="tablist">
          ${menu.categories.map((c) => `
            <button class="chip" role="tab" aria-selected="${c.slug === category.slug}" data-cat="${c.slug}">${c.name}</button>
          `).join("")}
        </div>
        <div class="cards">
          ${category.products.map((p) => `
            <button class="card" data-open="${p.slug}">
              <img src="${p.image}" alt="${p.name}" loading="lazy">
              <span class="meta">
                <span class="nm">${p.name}</span>
                <span class="sub">${productSub(p)}</span>
                <span class="buy">
                  <span class="pr">${p.variants.length > 1 ? "от " : ""}${money(fromPrice(p))}</span>
                  <span class="plus">+</span>
                </span>
              </span>
            </button>
          `).join("")}
        </div>
      </div>`;
  }

  function screenCart() {
    if (state.cart.length === 0) {
      return `
        ${topBar("Корзина", "menu")}
        <div class="app-body"><p class="empty">Пока пусто. Вернитесь в меню и выберите блюдо.</p></div>`;
    }
    return `
      ${topBar("Корзина", "menu")}
      <div class="app-body">
        <div class="block">
          ${state.cart.map((line, i) => `
            <div class="line">
              <img src="${line.image}" alt="">
              <div>
                <div class="nm">${line.name}</div>
                ${line.detail ? `<div class="sub">${line.detail}</div>` : ""}
                <div class="count" style="margin-top:6px">
                  <button data-qty="${i}" data-step="-1" aria-label="Меньше">−</button>
                  <span>${line.qty}</span>
                  <button data-qty="${i}" data-step="1" aria-label="Больше">+</button>
                </div>
              </div>
              <div class="pr">${money(line.unit * line.qty)}</div>
            </div>
          `).join("")}
          <div class="total"><span>Итого</span><b>${money(cartTotal())}</b></div>
        </div>
      </div>
      <div class="app-cta"><button class="big" data-go="checkout">Оформить · ${money(cartTotal())}</button></div>`;
  }

  function screenCheckout() {
    return `
      ${topBar("Оформление", "cart")}
      <div class="app-body">
        <div class="block">
          <div class="field"><label for="d-name">Имя</label><input id="d-name" value="Гость" autocomplete="off"></div>
          <div class="field"><label for="d-phone">Телефон</label><input id="d-phone" value="+7 900 555-12-34" autocomplete="off"></div>
          <div class="field" style="margin-bottom:0"><label for="d-comment">Комментарий</label>
            <textarea id="d-comment" rows="2" placeholder="Например: заберу через 20 минут"></textarea></div>
        </div>
        <div class="block">
          <div class="row-between"><span style="color:var(--a-ink-3);font-size:13px">Самовывоз</span></div>
          <div style="margin-top:4px;font-weight:600">${menu.cafe.location}</div>
        </div>
        <div class="block">
          <div class="total" style="border:0;padding:0;margin:0"><span>К оплате</span><b>${money(cartTotal())}</b></div>
          <div style="margin-top:6px;font-size:12px;color:var(--a-ink-3)">Оплата при получении: наличными или переводом по QR</div>
        </div>
      </div>
      <div class="app-cta"><button class="big" data-place="1">Подтвердить заказ · ${money(cartTotal())}</button></div>`;
  }

  function screenOrder() {
    const order = state.orders.find((o) => o.number === state.viewing);
    const reached = PATH.indexOf(order.status);
    return `
      ${topBar(`Заказ №${order.number}`, "orders")}
      <div class="app-body">
        <div class="block">
          <div class="row-between">
            <span style="font-size:13px;color:var(--a-ink-3)">${clock(order.at)}</span>
            <span class="badge-status st-${order.status}">${STATUS[order.status].label}</span>
          </div>
          <div class="track-list">
            ${PATH.map((s, i) => `
              <div class="track-row ${i < reached ? "done" : ""} ${i === reached ? "now" : ""}">
                <i class="pip"></i><span>${STATUS[s].label}</span>
              </div>`).join("")}
          </div>
          <div class="hint">Статус обновляется сам</div>
        </div>
        <div class="block">
          ${order.items.map((it) => `
            <div class="line" style="align-items:center">
              <div><div class="nm">${it.qty}× ${it.name}</div>${it.detail ? `<div class="sub">${it.detail}</div>` : ""}</div>
              <div class="pr">${money(it.sum)}</div>
            </div>`).join("")}
          <div class="total"><span>Итого</span><b>${money(order.total)}</b></div>
        </div>
      </div>
      <div class="app-cta"><button class="big ghost" data-role-switch="owner">Посмотреть глазами владельца</button></div>`;
  }

  function screenOrders() {
    const mine = state.orders.filter((o) => o.mine);
    if (mine.length === 0) {
      return `
        ${topBar("Мои заказы", "menu")}
        <div class="app-body"><p class="empty">Здесь появятся ваши заказы. Соберите корзину в меню.</p></div>`;
    }
    return `
      ${topBar("Мои заказы", "menu")}
      <div class="app-body">
        ${mine.map((o) => `
          <button class="block" style="display:block;width:100%;text-align:left" data-view="${o.number}">
            <div class="row-between">
              <span style="font-family:Unbounded,sans-serif;font-weight:500">№${o.number}</span>
              <span class="badge-status st-${o.status}">${STATUS[o.status].label}</span>
            </div>
            <div style="margin-top:6px;font-size:13px;color:var(--a-ink-3)">
              ${o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · ${money(o.total)}
            </div>
          </button>`).join("")}
      </div>`;
  }

  const topBar = (title, back) => `
    <div class="app-top">
      <div class="row">
        ${back ? `<button class="app-back" data-go="${back}" aria-label="Назад"><svg viewBox="0 0 24 24">${ICONS.back}</svg></button>` : ""}
        <h3>${title}</h3>
      </div>
    </div>`;

  function tabs() {
    const item = (screen, icon, label, badge) => `
      <button class="tab" data-go="${screen}" ${state.screen === screen ? 'aria-current="page"' : ""}>
        <svg viewBox="0 0 24 24">${ICONS[icon]}</svg>${label}
        ${badge ? `<span class="badge">${badge}</span>` : ""}
      </button>`;
    return `<div class="tabs">
      ${item("menu", "menu", "Меню")}
      ${item("cart", "cart", "Корзина", cartCount() || null)}
      ${item("orders", "orders", "Заказы")}
    </div>`;
  }

  /* ── Карточка блюда ────────────────────────────────────────────────────── */
  function sheet() {
    const s = state.sheet;
    if (!s) return `<div class="sheet-back"></div><div class="sheet"></div>`;
    const p = s.product;
    const variant = p.variants[s.variant];
    const addons = (p.options[0]?.values ?? []).slice(0, 4);
    const unit = variant.price + s.addons.reduce((sum, i) => sum + addons[i].price, 0);
    return `
      <div class="sheet-back on" data-close="1"></div>
      <div class="sheet on">
        <img src="${p.image}" alt="">
        <div class="inner">
          <h4>${p.name}</h4>
          <div class="sub">${variantLabel(variant) || ""}</div>
          ${p.variants.length > 1 ? `
            <div class="group"><b>Объём</b>
              ${p.variants.map((v, i) => `
                <div class="opt" role="radio" aria-checked="${i === s.variant}" data-variant="${i}">
                  <i class="mark"></i><span>${variantLabel(v)}</span><span class="price">${money(v.price)}</span>
                </div>`).join("")}
            </div>` : ""}
          ${addons.length ? `
            <div class="group"><b>Добавки</b>
              ${addons.map((a, i) => `
                <div class="opt square" role="checkbox" aria-checked="${s.addons.includes(i)}" data-addon="${i}">
                  <i class="mark"></i><span>${a.name}</span><span class="price">+${money(a.price)}</span>
                </div>`).join("")}
            </div>` : ""}
          <div class="group row-between" style="padding-bottom:14px">
            <b style="text-transform:none;letter-spacing:0;font-size:14px;color:var(--a-ink)">Количество</b>
            <div class="count">
              <button data-sheet-qty="-1" aria-label="Меньше">−</button><span>${s.qty}</span>
              <button data-sheet-qty="1" aria-label="Больше">+</button>
            </div>
          </div>
        </div>
        <div class="app-cta"><button class="big" data-add="1">Добавить · ${money(unit * s.qty)}</button></div>
      </div>`;
  }

  /* ── Панель владельца ──────────────────────────────────────────────────── */
  function screenOwner() {
    const queue = state.orders.filter((o) => o.status !== "COMPLETED");
    const body = state.ownerScreen === "stats" ? ownerStats() : ownerQueue(queue);
    const tab = (key, icon, label) => `
      <button class="tab" data-owner="${key}" ${state.ownerScreen === key ? 'aria-current="page"' : ""}>
        <svg viewBox="0 0 24 24">${ICONS[icon]}</svg>${label}
      </button>`;
    return `
      <div class="app-top">
        <h3>${state.ownerScreen === "stats" ? "Статистика" : "Панель кафе"}</h3>
        <div class="where">Сегодня · в реальном времени</div>
      </div>
      ${body}
      <div class="tabs">
        ${tab("queue", "orders", "Заказы")}
        <button class="tab" data-role-switch="guest"><svg viewBox="0 0 24 24">${ICONS.menu}</svg>Взгляд гостя</button>
        ${tab("stats", "stats", "Статистика")}
      </div>`;
  }

  function ownerQueue(queue) {
    return `
      <div class="app-body">
        <div class="kpis">
          <div class="kpi"><span>Заказы</span><b>${state.done + state.orders.length}</b></div>
          <div class="kpi"><span>Оборот</span><b>${money(revenue())}</b></div>
          <div class="kpi"><span>В работе</span><b>${queue.length}</b></div>
        </div>
        ${queue.length === 0 ? '<p class="empty">Очередь пуста — все заказы закрыты.</p>' : ""}
        ${queue.map((o) => `
          <div class="order-card ${o.status === "PENDING" ? "fresh" : ""}">
            <div class="head">
              <span class="num">#${o.number}</span>
              <span class="time">${clock(o.at)}</span>
              <span class="badge-status st-${o.status}" style="margin-left:auto">${STATUS[o.status].label}</span>
            </div>
            <div class="who">${o.name} · ${o.phone}</div>
            <div class="items">
              ${o.items.map((i) => `<span>${i.qty}× ${i.name}${i.detail ? ` · ${i.detail}` : ""}</span>`).join("")}
              ${o.comment ? `<span style="color:var(--a-saffron)">${o.comment}</span>` : ""}
            </div>
            <div class="foot">
              <span class="pr">${money(o.total)}</span>
              ${STATUS[o.status].action ? `<button class="act" data-advance="${o.number}">${STATUS[o.status].action}</button>` : ""}
            </div>
          </div>`).join("")}
      </div>`;
  }

  /** Сводка за день: то же, что видит владелец в настоящей панели. */
  function ownerStats() {
    const count = state.done + state.orders.length;
    const average = Math.round(revenue() / count);
    const popular = new Map();
    for (const order of state.orders) {
      for (const item of order.items) popular.set(item.name, (popular.get(item.name) ?? 0) + item.qty);
    }
    const top = [...popular.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const most = top[0]?.[1] ?? 1;
    return `
      <div class="app-body">
        <div class="kpis">
          <div class="kpi"><span>Заказы</span><b>${count}</b></div>
          <div class="kpi"><span>Оборот</span><b>${money(revenue())}</b></div>
          <div class="kpi"><span>Средний чек</span><b>${money(average)}</b></div>
        </div>
        <div class="block">
          <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--a-ink-3);font-weight:600">
            Чаще всего заказывают
          </div>
          <div style="display:grid;gap:10px;margin-top:12px">
            ${top.map(([name, qty]) => `
              <div>
                <div class="row-between" style="font-size:13.5px"><span>${name}</span><b>${qty}</b></div>
                <div style="height:6px;border-radius:3px;background:var(--a-surface-2);margin-top:4px">
                  <div style="height:100%;width:${Math.round((qty / most) * 100)}%;border-radius:3px;background:var(--a-cobalt)"></div>
                </div>
              </div>`).join("")}
          </div>
        </div>
      </div>`;
  }

  const revenue = () => state.revenue + state.orders.reduce((sum, o) => sum + o.total, 0);

  /* ── Сборка экрана ─────────────────────────────────────────────────────── */
  function render() {
    if (!menu) return;
    let html;
    if (state.role === "owner") {
      html = screenOwner();
    } else {
      const body =
        state.screen === "cart" ? screenCart()
        : state.screen === "checkout" ? screenCheckout()
        : state.screen === "order" ? screenOrder()
        : state.screen === "orders" ? screenOrders()
        : screenMenu();
      const withTabs = ["menu", "orders"].includes(state.screen);
      html = body + (withTabs ? tabs() : "") + sheet();
    }
    app.innerHTML = `<div class="toast" id="app-toast"></div>` + html;
  }

  /* ── Действия ──────────────────────────────────────────────────────────── */
  function addToCart() {
    const s = state.sheet;
    const p = s.product;
    const variant = p.variants[s.variant];
    const addons = (p.options[0]?.values ?? []).slice(0, 4);
    const chosen = s.addons.map((i) => addons[i]);
    const detail = [variantLabel(variant), ...chosen.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ");
    const unit = variant.price + chosen.reduce((sum, a) => sum + a.price, 0);
    const key = `${p.slug}|${s.variant}|${s.addons.join(",")}`;
    const line = state.cart.find((l) => l.key === key);
    if (line) line.qty += s.qty;
    else state.cart.push({ key, name: p.name, detail: detail || null, image: p.image, unit, qty: s.qty });
    state.sheet = null;
    render();
    toast(`«${p.name}» в корзине`);
  }

  function placeOrder() {
    const name = el("d-name").value.trim() || "Гость";
    const phone = el("d-phone").value.trim() || "+7 900 555-12-34";
    const comment = el("d-comment").value.trim() || null;
    const order = {
      number: state.next++,
      name, phone, comment,
      items: state.cart.map((l) => ({ name: l.name, detail: l.detail, qty: l.qty, sum: l.unit * l.qty })),
      total: cartTotal(),
      status: "PENDING",
      at: new Date(),
      mine: true,
    };
    state.orders.unshift(order);
    state.cart = [];
    state.viewing = order.number;
    state.screen = "order";
    render();
    toast(`Заказ №${order.number} принят кафе`);
  }

  function advance(number) {
    const order = state.orders.find((o) => o.number === number);
    const next = STATUS[order.status].next;
    if (!next) return;
    order.status = next;
    render();
    toast(order.mine ? `Гость уже видит статус «${STATUS[next].label}»` : `Заказ №${number}: ${STATUS[next].label}`);
  }

  function setRole(role) {
    state.role = role;
    for (const button of document.querySelectorAll(".switch button")) {
      button.setAttribute("aria-pressed", String(button.dataset.role === role));
    }
    render();
  }

  /* ── Один обработчик на всё приложение ─────────────────────────────────── */
  app.addEventListener("click", (event) => {
    // dataset хранит имя в camelCase, а в разметке оно через дефис:
    // без перевода селектор [data-sheetQty] не нашёл бы data-sheet-qty.
    const hit = (attr) => {
      const attribute = attr.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return event.target.closest(`[data-${attribute}]`)?.dataset[attr];
    };

    const cat = hit("cat");
    if (cat) { state.category = cat; return render(); }

    const open = hit("open");
    if (open) {
      const product = menu.categories.flatMap((c) => c.products).find((p) => p.slug === open);
      state.sheet = { product, variant: 0, addons: [], qty: 1 };
      return render();
    }

    if (hit("close")) { state.sheet = null; return render(); }

    const variant = hit("variant");
    if (variant !== undefined) { state.sheet.variant = Number(variant); return render(); }

    const addon = hit("addon");
    if (addon !== undefined) {
      const i = Number(addon);
      const chosen = state.sheet.addons;
      state.sheet.addons = chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i];
      return render();
    }

    const sheetQty = hit("sheetQty");
    if (sheetQty) { state.sheet.qty = Math.max(1, state.sheet.qty + Number(sheetQty)); return render(); }

    if (hit("add")) return addToCart();

    const qty = hit("qty");
    if (qty !== undefined) {
      const line = state.cart[Number(qty)];
      line.qty += Number(event.target.closest("[data-step]").dataset.step);
      if (line.qty <= 0) state.cart.splice(Number(qty), 1);
      return render();
    }

    const go = hit("go");
    if (go) { state.screen = go; return render(); }

    if (hit("place")) return placeOrder();

    const view = hit("view");
    if (view) { state.viewing = Number(view); state.screen = "order"; return render(); }

    const advanceNumber = hit("advance");
    if (advanceNumber) return advance(Number(advanceNumber));

    const ownerTab = hit("owner");
    if (ownerTab) { state.ownerScreen = ownerTab; return render(); }

    const role = hit("roleSwitch");
    if (role) return setRole(role);
  });

  for (const button of document.querySelectorAll(".switch button")) {
    button.addEventListener("click", () => setRole(button.dataset.role));
  }

  fetch("media/menu.json")
    .then((r) => r.json())
    .then((data) => {
      menu = data;
      state.category = data.categories[0].slug;
      render();
    })
    .catch(() => {
      app.innerHTML = '<p class="empty">Не удалось загрузить меню демо-версии.</p>';
    });
})();
