/**
 * app.js — SVG Viewer: полный код с логом в одну строку, путями и ресайзером.
 */

const UTILS = {
    log: function(groupName, funcName, message, params = {}) {
        const time = new Date().toLocaleTimeString();
        let extra = '';

        if (params.url) {
            const name = this.getFileNameFromUrl(params.url);
            extra = ` [path: ${name}]`;
        } else if (Object.keys(params).length > 0) {
            // компактный JSON без пробелов
            extra = ' ' + JSON.stringify(params).replace(/\s+/g, ' ');
        }

        const line = `[${time}] [${groupName}] ${funcName}: ${message}${extra}`;
        console.log(line);

        const el = document.getElementById('log-content');
        if (!el) return;

        const div = document.createElement('div');
        div.className = 'log-line';
        div.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-group">${groupName}</span>
            <span class="log-func">${funcName}</span>:
            ${message}
            ${extra ? '<span style="color:#aaa;">' + extra + '</span>' : ''}
        `;
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
    },

    text: function(str) {
        return str ? String(str).trim() : '';
    },

    getFileNameFromUrl: function(url) {
        try {
            const path = new URL(url).pathname;
            return path.substring(path.lastIndexOf('/') + 1);
        } catch (e) {
            return url;
        }
    }
};

const STATE = {
    appState: {
        fileList: [],
        selectedFile: null,
        svgDoc: null,
        shapes: []
    },

    initFromConfig: function() {
        UTILS.log('STATE', 'initFromConfig', 'Инициализация состояния из config.js');
        const raw = window.svgFileList || [];
        this.appState.fileList = raw.filter(u => u && typeof u === 'string' && u.trim().length > 0);
        UTILS.log('STATE', 'initFromConfig', 'Список файлов загружен', { count: this.appState.fileList.length });
    },

    isValid: function() {
        return !!this.appState.selectedFile;
    },

    setSelectedFile: function(fileUrl) {
        UTILS.log('STATE', 'setSelectedFile', 'Установка выбранного файла', { url: fileUrl });
        this.appState.selectedFile = fileUrl;
        this.appState.svgDoc = null;
        this.appState.shapes = [];
    },

    clearSelection: function() {
        UTILS.log('STATE', 'clearSelection', 'Очистка выбора');
        this.setSelectedFile(null);
    }
};

const DATA = {
    loadSvg: async function(url) {
        UTILS.log('DATA', 'loadSvg', 'Начало загрузки SVG', { url });
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const text = await r.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');
            if (!svgEl) throw new Error('Нет корневого <svg>');
            UTILS.log('DATA', 'loadSvg', 'SVG успешно загружен и распарсен', { url });
            return doc;
        } catch (err) {
            UTILS.log('DATA', 'loadSvg', 'Ошибка загрузки SVG', { error: err.message, url });
            throw err;
        }
    },

    analyzeShapes: function(doc) {
        UTILS.log('DATA', 'analyzeShapes', 'Анализ фигур в SVG');
        const shapes = [];
        const svg = doc.querySelector('svg');
        if (!svg) return shapes;

        const tags = ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'g'];
        doc.querySelectorAll('*').forEach(el => {
            const t = el.tagName.toLowerCase();
            if (tags.includes(t)) {
                shapes.push({
                    type: t,
                    id: UTILS.text(el.id),
                    class: UTILS.text(el.getAttribute('class')),
                    cx: UTILS.text(el.getAttribute('cx')),
                    cy: UTILS.text(el.getAttribute('cy')),
                    r: UTILS.text(el.getAttribute('r')),
                    x: UTILS.text(el.getAttribute('x')),
                    y: UTILS.text(el.getAttribute('y')),
                    width: UTILS.text(el.getAttribute('width')),
                    height: UTILS.text(el.getAttribute('height')),
                    d: UTILS.text(el.getAttribute('d'))
                });
            }
        });
        UTILS.log('DATA', 'analyzeShapes', 'Анализ завершён', { count: shapes.length });
        return shapes;
    }
};

const RENDER = {
    renderFileList: function() {
        UTILS.log('RENDER', 'renderFileList', 'Отрисовка filelist');
        const c = document.getElementById('filelist-content');
        if (!c) return;
        const list = STATE.appState.fileList;
        if (list.length === 0) {
            c.innerHTML = '<p style="padding:12px; color:#666;">Список файлов пуст</p>';
            return;
        }
        const ul = document.createElement('ul');
        list.forEach((url, i) => {
            const li = document.createElement('li');
            li.textContent = UTILS.getFileNameFromUrl(url);
            li.dataset.index = i;
            li.dataset.url = url;
            if (STATE.appState.selectedFile === url) li.classList.add('selected');
            li.addEventListener('click', () => EVENTS.handleFileListItemClick(url));
            ul.appendChild(li);
        });
        c.innerHTML = '';
        c.appendChild(ul);
    },

    renderProperties: function() {
        UTILS.log('RENDER', 'renderProperties', 'Отрисовка properties');
        const c = document.getElementById('properties-content');
        if (!c) return;
        if (!STATE.isValid()) {
            c.innerHTML = '<div style="padding:24px; color:#666;">Не выбран файл в filelist</div>';
            return;
        }
        const s = STATE.appState.shapes;
        if (s.length === 0) {
            c.innerHTML = '<div style="padding:24px; color:#666;">В SVG не найдено фигур</div>';
            return;
        }
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Тип</th>
                    <th>ID</th>
                    <th>Класс</th>
                    <th>Координаты/Параметры</th>
                </tr>
            </thead>
            <tbody></tbody>`;
        s.forEach(sh => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sh.type}</td>
                <td>${sh.id || '-'}</td>
                <td>${sh.class || '-'}</td>
                <td>
                    ${sh.cx ? 'cx=' + sh.cx : ''} ${sh.cy ? 'cy=' + sh.cy : ''} ${sh.r ? ' r=' + sh.r : ''}
                    ${sh.x ? ' x=' + sh.x : ''} ${sh.y ? ' y=' + sh.y : ''}
                    ${sh.width ? ' w=' + sh.width : ''} ${sh.height ? ' h=' + sh.height : ''}
                    ${sh.d ? sh.d.substring(0, 40) + '...' : ''}
                </td>`;
            table.querySelector('tbody').appendChild(tr);
        });
        c.innerHTML = '';
        c.appendChild(table);
    },

    renderDiagram: function() {
        UTILS.log('RENDER', 'renderDiagram', 'Отрисовка diagram');
        const c = document.getElementById('diagram-content');
        if (!c) return;
        if (!STATE.isValid()) {
            c.innerHTML = `<div class="diag-message">Выберите файл в filelist для отображения диаграммы</div>`;
            return;
        }
        if (STATE.appState.svgDoc) {
            const clone = STATE.appState.svgDoc.querySelector('svg').cloneNode(true);
            c.innerHTML = '';
            c.appendChild(clone);
            return;
        }
        c.innerHTML = '<div class="diag-message" style="color:#f57f17;">Загрузка диаграммы...</div>';
    }
};

const EVENTS = {
    handleFileListItemClick: function(url) {
        UTILS.log('EVENTS', 'handleFileListItemClick', 'Клик по файлу в filelist', { url });
        STATE.setSelectedFile(url);
        RENDER.renderFileList();
        RENDER.renderProperties();
        RENDER.renderDiagram();

        DATA.loadSvg(url)
            .then(doc => {
                STATE.appState.svgDoc = doc;
                STATE.appState.shapes = DATA.analyzeShapes(doc);
                RENDER.renderProperties();
                RENDER.renderDiagram();
            })
            .catch(err => {
                UTILS.log('EVENTS', 'handleFileListItemClick', 'Ошибка при загрузке SVG после клика', { error: err.message, url });
                // Оставляем сообщение только в логе, без UI-ошибок поверх диаграммы
            });
    },

    handleDiagramClick: function() {
        UTILS.log('EVENTS', 'handleDiagramClick', 'Клик в область diagram');
        if (!STATE.isValid()) {
            // Именованное событие: только лог, без alert и без красных надписей
            UTILS.log('EVENTS', 'diagram.click.no-selection', 'Не выбран элемент filelist — действие невозможно', {});
            return;
        }
        UTILS.log('EVENTS', 'handleDiagramClick', 'Клик в diagram при выбранном файле (заглушка действия)', {});
        // Здесь можно добавить зум/панорамирование и т.п.
    }
};

// ---------------------------------------------------------
// Ресайзер для панели лога
// ---------------------------------------------------------
const RESIZER = {
    init: function() {
        const handle = document.getElementById('log-resizer');
        const logPanel = handle.parentElement; // .panel
        const gridContainer = logPanel.parentElement; // .layout-grid

        let startY;
        let startHeight;

        function onMouseDown(e) {
            startY = e.clientY;
            startHeight = logPanel.offsetHeight;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            UTILS.log('RESIZER', 'onMouseDown', 'Начало изменения размера панели лога');
        }

        function onMouseMove(e) {
            const diff = startY - e.clientY;
            const newHeight = startHeight - diff;
            // Минимальная высота 60px, чтобы не схлопнулась
            if (newHeight < 60) return;
            logPanel.style.height = `${newHeight}px`;
            UTILS.log('RESIZER', 'onMouseMove', 'Изменение высоты панели лога', { height: newHeight });
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            UTILS.log('RESIZER', 'onMouseUp', 'Изменение размера панели лога завершено');
        }

        if (handle) {
            handle.addEventListener('mousedown', onMouseDown);
        }
    }
};

// ---------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ЗАПУСК ПРИЛОЖЕНИЯ
// ---------------------------------------------------------
function initApp() {
    UTILS.log('APP', 'initApp', 'Запуск приложения');
    STATE.initFromConfig();
    RENDER.renderFileList();
    RENDER.renderProperties();
    RENDER.renderDiagram();

    const diagramContainer = document.getElementById('diagram-content');
    if (diagramContainer) {
        diagramContainer.addEventListener('click', EVENTS.handleDiagramClick);
    }

    RESIZER.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
