import { saveUserData, library } from './storage.js';

/**
 * NOTES & LIBRARY SYSTEM
 */

let currentFolderId = null; // null = Root
let isDrawing = false;
let currentTool = 'pen';
let canvas, ctx;
let lastX = 0;
let lastY = 0;
let currentDoc = null;
let currentView = 'all'; // 'all', 'favorites', 'shared'
let currentLayout = 'grid'; // 'grid' or 'list'
let currentSort = 'modified'; // 'name', 'date', 'modified', 'type'
let isSelectionMode = false;
let selectedItems = new Set();

// --- 1. LIBRARY MANAGEMENT ---

export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');

    if (!grid) return;
    grid.innerHTML = '';
    
    // Define o layout da grade
    grid.className = 'notes-grid ' + (currentLayout === 'list' ? 'list-mode' : '');
    if (isSelectionMode) grid.classList.add('selection-active');

    // Gerencia o Breadcrumb (Caminho de navegação)
    if (breadcrumb) {
        if (currentView === 'favorites') {
            breadcrumb.innerText = 'Favorites';
        } else if (currentView === 'shared') {
            breadcrumb.innerText = 'Shared Documents';
        } else if (!currentFolderId) {
            breadcrumb.innerText = 'Documents';
        } else {
            const folder = (library.folders || []).find(f => f.id === currentFolderId);
            breadcrumb.innerHTML = `<span style="cursor:pointer; color:var(--accent);" id="back-to-root">Documents</span> / ${folder ? folder.name : 'Unknown'}`;
            const btnBack = document.getElementById('back-to-root');
            if (btnBack) {
                btnBack.onclick = () => {
                    currentFolderId = null;
                    currentView = 'all';
                    renderLibrary();
                };
            }
        }
    }

    // Filtra pastas e documentos com base na pasta atual ou visão
    let foldersToShow = [];
    let docsToShow = [];

    if (currentView === 'all') {
        // Usa == para capturar tanto null quanto undefined se necessário
        foldersToShow = (library.folders || []).filter(f => f.parentId == currentFolderId);
        docsToShow = (library.documents || []).filter(d => d.parentId == currentFolderId);
    } else if (currentView === 'favorites') {
        docsToShow = (library.documents || []).filter(d => d.favorite);
    } else if (currentView === 'shared') {
        docsToShow = (library.documents || []).filter(d => d.shared);
    }

    // Lógica de Ordenação
    const sortFn = (a, b) => {
        if (currentSort === 'name') return a.name.localeCompare(b.name);
        if (currentSort === 'date') return (a.createdAt || 0) - (b.createdAt || 0);
        if (currentSort === 'modified') return (b.updatedAt || 0) - (a.updatedAt || 0);
        return 0;
    };

    foldersToShow.sort(sortFn);
    docsToShow.sort(sortFn);

    // Função interna para renderizar cada item
    const renderItem = (data, type) => {
        const item = document.createElement('div');
        item.className = 'note-item' + (isSelectionMode ? ' selectable' : '');
        
        const isNotebook = data.paperType ? true : false;
        const icon = type === 'folder' ? '📁' : (isNotebook ? '📓' : '📄');
        const meta = new Date(data.updatedAt || Date.now()).toLocaleDateString();
        
        // Se estiver em modo de seleção, adiciona checkbox
        if (isSelectionMode) {
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'note-checkbox';
            chk.checked = selectedItems.has(data.id);
            chk.onclick = (e) => {
                e.stopPropagation();
                if (chk.checked) selectedItems.add(data.id);
                else selectedItems.delete(data.id);
            };
            item.appendChild(chk);
        }

        item.innerHTML += `
            <div class="note-icon ${type === 'folder' ? 'folder' : ''}">${icon}</div>
            <div class="note-name">${data.name}</div>
            <div class="note-meta" style="font-size:10px; color:var(--muted);">${meta}</div>
        `;

        item.onclick = () => {
            if (isSelectionMode) {
                const chk = item.querySelector('.note-checkbox');
                if (chk) {
                    chk.checked = !chk.checked;
                    if (chk.checked) selectedItems.add(data.id);
                    else selectedItems.delete(data.id);
                }
                return;
            }
            if (type === 'folder') { 
                currentFolderId = data.id; 
                renderLibrary(); 
            } else {
                openDocument(data);
            }
        };
        grid.appendChild(item);
    };

    // Primeiro renderiza pastas, depois documentos
    foldersToShow.forEach(f => renderItem(f, 'folder'));
    docsToShow.forEach(d => renderItem(d, 'document'));
}

export function createFolder() {
    const name = prompt("Enter folder name:", "New Folder");
    if (!name) return;
    const newFolder = {
        id: 'fld_' + Date.now(),
        name: name,
        parentId: currentFolderId,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    if (!library.folders) library.folders = [];
    library.folders.push(newFolder);
    saveLibrary();
}

export function createDocument() {
    const name = prompt("Enter document name:", "Untitled Note");
    if (!name) return;
    const newDoc = {
        id: 'doc_' + Date.now(),
        name: name,
        parentId: currentFolderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
        shared: false,
        paperType: 'Blank',
        data: null 
    };
    if (!library.documents) library.documents = [];
    library.documents.push(newDoc);
    saveLibrary();
    openDocument(newDoc);
}

function deleteDocument(id) {
    library.documents = (library.documents || []).filter(d => d.id !== id);
    saveLibrary();
}

function deleteFolder(id) {
    library.documents = (library.documents || []).filter(d => d.parentId !== id);
    library.folders = (library.folders || []).filter(f => f.id !== id);
    saveLibrary();
}

async function saveLibrary() {
    const user = window.auth.currentUser;
    if (user) {
        await saveUserData(user.uid);
        renderLibrary();
    }
}

// --- 2. CANVAS / DRAWING SYSTEM ---

function openDocument(doc) {
    currentDoc = doc;
    const notesArea = document.getElementById('notes-area');
    const notesSidebar = document.getElementById('notes-sidebar');
    const docEditor = document.getElementById('doc-editor');
    const docTitle = document.getElementById('current-doc-title');

    if (notesArea) notesArea.style.display = 'none';
    if (notesSidebar) notesSidebar.style.display = 'none';
    if (docEditor) docEditor.style.display = 'flex';
    if (docTitle) docTitle.innerText = doc.name;

    initCanvas();

    const canvasEl = document.getElementById('note-canvas');
    if (canvasEl) {
        canvasEl.className = ""; 
        const paperClass = "paper-" + (doc.paperType || "Blank").toLowerCase().replace(/ /g, '-');
        canvasEl.classList.add(paperClass);
    }
    
    if (doc.data) {
        const img = new Image();
        img.onload = () => { if (ctx) ctx.drawImage(img, 0, 0); };
        img.src = doc.data;
    }
}

function initCanvas() {
    canvas = document.getElementById('note-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 850 * ratio;
    canvas.height = 1100 * ratio;
    canvas.style.width = '850px';
    canvas.style.height = '1100px';
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = (e.clientX - rect.left);
    lastY = (e.clientY - rect.top);
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);

    if (currentTool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        const penColor = document.getElementById('pen-color');
        ctx.strokeStyle = penColor ? penColor.value : "#000000";
        const penWidth = document.getElementById('pen-width');
        const baseWidth = penWidth ? penWidth.value : 2;
        const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 1;
        ctx.lineWidth = baseWidth * pressure;
    } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 30;
    }
    ctx.stroke();
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    isDrawing = false;
    if (currentDoc && canvas) { currentDoc.data = canvas.toDataURL(); }
}

export function closeEditor() {
    if (currentDoc && canvas) {
        currentDoc.data = canvas.toDataURL();
        currentDoc.updatedAt = Date.now();
        saveLibrary();
    }
    const docEditor = document.getElementById('doc-editor');
    const notesArea = document.getElementById('notes-area');
    const notesSidebar = document.getElementById('notes-sidebar');
    if (docEditor) docEditor.style.display = 'none';
    if (notesArea) notesArea.style.display = 'flex';
    if (notesSidebar) notesSidebar.style.display = 'flex';
    currentDoc = null;
}

export function exportLibrary() {
    const dataStr = JSON.stringify(library, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `library_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- 3. INITIALIZATION & UI LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    const mainNewBtn = document.getElementById('main-new-btn');
    const newMenu = document.getElementById('new-options-menu');
    const viewOptionsBtn = document.getElementById('view-options-btn');
    const viewMenu = document.getElementById('view-options-menu');
    const sortSelect = document.getElementById('sort-docs-select');

    // Menus Toggle Logic
    const closeAllMenus = () => {
        if (newMenu) newMenu.style.display = 'none';
        if (viewMenu) viewMenu.style.display = 'none';
    };

    if (mainNewBtn && newMenu) {
        mainNewBtn.onclick = (e) => {
            e.stopPropagation();
            if (viewMenu) viewMenu.style.display = 'none';
            const isOpen = newMenu.style.display === 'flex';
            newMenu.style.display = isOpen ? 'none' : 'flex';
        };
    }

    if (viewOptionsBtn && viewMenu) {
        viewOptionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (newMenu) newMenu.style.display = 'none';
            const isOpen = viewMenu.style.display === 'flex';
            viewMenu.style.display = isOpen ? 'none' : 'flex';
        };
    }

    document.addEventListener('click', (e) => {
        if (newMenu && !newMenu.contains(e.target) && e.target !== mainNewBtn) newMenu.style.display = 'none';
        if (viewMenu && !viewMenu.contains(e.target) && e.target !== viewOptionsBtn) viewMenu.style.display = 'none';
    });

    // --- VIEW OPTIONS LOGIC ---
    const btnGridView = document.getElementById('btn-view-grid');
    const btnListView = document.getElementById('btn-view-list');
    const btnSelectItems = document.getElementById('btn-select-items');

    const updateViewCheckmarks = () => {
        if (btnGridView) btnGridView.querySelector('.vlist-check').style.visibility = currentLayout === 'grid' ? 'visible' : 'hidden';
        if (btnListView) btnListView.querySelector('.vlist-check').style.visibility = currentLayout === 'list' ? 'visible' : 'hidden';
        document.querySelectorAll('.sort-opt').forEach(btn => {
            const check = btn.querySelector('.vlist-check');
            if (check) check.style.visibility = currentSort === btn.dataset.sort ? 'visible' : 'hidden';
        });
    };

    if (btnGridView) btnGridView.onclick = () => {
        currentLayout = 'grid';
        updateViewCheckmarks();
        renderLibrary();
        closeAllMenus();
    };

    if (btnListView) btnListView.onclick = () => {
        currentLayout = 'list';
        updateViewCheckmarks();
        renderLibrary();
        closeAllMenus();
    };

    if (btnSelectItems) btnSelectItems.onclick = () => {
        isSelectionMode = !isSelectionMode;
        selectedItems.clear();
        renderLibrary();
        closeAllMenus();
    };

    document.querySelectorAll('.sort-opt').forEach(btn => {
        btn.onclick = () => {
            currentSort = btn.dataset.sort;
            updateViewCheckmarks();
            renderLibrary();
            closeAllMenus();
        };
    });

    // Notebook Modal Logic
    const nbModal = document.getElementById('notebook-modal');
    const nbCancel = document.getElementById('nb-cancel');
    const nbCreate = document.getElementById('nb-create');
    const nbNameInput = document.getElementById('nb-name-input');
    const nbPaperPreview = document.getElementById('nb-paper-preview');
    const nbSelectedPaperName = document.getElementById('nb-selected-paper-name');
    const paperCards = document.querySelectorAll('.nb-paper-card');

    if (nbCancel) nbCancel.onclick = () => { if (nbModal) nbModal.style.display = 'none'; };

    if (nbCreate) {
        nbCreate.onclick = () => {
            const name = nbNameInput.value.trim() || "Untitled Notebook";
            const paperType = nbSelectedPaperName.innerText;
            const newDoc = {
                id: 'doc_' + Date.now(),
                name: name,
                paperType: paperType,
                parentId: currentFolderId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                favorite: false,
                shared: false,
                data: null 
            };
            if (!library.documents) library.documents = [];
            library.documents.push(newDoc);
            saveLibrary();
            if (nbModal) nbModal.style.display = 'none';
            openDocument(newDoc);
        };
    }

    paperCards.forEach(card => {
        card.onclick = () => {
            paperCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const paper = card.dataset.paper;
            if (nbSelectedPaperName) nbSelectedPaperName.innerText = paper;
            const paperClass = "paper-" + paper.toLowerCase().replace(/ /g, '-');
            if (nbPaperPreview) { nbPaperPreview.className = 'nb-preview-box ' + paperClass; }
        };
    });

    // Menu Item Click Handlers
    const btnNewNotebook = document.getElementById('btn-new-notebook');
    const btnNewTextDoc = document.getElementById('btn-new-text-doc');
    const btnCreateFolder = document.getElementById('btn-create-folder');

    if (btnNewNotebook) btnNewNotebook.onclick = () => { 
        closeAllMenus(); 
        if (nbModal) nbModal.style.display = 'flex'; 
        if (nbNameInput) nbNameInput.value = "";
    };
    if (btnNewTextDoc) btnNewTextDoc.onclick = () => { closeAllMenus(); createDocument(); };
    if (btnCreateFolder) btnCreateFolder.onclick = () => { closeAllMenus(); createFolder(); };

    // Other UI controls
    if (sortSelect) sortSelect.onchange = (e) => { currentSort = e.target.value === 'name' ? 'name' : 'modified'; renderLibrary(); };
    
    const closeEditorBtn = document.getElementById('close-editor-btn');
    if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
    
    const saveEditorBtn = document.getElementById('save-doc-btn');
    if (saveEditorBtn) saveEditorBtn.onclick = closeEditor;

    const navAll = document.getElementById('nav-all-docs');
    const navFav = document.getElementById('nav-favorites');
    const navShared = document.getElementById('nav-shared');

    if (navAll) navAll.onclick = () => { currentFolderId = null; currentView = 'all'; renderLibrary(); };
    if (navFav) navFav.onclick = () => { currentView = 'favorites'; renderLibrary(); };
    if (navShared) navShared.onclick = () => { currentView = 'shared'; renderLibrary(); };

    // Initial Sync
    updateViewCheckmarks();
});
