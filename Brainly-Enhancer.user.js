// ==UserScript==
// @name         Brainly Enhancer
// @namespace    https://brainly.lat/
// @version      2026.09.02
// @description  Muestra el nombre de usuario en el feed (en rojo) + miniaturas automáticas de adjuntos en Brainly
// @downloadURL  https://github.com/wernser412/Brainly-Enhancer/raw/refs/heads/main/Brainly-Enhancer.user.js
// @icon         https://github.com/wernser412/Google-Search-on-Brainly/raw/refs/heads/main/ICONO.ico
// @author       wernser412
// @match        https://brainly.lat/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // ========================= UTILIDADES =========================

    function debounce(fn, ms) {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    // ========================= ESTILOS =========================

    GM_addStyle(`
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

        .bre-autor-nombre {
            color: #e02424 !important;
        }
        .bre-autor-nombre:hover {
            text-decoration: underline;
        }
    `);

    //////////////////////////////////////////////////////////////////////
    // NOMBRE DE USUARIO EN EL FEED
    //////////////////////////////////////////////////////////////////////
    // Brainly no muestra el nombre del autor en las tarjetas del feed
    // (solo materia y hora), pero el link del avatar sí lo trae en
    // aria-label (ej. "mbjh") y en el href (/perfil/mbjh-47508658).
    // Esta función lo inserta como un elemento más de las breadcrumbs,
    // resaltado en rojo.

    function obtenerNombreDesdeAvatar(item) {
        const avatarLink = item.querySelector('.brn-feed-item__avatar a[aria-label]');
        if (avatarLink) {
            const nombre = avatarLink.getAttribute('aria-label')?.trim();
            if (nombre) return { nombre, href: avatarLink.getAttribute('href') || '#' };
        }

        // Fallback: extraer del href tipo /perfil/mbjh-47508658
        const linkPerfil = item.querySelector('.brn-feed-item__avatar a[href*="/perfil/"]');
        if (linkPerfil) {
            const href = linkPerfil.getAttribute('href') || '';
            const slug = href.split('/perfil/')[1] || '';
            const nombre = slug.replace(/-\d+$/, '').trim();
            if (nombre) return { nombre, href };
        }

        return null;
    }

    function agregarNombreAutor(item) {
        if (item.dataset.breNombre) return;

        const breadcrumbList = item.querySelector('.sg-breadcrumb-list');
        if (!breadcrumbList) return; // puede aparecer luego (carga diferida)

        const info = obtenerNombreDesdeAvatar(item);
        if (!info) return; // se reintenta en la próxima pasada

        item.dataset.breNombre = '1';

        const li = document.createElement('li');
        li.className = 'sg-breadcrumb-list__element';

        const span = document.createElement('span');
        span.className = 'sg-text sg-text--small sg-text--bold';

        const a = document.createElement('a');
        a.href = info.href;
        a.className = 'sg-text sg-text--inherited sg-text--link bre-autor-nombre';
        a.textContent = info.nombre;

        span.appendChild(a);
        li.appendChild(span);
        breadcrumbList.insertBefore(li, breadcrumbList.firstChild);
    }

    function iniciarNombres() {
        const items = document.querySelectorAll('.brn-feed-item-wrapper');
        for (const item of items) {
            agregarNombreAutor(item);
        }
    }

    //////////////////////////////////////////////////////////////////////
    // MINIATURAS DE ADJUNTOS
    //////////////////////////////////////////////////////////////////////

    const imageCache = new Map();
    const MAX_INTENTOS_ADJUNTO = 25; // ~25 x 300ms ≈ 7.5s antes de rendirse

    // Carga la publicación en un iframe oculto y espera a que aparezca la
    // imagen del adjunto. Tiene un límite de intentos: si la imagen nunca
    // aparece (adjunto no es una imagen, la página no cargó, etc.) el
    // iframe se limpia en vez de quedar vivo para siempre.
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

            // Recién aquí se marca como procesado. Si el adjunto o el link
            // aparecen más tarde (carga diferida del feed), el ítem se
            // reintenta en la próxima pasada.
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

    iniciarMiniaturas();
    iniciarNombres();

    // Se agrupa (debounce) para que solo corra una vez que el DOM se queda
    // quieto un momento, en vez de recorrer todo el feed en cada mutación
    // (Brainly re-renderiza seguido: contadores, ads, chat, etc.).
    const iniciarMiniaturasDebounced = debounce(iniciarMiniaturas, 250);
    const iniciarNombresDebounced = debounce(iniciarNombres, 250);
    new MutationObserver(() => {
        iniciarMiniaturasDebounced();
        iniciarNombresDebounced();
    }).observe(document.body, {
        childList: true,
        subtree: true
    });

})();
