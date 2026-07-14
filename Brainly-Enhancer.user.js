// ==UserScript==
// @name         Brainly Enhancer
// @namespace    https://brainly.lat/
// @version      2026.07.14
// @description  Google Search flotante (movible, redimensionable, colapsable y con posición guardada) + miniaturas automáticas de adjuntos en Brainly
// @downloadURL  https://github.com/wernser412/Brainly-Enhancer/raw/refs/heads/main/Brainly-Enhancer.user.js
// @icon         https://github.com/wernser412/Google-Search-on-Brainly/raw/refs/heads/main/ICONO.ico
// @author       wernser412
// @match        https://brainly.lat/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // ========================= CONFIG =========================

    const LS_KEY = {
        x: 'bre_box_x',
        y: 'bre_box_y',
        w: 'bre_box_w',
        h: 'bre_box_h',
        collapsed: 'bre_box_collapsed'
    };

    const DEFAULT_BOX = { x: 60, y: 60, w: 500, h: 420 };
    const MIN_BOX = { w: 320, h: 220 };
    const MARGIN = 8;

    // ========================= UTILIDADES =========================

    function clamp(n, min, max) {
        return Math.min(Math.max(n, min), max);
    }

    function debounce(fn, ms) {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    // ========================= ESTILOS =========================

    GM_addStyle(`
        #bre-search-icon {
            position: absolute;
            width: 30px;
            height: 30px;
            cursor: pointer;
            background: #fff;
            border-radius: 50%;
            box-shadow: 0 3px 10px rgba(0,0,0,.25);
            padding: 6px;
            display: none;
            z-index: 2147483000;
            opacity: 0;
            transform: scale(.7);
            transition: opacity .15s ease, transform .15s ease;
        }
        #bre-search-icon.bre-visible {
            display: block;
            opacity: 1;
            transform: scale(1);
        }
        #bre-search-icon:hover { transform: scale(1.12); }

        #bre-search-box {
            position: fixed;
            background: #fff;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 14px 40px rgba(0,0,0,.35);
            z-index: 2147483000;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity .15s ease, transform .15s ease;
        }
        #bre-search-box.bre-visible {
            display: flex;
            flex-direction: column;
            opacity: 1;
            transform: translateY(0);
        }
        #bre-search-box.bre-collapsed { height: 42px !important; }
        #bre-search-box.bre-collapsed #bre-frame-wrap,
        #bre-search-box.bre-collapsed #bre-resize-handle { display: none; }

        #bre-titlebar {
            flex-shrink: 0;
            height: 42px;
            background: linear-gradient(90deg, #4285F4, #34A853 40%, #FBBC05 70%, #EA4335);
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            padding: 0 6px 0 12px;
            gap: 4px;
            cursor: grab;
            user-select: none;
            text-shadow: 0 1px 2px rgba(0,0,0,.25);
        }
        #bre-titlebar:active { cursor: grabbing; }
        #bre-titlebar-text {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .bre-title-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: rgba(255,255,255,.18);
            cursor: pointer;
            font-size: 13px;
            transition: background .15s ease, transform .15s ease;
            flex-shrink: 0;
        }
        .bre-title-btn:hover { background: rgba(255,255,255,.32); }
        .bre-title-btn.bre-collapse-icon.bre-collapsed { transform: rotate(180deg); }

        #bre-frame-wrap {
            position: relative;
            flex: 1;
            min-height: 0;
            background: #f4f4f4;
        }
        #bre-frame-wrap iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
        #bre-frame-loading {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #777;
            font-size: 12px;
            background: #f4f4f4;
            transition: opacity .2s ease;
            pointer-events: none;
        }
        #bre-frame-loading .bre-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid #ccc;
            border-top-color: #4285F4;
            border-radius: 50%;
            animation: bre-spin 0.8s linear infinite;
        }
        @keyframes bre-spin { to { transform: rotate(360deg); } }

        #bre-resize-handle {
            position: absolute;
            width: 16px;
            height: 16px;
            right: 2px;
            bottom: 2px;
            cursor: se-resize;
            opacity: .55;
        }
        #bre-resize-handle svg { width: 100%; height: 100%; }
        #bre-resize-handle:hover { opacity: .9; }

        .brainly-miniatura {
            margin-top: 10px;
            display: inline-block;
        }
        .brainly-miniatura .bre-thumb-card {
            position: relative;
            width: 160px;
            height: 160px;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #e2e2e2;
            box-shadow: 0 2px 6px rgba(0,0,0,.08);
            cursor: pointer;
            transition: transform .18s ease, box-shadow .18s ease;
        }
        .brainly-miniatura .bre-thumb-card:hover {
            transform: scale(1.045);
            box-shadow: 0 6px 18px rgba(0,0,0,.18);
        }
        .brainly-miniatura img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .brainly-miniatura .bre-thumb-tag {
            position: absolute;
            left: 6px;
            bottom: 6px;
            background: rgba(0,0,0,.6);
            color: #fff;
            font-size: 10px;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 999px;
            backdrop-filter: blur(2px);
        }
        .brainly-miniatura .bre-thumb-skeleton {
            width: 160px;
            height: 160px;
            border-radius: 12px;
            background: linear-gradient(90deg, #eee 25%, #f6f6f6 37%, #eee 63%);
            background-size: 400% 100%;
            animation: bre-shimmer 1.4s ease infinite;
        }
        @keyframes bre-shimmer {
            0% { background-position: 100% 50%; }
            100% { background-position: 0 50%; }
        }
    `);

    // ========================= GOOGLE SEARCH BOX =========================

    let searchBox, frameWrap, searchFrame, frameLoading, searchIcon, titleText, collapseBtn, openTabBtn;

    function createSearchUI() {

        // ---- Icono flotante que aparece al seleccionar texto ----
        searchIcon = document.createElement('img');
        searchIcon.id = 'bre-search-icon';
        searchIcon.src = 'https://www.google.com/favicon.ico';
        searchIcon.title = 'Buscar en Google';
        document.body.appendChild(searchIcon);

        // ---- Caja ----
        searchBox = document.createElement('div');
        searchBox.id = 'bre-search-box';

        const titleBar = document.createElement('div');
        titleBar.id = 'bre-titlebar';

        titleText = document.createElement('div');
        titleText.id = 'bre-titlebar-text';
        titleText.textContent = '🔍 Google Search';
        titleBar.appendChild(titleText);

        openTabBtn = document.createElement('div');
        openTabBtn.className = 'bre-title-btn';
        openTabBtn.title = 'Abrir en una pestaña nueva';
        openTabBtn.textContent = '↗';
        titleBar.appendChild(openTabBtn);

        collapseBtn = document.createElement('div');
        collapseBtn.className = 'bre-title-btn bre-collapse-icon';
        collapseBtn.title = 'Colapsar / expandir';
        collapseBtn.textContent = '▾';
        titleBar.appendChild(collapseBtn);

        const closeButton = document.createElement('div');
        closeButton.className = 'bre-title-btn';
        closeButton.title = 'Cerrar';
        closeButton.textContent = '✕';
        closeButton.addEventListener('click', hideSearchBox);
        titleBar.appendChild(closeButton);

        searchBox.appendChild(titleBar);

        // ---- Contenido (iframe + loader) ----
        frameWrap = document.createElement('div');
        frameWrap.id = 'bre-frame-wrap';

        searchFrame = document.createElement('iframe');
        frameWrap.appendChild(searchFrame);

        frameLoading = document.createElement('div');
        frameLoading.id = 'bre-frame-loading';
        frameLoading.innerHTML = '<div class="bre-spinner"></div><span>Cargando resultados…</span>';
        frameWrap.appendChild(frameLoading);

        searchFrame.addEventListener('load', () => {
            frameLoading.style.opacity = '0';
        });

        searchBox.appendChild(frameWrap);

        // ---- Handle de resize ----
        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'bre-resize-handle';
        resizeHandle.innerHTML = '<svg viewBox="0 0 16 16"><path fill="#0078D7" d="M15 15h-3v-2h3v2zm0-5h-3V8h3v2zm-5 5H7v-2h3v2zm0-5H7V8h3v2zm-5 5H2v-2h3v2z"/></svg>';
        searchBox.appendChild(resizeHandle);

        document.body.appendChild(searchBox);

        setupBoxPersistence();
        setupDrag(titleBar);
        setupResize(resizeHandle);
        setupCollapse();

        openTabBtn.addEventListener('click', () => {
            if (searchFrame.dataset.query) {
                window.open(`https://www.google.com/search?q=${searchFrame.dataset.query}`, '_blank');
            }
        });

        // Escape cierra la caja (si no se está escribiendo en un campo de texto).
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            if (searchBox.classList.contains('bre-visible')) hideSearchBox();
        });
    }

    function hideSearchBox() {
        searchBox.classList.remove('bre-visible');
        setTimeout(() => { searchBox.style.display = 'none'; }, 150);
    }

    function showSearchBox(query) {
        frameLoading.style.opacity = '1';
        searchFrame.dataset.query = query;
        searchFrame.src = `https://www.google.com/search?igu=1&q=${query}`;
        searchBox.style.display = 'flex';
        // Se fuerza un reflow antes de agregar la clase para que la
        // transición de aparición (opacity/translateY) sí se anime.
        void searchBox.offsetWidth;
        searchBox.classList.add('bre-visible');
        searchIcon.classList.remove('bre-visible');
    }

    // ---- Posición / tamaño: aplicar, limitar al viewport y guardar ----

    function applyBoxRect(x, y, w, h) {
        const width = clamp(w, MIN_BOX.w, window.innerWidth - MARGIN * 2);
        const height = clamp(h, MIN_BOX.h, window.innerHeight - MARGIN * 2);
        const left = clamp(x, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN));
        const top = clamp(y, MARGIN, Math.max(MARGIN, window.innerHeight - height - MARGIN));

        searchBox.style.left = left + 'px';
        searchBox.style.top = top + 'px';
        searchBox.style.width = width + 'px';
        searchBox.style.height = height + 'px';

        return { x: left, y: top, w: width, h: height };
    }

    const saveBoxRect = debounce((rect) => {
        GM_setValue(LS_KEY.x, rect.x);
        GM_setValue(LS_KEY.y, rect.y);
        GM_setValue(LS_KEY.w, rect.w);
        GM_setValue(LS_KEY.h, rect.h);
    }, 150);

    function setupBoxPersistence() {
        const rect = applyBoxRect(
            GM_getValue(LS_KEY.x, DEFAULT_BOX.x),
            GM_getValue(LS_KEY.y, DEFAULT_BOX.y),
            GM_getValue(LS_KEY.w, DEFAULT_BOX.w),
            GM_getValue(LS_KEY.h, DEFAULT_BOX.h)
        );
        saveBoxRect(rect);

        window.addEventListener('resize', debounce(() => {
            const r = searchBox.getBoundingClientRect();
            const fixed = applyBoxRect(r.left, r.top, r.width, r.height);
            saveBoxRect(fixed);
        }, 150));
    }

    // ---- Arrastrar (Pointer Events: funciona con mouse y con touch) ----

    function setupDrag(titleBar) {
        let dragging = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        titleBar.addEventListener('pointerdown', e => {
            if (e.target.closest('.bre-title-btn')) return;
            dragging = true;
            titleBar.setPointerCapture(e.pointerId);
            const rect = searchBox.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
        });

        titleBar.addEventListener('pointermove', e => {
            if (!dragging) return;
            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);
            const rect = searchBox.getBoundingClientRect();
            const fixed = applyBoxRect(newLeft, newTop, rect.width, rect.height);
            saveBoxRect(fixed);
        });

        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            try { titleBar.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        titleBar.addEventListener('pointerup', endDrag);
        titleBar.addEventListener('pointercancel', endDrag);
    }

    // ---- Redimensionar ----

    function setupResize(handle) {
        let resizing = false;
        let startX = 0, startY = 0, startW = 0, startH = 0;

        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            resizing = true;
            handle.setPointerCapture(e.pointerId);
            const rect = searchBox.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startW = rect.width;
            startH = rect.height;
        });

        handle.addEventListener('pointermove', e => {
            if (!resizing) return;
            const rect = searchBox.getBoundingClientRect();
            const newW = startW + (e.clientX - startX);
            const newH = startH + (e.clientY - startY);
            const fixed = applyBoxRect(rect.left, rect.top, newW, newH);
            saveBoxRect(fixed);
        });

        function endResize(e) {
            if (!resizing) return;
            resizing = false;
            try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        handle.addEventListener('pointerup', endResize);
        handle.addEventListener('pointercancel', endResize);
    }

    // ---- Colapsar ----

    function setupCollapse() {
        function setCollapsed(collapsed) {
            searchBox.classList.toggle('bre-collapsed', collapsed);
            collapseBtn.classList.toggle('bre-collapsed', collapsed);
            GM_setValue(LS_KEY.collapsed, collapsed ? '1' : '0');
        }
        collapseBtn.addEventListener('click', () => {
            setCollapsed(!searchBox.classList.contains('bre-collapsed'));
        });
        setCollapsed(GM_getValue(LS_KEY.collapsed, '0') === '1');
    }

    // ---- Selección de texto -> ícono de búsqueda ----
    // Nota: se ignora si la selección quedó vacía porque el propio clic fue
    // sobre el ícono o la caja (si no, el ícono se ocultaría justo antes de
    // procesar su propio clic).

    function onTextSelect(e) {
        if (e.target.closest('#bre-search-icon, #bre-search-box')) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (!selectedText) {
            searchIcon.classList.remove('bre-visible');
            return;
        }

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        searchIcon.style.left = `${rect.right + window.scrollX + 6}px`;
        searchIcon.style.top = `${rect.top + window.scrollY - 4}px`;
        searchIcon.classList.add('bre-visible');

        searchIcon.onclick = () => {
            showSearchBox(encodeURIComponent(selectedText));
        };
    }

    //////////////////////////////////////////////////////////////////////
    // MINIATURAS DE ADJUNTOS
    //////////////////////////////////////////////////////////////////////

    const imageCache = new Map();
    const MAX_INTENTOS_ADJUNTO = 25; // ~25 x 300ms ≈ 7.5s antes de rendirse

    // Carga la publicación en un iframe oculto y espera a que aparezca la
    // imagen del adjunto. A diferencia de la versión original, esto SÍ
    // tiene un límite de intentos: antes, si la imagen nunca aparecía
    // (adjunto no es una imagen, la página no cargó, etc.) el iframe oculto
    // y el setTimeout quedaban vivos para siempre, acumulándose por cada
    // publicación fallida.
    function obtenerAdjunto(url) {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;
            document.body.appendChild(iframe);

            let intentos = 0;
            let terminado = false;

            const terminar = (resultado) => {
                if (terminado) return;
                terminado = true;
                iframe.remove();
                resolve(resultado);
            };

            iframe.onload = () => {
                const buscar = () => {
                    if (terminado) return;

                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const img = doc.querySelector('img[data-testid="attachments-viewer-image-preview"]');
                        if (img?.src) {
                            terminar(img.src);
                            return;
                        }
                    } catch (_) {
                        // Documento aún no accesible (cross-origin momentáneo, etc.)
                    }

                    intentos++;
                    if (intentos >= MAX_INTENTOS_ADJUNTO) {
                        terminar(null);
                        return;
                    }
                    setTimeout(buscar, 300);
                };
                buscar();
            };

            iframe.onerror = () => terminar(null);
        });
    }

    function agregarSkeleton(item) {
        const content = item.querySelector('.brn-feed-item__content');
        if (!content) return null;

        const container = document.createElement('div');
        container.className = 'brainly-miniatura';
        const skeleton = document.createElement('div');
        skeleton.className = 'bre-thumb-skeleton';
        container.appendChild(skeleton);
        content.appendChild(container);
        return container;
    }

    function agregarMiniatura(item, src, placeholder) {
        if (item.querySelector('.brainly-miniatura img')) return;

        const container = placeholder || document.createElement('div');
        container.className = 'brainly-miniatura';
        container.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'bre-thumb-card';

        const img = document.createElement('img');
        img.src = src;
        img.loading = 'lazy';
        card.appendChild(img);

        const tag = document.createElement('div');
        tag.className = 'bre-thumb-tag';
        tag.textContent = '📎 Adjunto';
        card.appendChild(tag);

        card.addEventListener('click', () => window.open(src, '_blank'));
        container.appendChild(card);

        if (!placeholder) {
            const content = item.querySelector('.brn-feed-item__content');
            if (content) content.appendChild(container);
        }
    }

    async function iniciarMiniaturas() {
        const items = document.querySelectorAll('.brn-feed-item-wrapper');

        for (const item of items) {
            if (item.dataset.miniReady) continue;

            const attachment = item.querySelector('.brn-feed-item__attachment');
            if (!attachment) continue; // No se marca como "listo": puede aparecer luego (carga diferida)

            const link = item.querySelector('a[data-test="feed-item-link"]');
            if (!link) continue; // Misma razón: se reintenta en la próxima pasada

            // Recién aquí se marca como procesado. Antes se marcaba ANTES de
            // estas dos validaciones, así que si el adjunto o el link
            // aparecían más tarde (carga diferida del feed) el ítem quedaba
            // saltado para siempre.
            item.dataset.miniReady = '1';

            const url = link.href;

            if (imageCache.has(url)) {
                const cached = imageCache.get(url);
                if (cached) agregarMiniatura(item, cached);
                continue;
            }

            const placeholder = agregarSkeleton(item);

            obtenerAdjunto(url).then(src => {
                imageCache.set(url, src);
                if (!src) {
                    placeholder?.remove();
                    return;
                }
                agregarMiniatura(item, src, placeholder);
            });
        }
    }

    //////////////////////////////////////////////////////////////////////
    // INIT
    //////////////////////////////////////////////////////////////////////

    document.addEventListener('mouseup', onTextSelect);

    createSearchUI();
    iniciarMiniaturas();

    // Antes esto llamaba a iniciarMiniaturas() de forma sincrónica en CADA
    // mutación del DOM, sin importar cuántas por segundo (Brainly re-renderiza
    // seguido: contadores, ads, chat, etc.), recorriendo TODO el feed cada
    // vez. Se agrupa (debounce) para que solo corra una vez que el DOM se
    // queda quieto un momento.
    const iniciarMiniaturasDebounced = debounce(iniciarMiniaturas, 250);
    new MutationObserver(() => {
        iniciarMiniaturasDebounced();
    }).observe(document.body, {
        childList: true,
        subtree: true
    });

})();
