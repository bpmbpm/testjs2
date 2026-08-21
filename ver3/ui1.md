# Концепция «UI-base»: верхнеуровневый диспетчер пользовательских событий

## 1. Концептуальная модель

Идея «UI-base» — это **единая точка входа** для всех пользовательских взаимодействий, где каждое событие проходит через несколько уровней классификации:

```
Событие от пользователя
        │
        ▼
┌───────────────────────────────┐
│ Уровень 1: ОКНО               │  diagram | filelist | (properties — вне UI-base)
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Уровень 2: ДЕЙСТВИЕ           │  click | dblclick | contextmenu
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Уровень 3: ТИП ЭЛЕМЕНТА       │  rect | circle | path | g | file-item | ...
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Уровень 4: ПРЕДПИСАННОЕ       │  подсветить + вызвать функцию(id)
│ ДЕЙСТВИЕ                      │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ ЛОГИРОВАНИЕ с тегом «UI-base» │
└───────────────────────────────┘
```

**Ключевые принципы:**
- `properties` — **вне** UI-base (это «пассивная» панель, только отображение).
- `diagram` и `filelist` — **внутри** UI-base (активные панели).
- Каждое обработанное событие логируется с тегом `[UI-base]`.
- Правила «что делать при клике на rect» задаются **заранее**, а не прописываются в каждом обработчике.

---

## 2. Варианты реализации

### Вариант A: Централизованный диспетчер с `data-`-атрибутами

**Идея:** Элементы в DOM размечаются атрибутами `data-ui-window`, `data-ui-type`. Один глобальный обработчик на `document` ловит все события, определяет окно/действие/тип и маршрутизирует.

**Пример разметки:**
```html
<li data-ui-window="filelist" data-ui-type="file-item" data-id="file1.svg">...</li>
<rect data-ui-window="diagram" data-ui-type="rect" data-id="shape123" .../>
```

**Код диспетчера:**
```javascript
const UI_BASE = {
    // Карта правил: {окно: {действие: {тип: обработчик}}}
    rules: {
        filelist: {
            click: {
                'file-item': (el) => {
                    const id = el.dataset.id;
                    EVENTS.handleFileListItemClick(id);
                }
            }
        },
        diagram: {
            click: {
                'rect': (el) => { UI_BASE.highlight(el); UI_BASE.callAction('rect.clicked', el.dataset.id); },
                'circle': (el) => { UI_BASE.highlight(el); UI_BASE.callAction('circle.clicked', el.dataset.id); },
                'path': (el) => { UI_BASE.highlight(el); UI_BASE.callAction('path.clicked', el.dataset.id); }
            },
            dblclick: {
                'rect': (el) => { UI_BASE.callAction('rect.opened', el.dataset.id); }
            },
            contextmenu: {
                'rect': (el) => { e.preventDefault(); UI_BASE.callAction('rect.menu', el.dataset.id); }
            }
        }
    },

    init: function() {
        document.addEventListener('click', this.dispatch.bind(this));
        document.addEventListener('dblclick', this.dispatch.bind(this));
        document.addEventListener('contextmenu', this.dispatch.bind(this));
    },

    dispatch: function(e) {
        const target = e.target.closest('[data-ui-window]');
        if (!target) return; // элемент не в UI-base

        const window = target.dataset.uiWindow;
        const type = target.dataset.uiType;
        const action = e.type; // 'click', 'dblclick', 'contextmenu'

        // Лог с тегом UI-base
        UTILS.log('UI-base', `${window}.${action}.${type}`, 
                  `Событие на элементе`, 
                  { window, action, type, id: target.dataset.id });

        // Маршрутизация
        const handler = this.rules[window]?.[action]?.[type];
        if (handler) {
            handler(target);
        } else {
            UTILS.log('UI-base', 'no-rule', 'Нет правила для комбинации', { window, action, type });
        }
    },

    highlight: function(el) {
        document.querySelectorAll('.ui-highlighted').forEach(e => e.classList.remove('ui-highlighted'));
        el.classList.add('ui-highlighted');
    },

    callAction: function(actionName, id) {
        UTILS.log('UI-base', 'callAction', `Вызов бизнес-действия`, { action: actionName, id });
        // Здесь можно вызвать нужную функцию из STATE/DATA/RENDER
    }
};
```

**Плюсы:**
- Единая точка входа — легко отлаживать.
- Новые правила добавляются в одну карту `rules`.
- Разметка в HTML явно показывает, что элемент управляется UI-base.

**Минусы:**
- Нужно размечать все элементы `data-`-атрибутами (в т.ч. динамически создаваемые в SVG).
- SVG-элементы не всегда удобно размечать (они приходят с сервера).

---

### Вариант B: Декларативная карта событий (Event Map) без `data-`-атрибутов

**Идея:** Правила задаются как объект, где ключи — это CSS-селекторы + тип события. Диспетчер перебирает правила и проверяет, попадает ли `target` под селектор.

**Код:**
```javascript
const UI_BASE = {
    // Ключ: "окно|событие|селектор"
    rules: {
        'filelist|click|.file-item': {
            handler: (el) => EVENTS.handleFileListItemClick(el.dataset.url),
            logTag: 'filelist.click.file-item'
        },
        'diagram|click|rect': {
            handler: (el) => {
                UI_BASE.highlight(el);
                BUSINESS.onShapeClicked('rect', el.id);
            },
            logTag: 'diagram.click.rect'
        },
        'diagram|dblclick|rect': {
            handler: (el) => BUSINESS.onShapeOpened(el.id),
            logTag: 'diagram.dblclick.rect'
        },
        'diagram|contextmenu|rect': {
            handler: (el, e) => {
                e.preventDefault();
                BUSINESS.onShapeContextMenu(el.id);
            },
            logTag: 'diagram.contextmenu.rect'
        }
    },

    init: function() {
        ['click', 'dblclick', 'contextmenu'].forEach(evt => {
            document.addEventListener(evt, this.dispatch.bind(this));
        });
    },

    dispatch: function(e) {
        for (const key in this.rules) {
            const [window, action, selector] = key.split('|');
            
            // Проверяем, что клик был внутри нужного окна
            const panel = e.target.closest(`#${window}-content`);
            if (!panel) continue;

            // Проверяем, что target попадает под селектор
            const matched = e.target.closest(selector);
            if (!matched) continue;

            const rule = this.rules[key];
            
            // Лог с тегом UI-base
            UTILS.log('UI-base', rule.logTag, 'Сработало правило', { 
                window, action, selector, id: matched.id || matched.dataset.url 
            });

            rule.handler(matched, e);
            return; // Первое совпадение — обрабатываем и выходим
        }
    },

    highlight: function(el) {
        document.querySelectorAll('.ui-highlighted').forEach(e => e.classList.remove('ui-highlighted'));
        el.classList.add('ui-highlighted');
    }
};
```

**Плюсы:**
- Не нужно размечать SVG-элементы `data-`-атрибутами — используются нативные теги (`rect`, `circle`, `path`) и классы.
- Правила очень читаемы: `'diagram|click|rect'` — сразу понятно.
- Легко добавлять новые правила.

**Минусы:**
- Перебор всех правил при каждом событии (но их обычно мало, это не проблема).
- При конфликте селекторов сработает первое правило (нужен порядок).

---

### Вариант C: Иерархический `switch` (явная вложенность)

**Идея:** Прямая реализация того, что вы описали — вложенные `switch` по окну, действию, типу.

**Код:**
```javascript
const UI_BASE = {
    init: function() {
        document.addEventListener('click', this.onEvent.bind(this));
        document.addEventListener('dblclick', this.onEvent.bind(this));
        document.addEventListener('contextmenu', this.onEvent.bind(this));
    },

    onEvent: function(e) {
        // Уровень 1: Окно
        const window = this.detectWindow(e.target);
        if (!window) return; // не в UI-base

        const action = e.type;
        const elementType = this.detectType(e.target, window);

        // Лог
        UTILS.log('UI-base', `${window}.${action}.${elementType}`, 'Событие', { 
            id: e.target.id || e.target.dataset.url 
        });

        // Уровень 2: Действие
        switch (action) {
            case 'click':
                this.handleClick(window, elementType, e.target);
                break;
            case 'dblclick':
                this.handleDblClick(window, elementType, e.target);
                break;
            case 'contextmenu':
                e.preventDefault();
                this.handleContextMenu(window, elementType, e.target);
                break;
        }
    },

    handleClick: function(window, type, el) {
        // Уровень 3: Тип элемента
        switch (window) {
            case 'filelist':
                switch (type) {
                    case 'file-item':
                        EVENTS.handleFileListItemClick(el.dataset.url);
                        break;
                }
                break;
            case 'diagram':
                switch (type) {
                    case 'rect':
                    case 'circle':
                    case 'path':
                        UI_BASE.highlight(el);
                        BUSINESS.onShapeClicked(type, el.id);
                        break;
                }
                break;
        }
    },

    handleDblClick: function(window, type, el) {
        if (window === 'diagram' && (type === 'rect' || type === 'circle')) {
            BUSINESS.onShapeOpened(el.id);
        }
    },

    handleContextMenu: function(window, type, el) {
        if (window === 'diagram') {
            BUSINESS.onShapeContextMenu(el.id);
        }
    },

    detectWindow: function(target) {
        if (target.closest('#filelist-content')) return 'filelist';
        if (target.closest('#diagram-content')) return 'diagram';
        return null; // properties и другие — вне UI-base
    },

    detectType: function(target, window) {
        if (window === 'filelist') return 'file-item';
        if (window === 'diagram') return target.tagName.toLowerCase(); // 'rect', 'circle'...
        return 'unknown';
    },

    highlight: function(el) {
        document.querySelectorAll('.ui-highlighted').forEach(e => e.classList.remove('ui-highlighted'));
        el.classList.add('ui-highlighted');
    }
};
```

**Плюсы:**
- Максимально близко к вашему описанию — легко читать как алгоритм.
- Нет магии — всё явно.
- Хорошо для небольших проектов.

**Минусы:**
- При росте числа правил код разрастается в «лапшу».
- Добавление нового правила требует правки нескольких `switch`.

---

### Вариант D: DSL-конфиг (JSON-описание правил)

**Идея:** Правила описываются в отдельном JSON-файле (или объекте), который интерпретируется движком. Это ближе всего к идее из `design.md`.

**Конфиг `ui-rules.json`:**
```json
{
  "windows": {
    "filelist": { "controlled": true },
    "diagram":  { "controlled": true },
    "properties": { "controlled": false }
  },
  "rules": [
    {
      "window": "filelist",
      "action": "click",
      "selector": ".file-item",
      "logTag": "file.selected",
      "actions": ["log:Выбран файл {url}", "call:EVENTS.handleFileListItemClick({url})"]
    },
    {
      "window": "diagram",
      "action": "click",
      "selector": "rect, circle, path",
      "logTag": "shape.selected",
      "actions": ["highlight", "call:BUSINESS.onShapeClicked({type}, {id})"]
    },
    {
      "window": "diagram",
      "action": "dblclick",
      "selector": "rect, circle",
      "logTag": "shape.opened",
      "actions": ["call:BUSINESS.onShapeOpened({id})"]
    },
    {
      "window": "diagram",
      "action": "contextmenu",
      "selector": "rect, circle, path",
      "logTag": "shape.menu",
      "actions": ["preventDefault", "call:BUSINESS.onShapeContextMenu({id})"]
    }
  ]
}
```

**Движок-интерпретатор:**
```javascript
const UI_BASE = {
    config: null,
    actionHandlers: {
        'highlight': (el) => {
            document.querySelectorAll('.ui-highlighted').forEach(e => e.classList.remove('ui-highlighted'));
            el.classList.add('ui-highlighted');
        },
        'preventDefault': (el, e) => e.preventDefault(),
        'log': (el, e, msg) => UTILS.log('UI-base', 'info', msg),
        'call': (el, e, expr) => {
            // Простой парсер выражений вида "FUNC(arg1, arg2)"
            // с подстановкой {url}, {id}, {type}
            const filled = expr
                .replace('{url}', el.dataset.url || '')
                .replace('{id}', el.id || '')
                .replace('{type}', el.tagName.toLowerCase());
            // eslint-disable-next-line no-eval
            eval(filled); // в продакшене — безопасный парсер
        }
    },

    init: async function() {
        const resp = await fetch('ui-rules.json');
        this.config = await resp.json();
        
        ['click', 'dblclick', 'contextmenu'].forEach(evt => {
            document.addEventListener(evt, this.dispatch.bind(this));
        });
    },

    dispatch: function(e) {
        for (const rule of this.config.rules) {
            const panel = e.target.closest(`#${rule.window}-content`);
            if (!panel) continue;

            const matched = e.target.closest(rule.selector);
            if (!matched || e.type !== rule.action) continue;

            // Лог
            UTILS.log('UI-base', rule.logTag, 'Сработало правило DSL', { 
                window: rule.window, action: rule.action, id: matched.id 
            });

            // Выполнение действий
            for (const actionExpr of rule.actions) {
                const [actionName, ...args] = actionExpr.split(':');
                const handler = this.actionHandlers[actionName];
                if (handler) handler(matched, e, args.join(':'));
            }
            return;
        }
    }
};
```

**Плюсы:**
- **Непрограммист может добавлять правила**, просто редактируя JSON.
- Правила отделены от кода — можно менять без перезаписи JS.
- Легко экспортировать/импортировать конфигурации.

**Минусы:**
- Нужен парсер выражений (или `eval` — небезопасно).
- Сложнее отлаживать — правила «спрятаны» в JSON.
- Ошибки в JSON ломают всё.

---

## 3. Сравнительная таблица

| Критерий | A: `data-`-атрибуты | B: Event Map | C: `switch` | D: DSL-JSON |
|----------|---------------------|--------------|-------------|-------------|
| **Простота добавления правила** | Средняя | Высокая | Низкая | Очень высокая |
| **Читаемость кода** | Средняя | Высокая | Высокая (для малых проектов) | Средняя (нужен движок) |
| **Работа с SVG без разметки** | Плохо | Отлично | Отлично | Отлично |
| **Для непрограммиста** | Нет | Частично | Нет | **Да** |
| **Производительность** | Высокая | Средняя | Высокая | Средняя |
| **Отделяемость правил от кода** | Частично | Частично | Нет | **Полностью** |
| **Совместимость с текущей архитектурой** | Отлично | Отлично | Отлично | Требует BUSINESS-модуль |

---

## 4. Интеграция с текущей архитектурой

Независимо от варианта, в текущую структуру добавляется:

```
UTILS  ──┐
STATE  ──┤
DATA   ──┤
RENDER ──┤
EVENTS ──┤
UI_BASE ─┼── НОВЫЙ модуль-диспетчер
RESIZER ─┤
BUSINESS ┘── НОВЫЙ модуль бизнес-действий (опционально)
```

**Модификация `UTILS.log`:**
Чтобы все события UI-base автоматически помечались, можно добавить обёртку:

```javascript
const UTILS = {
    log: function(groupName, funcName, message, params = {}) {
        // ... существующий код ...
        
        // Авто-пометка для UI-base
        if (groupName === 'UI-base') {
            div.style.borderLeft = '3px solid #ff9800'; // визуальное выделение в логе
        }
    },
    
    // Новый метод специально для UI-base
    logUI: function(tag, message, params = {}) {
        this.log('UI-base', tag, message, params);
    }
};
```

---

## 5. Рекомендация

Для вашего проекта (Vanilla JS, без сборщиков, с прицелом на упрощение для непрограммистов) **оптимальный путь — эволюционный**:

1. **Сейчас (ver3):** начать с **Варианта B (Event Map)** — он не требует изменения HTML, хорошо работает с SVG через CSS-селекторы, и даёт декларативный стиль.

2. **Следующий шаг (ver4):** вынести карту правил в отдельный JSON (**Вариант D**) — это уже DSL, который может редактировать аналитик.

3. **Долгосрочно:** полный переход на DSL из `design.md`, где `ui-rules.json` описывает не только события, но и макет, цвета, бизнес-правила.

Такой подход позволяет **не ломать работающий код**, а постепенно «выносить» логику из JS в конфигурацию, снижая порог входа для непрограммистов.
