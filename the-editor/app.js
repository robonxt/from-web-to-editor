(function () {
  'use strict';

  // Elements
  const pagesListEl = document.getElementById('pagesList');
  const newPathInput = document.getElementById('newPathInput');
  const addPathBtn = document.getElementById('addPathBtn');
  const loadBtn = document.getElementById('loadBtn');
  const savePageBtn = document.getElementById('savePageBtn');
  const revertBtn = document.getElementById('revertBtn');
  const downloadPageBtn = document.getElementById('downloadPageBtn');
  const exportZipBtn = document.getElementById('exportZipBtn');
  const includeAssetsCbx = document.getElementById('includeAssetsCbx');

  const editorFrame = document.getElementById('editorFrame');
  const currentPathEl = document.getElementById('currentPath');
  const statusEl = document.getElementById('status');
  const toggleEditable = document.getElementById('toggleEditable');
  const selectModeBtn = document.getElementById('selectModeBtn');

  const bufferListEl = document.getElementById('bufferList');
  const newPageName = document.getElementById('newPageName');
  const createPageBtn = document.getElementById('createPageBtn');

  // Components & assets UI
  const componentsListEl = document.getElementById('componentsList');
  const newComponentPath = document.getElementById('newComponentPath');
  const addComponentBtn = document.getElementById('addComponentBtn');
  const insertComponentBtn = document.getElementById('insertComponentBtn');
  const assetPathInput = document.getElementById('assetPathInput');
  const applyAssetToImgBtn = document.getElementById('applyAssetToImgBtn');

  const selectedSummary = document.getElementById('selectedSummary');
  const inspectorFields = document.getElementById('inspectorFields');
  const applyAttrsBtn = document.getElementById('applyAttrsBtn');
  const deleteElBtn = document.getElementById('deleteElBtn');
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const insertTagSelect = document.getElementById('insertTagSelect');
  const insertTagBtn = document.getElementById('insertTagBtn');
  const wrapWithBtn = document.getElementById('wrapWithBtn');
  const moveUpBtn = document.getElementById('moveUpBtn');
  const moveDownBtn = document.getElementById('moveDownBtn');
  const duplicateBtn = document.getElementById('duplicateBtn');

  // Responsive & history
  const viewportPreset = document.getElementById('viewportPreset');
  const viewportWidth = document.getElementById('viewportWidth');
  const applyViewportBtn = document.getElementById('applyViewportBtn');
  const editHeadBtn = document.getElementById('editHeadBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  // Left toolbar buttons (Carrd-like)
  const tbAdd = document.getElementById('tbAdd');
  const tbUndo = document.getElementById('tbUndo');
  const tbRedo = document.getElementById('tbRedo');
  const tbPreview = document.getElementById('tbPreview');
  const tbSwitch = document.getElementById('tbSwitch');
  const tbPublish = document.getElementById('tbPublish');
  const tbMenu = document.getElementById('tbMenu');

  // Help modal
  const helpModal = document.getElementById('helpModal');
  const helpClose = document.getElementById('helpClose');

  // State
  const ROOT_DIR = '../the-website/'; // read-only input
  const initialPaths = ['index.html', '404.html'];
  const initialComponents = ['components/icon.html'];
  let currentPath = '';
  let originalHtmlCache = new Map(); // path -> original fetched html
  let editedBuffer = new Map(); // path -> edited html
  let selectMode = false;
  let selectedEl = null;

  // History stacks per page
  let undoStack = [];
  let redoStack = [];

  // Utilities
  function setStatus(msg) {
    statusEl.textContent = msg || '';
    if (!msg) return;
    setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 2000);
  }

  function openHelp() {
    if (helpModal) helpModal.classList.remove('hidden');
  }
  function closeHelp() {
    if (helpModal) helpModal.classList.add('hidden');
  }

  function makeListItem(path) {
    const item = document.createElement('div');
    item.className = 'item';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'selectedPath';
    radio.value = path;
    const label = document.createElement('span');
    label.textContent = path;
    item.appendChild(radio);
    item.appendChild(label);
    item.addEventListener('click', (e) => {
      if (e.target !== radio) radio.checked = true;
    });

  // Toolbar wiring
  if (tbMenu) {
    tbMenu.addEventListener('click', openHelp);
  }
  if (helpClose) {
    helpClose.addEventListener('click', closeHelp);
  }
  if (tbUndo) tbUndo.addEventListener('click', () => undoBtn.click());
  if (tbRedo) tbRedo.addEventListener('click', () => redoBtn.click());
  if (tbAdd) tbAdd.addEventListener('click', () => {
    // Enable select mode to pick a target and focus insertion controls
    if (!selectMode) selectModeBtn.click();
    setStatus('Select a target, then use Insert in Inspector');
    // Try to scroll inspector into view
    const el = document.getElementById('insertTagSelect');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  if (tbPreview) tbPreview.addEventListener('click', () => {
    if (!currentPath) { setStatus('No page loaded'); return; }
    const html = serializeCurrentHtml();
    const w = window.open('about:blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  });
  let mobileToggle = false;
  if (tbSwitch) tbSwitch.addEventListener('click', () => {
    mobileToggle = !mobileToggle;
    applyViewport(mobileToggle ? '390' : 'full');
  });
  if (tbPublish) tbPublish.addEventListener('click', (e) => {
    const prev = includeAssetsCbx ? includeAssetsCbx.checked : false;
    if (e.shiftKey && includeAssetsCbx) includeAssetsCbx.checked = true;
    exportZipBtn.click();
    if (includeAssetsCbx) includeAssetsCbx.checked = prev; // restore
  });
    return item;
  }

  function refreshPagesList() {
    pagesListEl.innerHTML = '';
    const paths = new Set(initialPaths);
    // add buffered paths too
    editedBuffer.forEach((_, p) => paths.add(p));
    // add cached originals
    originalHtmlCache.forEach((_, p) => paths.add(p));
    [...paths].sort().forEach(p => pagesListEl.appendChild(makeListItem(p)));
  }

  function makeComponentItem(path) {
    const item = document.createElement('div');
    item.className = 'item';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'selectedComponentPath';
    radio.value = path;
    const label = document.createElement('span');
    label.textContent = path;
    item.appendChild(radio);
    item.appendChild(label);
    item.addEventListener('click', (e) => {
      if (e.target !== radio) radio.checked = true;
    });
    return item;
  }

  function refreshComponentsList() {
    if (!componentsListEl) return;
    componentsListEl.innerHTML = '';
    initialComponents.forEach(p => componentsListEl.appendChild(makeComponentItem(p)));
  }

  function getSelectedListPath() {
    const input = pagesListEl.querySelector('input[name="selectedPath"]:checked');
    return input ? input.value : '';
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.text();
  }

  function injectBaseHref(html, baseHref) {
    // ensure relative assets resolve even in srcdoc
    const hasHead = /<head[\s>]/i.test(html);
    const baseTag = `<base href="${baseHref}" />`;
    if (hasHead) {
      return html.replace(/<head[\s>]/i, m => `${m}\n  ${baseTag}`);
    }
    // if no head, add it
    return html.replace(/<html[\s>]/i, m => `${m}\n<head>\n  ${baseTag}\n</head>`);
  }

  function pathDirname(path) {
    const idx = path.lastIndexOf('/');
    if (idx === -1) return '';
    return path.slice(0, idx + 1);
  }

  async function loadPath(path) {
    currentPath = path;
    currentPathEl.textContent = path || '';
    selectedEl = null;
    selectedSummary.textContent = 'No element selected';
    inspectorFields.innerHTML = '';
    undoStack = [];
    redoStack = [];

    // Prefer edited buffer when present
    let html = editedBuffer.get(path);
    if (!html) {
      const url = ROOT_DIR + path;
      const baseHref = ROOT_DIR + pathDirname(path);
      html = await fetchText(url);
      originalHtmlCache.set(path, html);
      html = injectBaseHref(html, baseHref);
    }

    // Render into iframe using srcdoc to keep same-origin DOM access
    // Attach load handler BEFORE setting srcdoc to avoid missed events
    const onLoad = () => {
      applyEditable(toggleEditable.checked);
      wireFrameHoverHandlers();
      ensureFrameStyles();
      syncSelectModeUI();
      console.debug('[editor] iframe loaded, handlers wired');
    };
    editorFrame.addEventListener('load', onLoad, { once: true });
    editorFrame.srcdoc = html;
  }

  function getFrameDoc() {
    const doc = editorFrame.contentDocument;
    return doc;
  }

  function ensureFrameStyles() {
    const doc = getFrameDoc();
    if (!doc) return;
    if (!doc.getElementById('_editor_style_injected')) {
      const style = doc.createElement('style');
      style.id = '_editor_style_injected';
      style.textContent = `
._editor-highlight{outline:2px dashed #22c55e; outline-offset:2px; cursor:crosshair;}
._editor-hover{outline:2px dashed #a78bfa; outline-offset:2px;}
[data-editor-select="on"] *{ cursor: crosshair !important; }
._editor-badge{ position: fixed; top: 8px; right: 8px; z-index: 2147483647; font-size: 12px; background: #a78bfa; color: #fff; padding: 4px 6px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
`;
      (doc.head || doc.documentElement).appendChild(style);
    }
  }

  function syncSelectModeUI() {
    const doc = getFrameDoc();
    if (!doc) return;
    doc.documentElement.setAttribute('data-editor-select', selectMode ? 'on' : 'off');
    let badge = doc.getElementById('_editor_select_badge');
    if (selectMode) {
      if (!badge) {
        badge = doc.createElement('div');
        badge.id = '_editor_select_badge';
        badge.className = '_editor-badge';
        badge.textContent = 'Select Mode: Click to pick element';
        doc.body.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  }

  function applyEditable(enabled) {
    const doc = getFrameDoc();
    if (!doc) return;
    doc.body.setAttribute('contenteditable', enabled ? 'true' : 'false');
  }

  function clearHighlights() {
    const doc = getFrameDoc();
    if (!doc) return;
    [...doc.querySelectorAll('._editor-hover,._editor-highlight')].forEach(el => {
      el.classList.remove('_editor-hover');
      el.classList.remove('_editor-highlight');
    });
  }

  function wireFrameHoverHandlers() {
    const doc = getFrameDoc();
    if (!doc) return;

    // Remove prior handlers by cloning body (keeps children and events are not copied)? Avoid destructive.
    // Instead, we attach once and rely on doc to refresh on load.
    doc.addEventListener('mouseover', onDocMouseOver, true);
    doc.addEventListener('mouseout', onDocMouseOut, true);
    doc.addEventListener('click', onDocClick, true);
  }

  function isFrameElement(node) {
    if (!node) return false;
    // Use nodeType to avoid cross-realm instanceof issues
    return node.nodeType === 1; // ELEMENT_NODE
  }

  function onDocMouseOver(e) {
    if (!selectMode) return;
    const t = e.target;
    if (!isFrameElement(t)) return;
    t.classList.add('_editor-hover');
  }

  function onDocMouseOut(e) {
    if (!selectMode) return;
    const t = e.target;
    if (!isFrameElement(t)) return;
    t.classList.remove('_editor-hover');
  }

  function onDocClick(e) {
    if (!selectMode) return;
    const t = e.target;
    if (!isFrameElement(t)) return;
    e.preventDefault();
    e.stopPropagation();
    selectElement(t);
  }

  function selectElement(el) {
    clearHighlights();
    selectedEl = el;
    el.classList.add('_editor-highlight');
    updateInspector(el);
    updateBreadcrumbs(el);
  }

  function updateInspector(el) {
    const tag = el.tagName.toLowerCase();
    selectedSummary.textContent = `<${tag}>`;

    // Build fields
    inspectorFields.innerHTML = '';

    function addField(label, key, value, type = 'text') {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lab = document.createElement('label');
      lab.textContent = label;
      const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = 'text';
      input.value = value || '';
      input.dataset.key = key;
      wrap.appendChild(lab);
      wrap.appendChild(input);
      inspectorFields.appendChild(wrap);
    }

    addField('Tag', '__tag', tag);
    addField('id', 'id', el.id);
    addField('class', 'class', el.getAttribute('class') || '');

    // Common attributes
    if (el.hasAttribute('href') || tag === 'a') addField('href', 'href', el.getAttribute('href') || '');
    if (el.hasAttribute('src')) addField('src', 'src', el.getAttribute('src'));
    addField('title', 'title', el.getAttribute('title') || '');
    if (el.hasAttribute('alt') || tag === 'img') addField('alt', 'alt', el.getAttribute('alt') || '');
    if (tag === 'a') {
      addField('target', 'target', el.getAttribute('target') || '');
      addField('rel', 'rel', el.getAttribute('rel') || '');
      if (el.hasAttribute('download')) addField('download', 'download', el.getAttribute('download') || '');
    }
    if (tag === 'img') {
      addField('width', 'width', el.getAttribute('width') || '');
      addField('height', 'height', el.getAttribute('height') || '');
    }
    if (tag === 'input' || tag === 'textarea') {
      addField('name', 'name', el.getAttribute('name') || '');
      if (tag === 'input') addField('value', 'value', el.getAttribute('value') || '');
      addField('placeholder', 'placeholder', el.getAttribute('placeholder') || '');
    }
    // ARIA / role
    addField('aria-label', 'aria-label', el.getAttribute('aria-label') || '');
    addField('role', 'role', el.getAttribute('role') || '');

    addField('style (inline)', 'style', el.getAttribute('style') || '');

    // Text content
    addField('textContent', '__text', el.textContent || '', 'textarea');
  }

  function updateBreadcrumbs(el) {
    if (!breadcrumbsEl) return;
    const doc = getFrameDoc();
    breadcrumbsEl.innerHTML = '';
    const chain = [];
    let cur = el;
    while (cur && cur !== doc.documentElement) {
      chain.push(cur);
      cur = cur.parentElement;
    }
    chain.reverse();
    chain.forEach((node, idx) => {
      const b = document.createElement('span');
      const tag = node.tagName.toLowerCase();
      const id = node.id ? `#${node.id}` : '';
      const cls = node.className && typeof node.className === 'string' ? '.' + node.className.split(/\s+/).filter(Boolean).join('.') : '';
      b.textContent = `${tag}${id}${cls}`;
      b.className = 'crumb' + (idx === chain.length - 1 ? ' active' : '');
      b.addEventListener('click', () => selectElement(node));
      breadcrumbsEl.appendChild(b);
    });
  }

  function applyInspectorToEl() {
    if (!selectedEl) return;
    recordUndo();
    const items = inspectorFields.querySelectorAll('[data-key]');
    let newTag = selectedEl.tagName.toLowerCase();
    items.forEach(inp => {
      const key = inp.dataset.key;
      const val = inp.value;
      if (key === '__tag') newTag = val.trim() || newTag;
    });

    // Replace tag if changed
    if (newTag && newTag !== selectedEl.tagName.toLowerCase()) {
      const doc = getFrameDoc();
      const newEl = doc.createElement(newTag);
      // move children
      while (selectedEl.firstChild) newEl.appendChild(selectedEl.firstChild);
      // copy attributes except to be updated below
      [...selectedEl.attributes].forEach(attr => {
        if (!['id','class','href','src','style'].includes(attr.name)) newEl.setAttribute(attr.name, attr.value);
      });
      selectedEl.replaceWith(newEl);
      selectedEl = newEl;
    }

    // Now apply attributes and text
    items.forEach(inp => {
      const key = inp.dataset.key;
      const val = inp.value;
      switch (key) {
        case 'id':
        case 'class':
        case 'href':
        case 'src':
        case 'style':
        case 'title':
        case 'alt':
        case 'target':
        case 'rel':
        case 'download':
        case 'width':
        case 'height':
        case 'name':
        case 'value':
        case 'placeholder':
        case 'aria-label':
        case 'role':
          if (val) selectedEl.setAttribute(key, val); else selectedEl.removeAttribute(key);
          break;
        case '__text':
          selectedEl.textContent = val;
          break;
      }
    });

    updateInspector(selectedEl);
    updateBreadcrumbs(selectedEl);
    setStatus('Applied');
  }

  function deleteSelectedEl() {
    if (!selectedEl) return;
    recordUndo();
    const parent = selectedEl.parentElement;
    selectedEl.remove();
    selectedEl = null;
    selectedSummary.textContent = 'No element selected';
    inspectorFields.innerHTML = '';
    if (parent) selectElement(parent);
  }

  function serializeCurrentHtml() {
    const doc = getFrameDoc();
    if (!doc) return '';
    // Use full document HTML
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  // Create a clean HTML string suitable for export (no editor artifacts)
  function cleanForExport(html, pathHint = '') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove our injected style and badge
      const inj = doc.getElementById('_editor_style_injected');
      if (inj) inj.remove();
      const badge = doc.getElementById('_editor_select_badge');
      if (badge) badge.remove();

      // Remove editor selection classes from all elements
      doc.querySelectorAll('._editor-hover, ._editor-highlight').forEach(el => {
        el.classList.remove('_editor-hover');
        el.classList.remove('_editor-highlight');
      });

      // Remove data and attributes used by the editor
      doc.documentElement.removeAttribute('data-editor-select');
      doc.querySelectorAll('[contenteditable]')
        .forEach(el => el.removeAttribute('contenteditable'));

      // Strip draggable and any data-* attributes from all elements
      doc.querySelectorAll('*').forEach(el => {
        if (el.hasAttribute('draggable')) el.removeAttribute('draggable');
        // remove all data-* attributes
        [...el.attributes].forEach(attr => {
          if (/^data-/i.test(attr.name)) el.removeAttribute(attr.name);
        });
      });

      // Remove the <base> tag we added (points at ROOT_DIR)
      const bases = [...doc.getElementsByTagName('base')];
      bases.forEach(b => {
        const href = (b.getAttribute('href') || '').trim();
        if (!href) return;
        // Our injected base starts with ROOT_DIR
        if (href.indexOf(ROOT_DIR) === 0) b.remove();
      });

      // Return pretty minimal HTML
      return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch (e) {
      console.warn('cleanForExport failed, returning original HTML', e);
      return html;
    }
  }

  function applySnapshot(html) {
    const onLoad = () => {
      applyEditable(toggleEditable.checked);
      wireFrameHoverHandlers();
      ensureFrameStyles();
      syncSelectModeUI();
      selectedEl = null;
      selectedSummary.textContent = 'No element selected';
      inspectorFields.innerHTML = '';
      updateBreadcrumbs(getFrameDoc().body);
    };
    editorFrame.addEventListener('load', onLoad, { once: true });
    editorFrame.srcdoc = html;
  }

  function recordUndo() {
    try {
      const html = serializeCurrentHtml();
      undoStack.push(html);
      // Clear redo on new change
      redoStack = [];
      // keep reasonable size
      if (undoStack.length > 50) undoStack.shift();
    } catch {}
  }

  function refreshBufferList() {
    bufferListEl.innerHTML = '';
    editedBuffer.forEach((_, path) => {
      const li = document.createElement('li');
      li.textContent = path;
      bufferListEl.appendChild(li);
    });
  }

  // Events
  addPathBtn.addEventListener('click', () => {
    const raw = (newPathInput.value || '').trim();
    if (!raw) return;
    // normalize slashes
    const norm = raw.replace(/\\/g, '/');
    if (!initialPaths.includes(norm)) initialPaths.push(norm);
    refreshPagesList();
    newPathInput.value = '';
  });

  if (addComponentBtn) {
    addComponentBtn.addEventListener('click', () => {
      const raw = (newComponentPath.value || '').trim();
      if (!raw) return;
      const norm = raw.replace(/\\/g, '/');
      if (!initialComponents.includes(norm)) initialComponents.push(norm);
      refreshComponentsList();
      newComponentPath.value = '';
    });

    insertComponentBtn.addEventListener('click', async () => {
      const input = componentsListEl.querySelector('input[name="selectedComponentPath"]:checked');
      const path = input ? input.value : '';
      if (!path) { setStatus('Select a component'); return; }
      try {
        const html = await fetchText(ROOT_DIR + path);
        const doc = getFrameDoc();
        const tpl = doc.createElement('template');
        tpl.innerHTML = html;
        const frag = tpl.content.cloneNode(true);
        const target = selectedEl || doc.body;
        recordUndo();
        target.appendChild(frag);
        if (target !== doc.body) selectElement(target);
        setStatus('Component inserted');
      } catch (e) {
        console.error(e);
        setStatus('Insert failed');
      }
    });
  }

  loadBtn.addEventListener('click', async () => {
    const path = getSelectedListPath();
    if (!path) { setStatus('Select a page'); return; }
    try {
      setStatus('Loading...');
      await loadPath(path);
      setStatus('Loaded');
    } catch (e) {
      console.error(e);
      setStatus('Load failed');
    }
  });

  toggleEditable.addEventListener('change', () => {
    applyEditable(toggleEditable.checked);
  });

  selectModeBtn.addEventListener('click', () => {
    selectMode = !selectMode;
    selectModeBtn.textContent = selectMode ? 'Exit Select Mode' : 'Select Element';
    if (!selectMode) clearHighlights();
    syncSelectModeUI();
  });

  applyAttrsBtn.addEventListener('click', applyInspectorToEl);
  deleteElBtn.addEventListener('click', deleteSelectedEl);

  // Insertion and DOM ops
  insertTagBtn.addEventListener('click', () => {
    const tag = (insertTagSelect.value || 'div').toLowerCase();
    const doc = getFrameDoc();
    if (!doc) return;
    const el = doc.createElement(tag);
    el.textContent = tag === 'img' ? '' : `${tag} element`;
    if (tag === 'img') el.setAttribute('alt', '');
    const target = selectedEl || doc.body;
    recordUndo();
    target.appendChild(el);
    selectElement(el);
  });

  wrapWithBtn.addEventListener('click', () => {
    if (!selectedEl) return;
    const doc = getFrameDoc();
    const wrapper = doc.createElement('div');
    recordUndo();
    selectedEl.replaceWith(wrapper);
    wrapper.appendChild(selectedEl);
    selectElement(wrapper);
  });

  moveUpBtn.addEventListener('click', () => {
    if (!selectedEl || !selectedEl.previousElementSibling) return;
    recordUndo();
    selectedEl.parentElement.insertBefore(selectedEl, selectedEl.previousElementSibling);
    setStatus('Moved up');
  });

  moveDownBtn.addEventListener('click', () => {
    if (!selectedEl || !selectedEl.nextElementSibling) return;
    recordUndo();
    selectedEl.parentElement.insertBefore(selectedEl.nextElementSibling, selectedEl);
    setStatus('Moved down');
  });

  duplicateBtn.addEventListener('click', () => {
    if (!selectedEl) return;
    recordUndo();
    const clone = selectedEl.cloneNode(true);
    selectedEl.after(clone);
    selectElement(clone);
    setStatus('Duplicated');
  });

  // Assets
  applyAssetToImgBtn.addEventListener('click', () => {
    if (!selectedEl || selectedEl.tagName.toLowerCase() !== 'img') { setStatus('Select an <img>'); return; }
    const src = (assetPathInput.value || '').trim();
    if (!src) return;
    recordUndo();
    selectedEl.setAttribute('src', src);
    setStatus('Image source updated');
  });

  // Responsive viewport controls
  function applyViewport(width) {
    if (width === 'full') {
      editorFrame.style.width = '100%';
    } else {
      const px = parseInt(width, 10);
      if (!isNaN(px) && px > 0) editorFrame.style.width = px + 'px';
    }
  }
  applyViewportBtn.addEventListener('click', () => {
    const preset = viewportPreset.value;
    const custom = viewportWidth.value.trim();
    const w = custom || preset;
    applyViewport(w);
  });

  // Head editor
  editHeadBtn.addEventListener('click', () => {
    const doc = getFrameDoc();
    if (!doc) return;
    const current = doc.head ? doc.head.innerHTML : '';
    const next = window.prompt('Edit <head> HTML (be careful):', current);
    if (next == null) return;
    recordUndo();
    doc.head.innerHTML = next;
    ensureFrameStyles();
    setStatus('Head updated');
  });

  // Undo/Redo
  undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) { setStatus('Nothing to undo'); return; }
    const current = serializeCurrentHtml();
    const prev = undoStack.pop();
    redoStack.push(current);
    applySnapshot(prev);
    setStatus('Undid');
  });

  redoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) { setStatus('Nothing to redo'); return; }
    const current = serializeCurrentHtml();
    const next = redoStack.pop();
    undoStack.push(current);
    applySnapshot(next);
    setStatus('Redid');
  });

  savePageBtn.addEventListener('click', () => {
    if (!currentPath) { setStatus('No page loaded'); return; }
    const html = serializeCurrentHtml();
    editedBuffer.set(currentPath, html);
    refreshBufferList();
    refreshPagesList();
    setStatus('Saved to buffer');
  });

  revertBtn.addEventListener('click', async () => {
    if (!currentPath) return;
    const orig = originalHtmlCache.get(currentPath);
    editedBuffer.delete(currentPath);
    refreshBufferList();
    try {
      if (orig) {
        // re-inject base and reload
        const baseHref = ROOT_DIR + pathDirname(currentPath);
        const withBase = injectBaseHref(orig, baseHref);
        editorFrame.srcdoc = withBase;
        setStatus('Reverted');
      } else {
        await loadPath(currentPath);
      }
    } catch (e) {
      console.error(e);
      setStatus('Revert failed');
    }
  });

  downloadPageBtn.addEventListener('click', () => {
    if (!currentPath) return;
    const html = cleanForExport(serializeCurrentHtml(), currentPath);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    window.saveAs ? window.saveAs(blob, currentPath.split('/').pop()) : saveAs(blob, currentPath.split('/').pop());
  });

  exportZipBtn.addEventListener('click', async () => {
    if (editedBuffer.size === 0) { setStatus('Nothing to export'); return; }
    setStatus('Zipping...');
    const zip = new JSZip();
    editedBuffer.forEach((html, path) => {
      const clean = cleanForExport(html, path);
      zip.file(path, clean);
    });

    if (includeAssetsCbx && includeAssetsCbx.checked) {
      // Collect asset URLs from edited HTML files
      const assets = new Set();
      editedBuffer.forEach((html, path) => {
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          doc.querySelectorAll('[src],[href]').forEach(el => {
            const attr = el.hasAttribute('src') ? 'src' : 'href';
            const val = el.getAttribute(attr);
            if (!val) return;
            // Skip anchors and mailto etc.
            if (val.startsWith('#') || /^mailto:|^tel:/.test(val)) return;
            // Ignore absolute external http(s) for now
            if (/^https?:\/\//i.test(val)) return;
            assets.add(val);
          });
        } catch {}
      });

      // Fetch assets best-effort from the-website
      for (const a of assets) {
        try {
          const url = ROOT_DIR + a.replace(/^\/?/, '');
          const res = await fetch(url);
          if (!res.ok) continue;
          const blob = await res.blob();
          // Put under assets/ same relative name
          const path = ('assets/' + a).replace(/\\/g, '/');
          zip.file(path, blob);
        } catch {}
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'edited-website.zip');
    setStatus('Exported ZIP');
  });

  if (createPageBtn) {
    createPageBtn.addEventListener('click', () => {
      const name = (newPageName.value || '').trim();
      if (!name) return;
      const norm = name.replace(/\\/g, '/');
      // Simple HTML skeleton
      const skeleton = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${norm}</title>\n</head>\n<body>\n  <main>\n    <h1>${norm}</h1>\n    <p>New page</p>\n  </main>\n</body>\n</html>`;
      editedBuffer.set(norm, skeleton);
      if (!initialPaths.includes(norm)) initialPaths.push(norm);
      refreshPagesList();
      setStatus('New page created in buffer');
      newPageName.value = '';
    });
  }

  // Init
  refreshPagesList();
  refreshComponentsList();
})();
