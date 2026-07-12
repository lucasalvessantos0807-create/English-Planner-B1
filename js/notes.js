import { saveUserData, library } from './storage.js';

/**
 * NOTES & LIBRARY SYSTEM - FULL INTEGRAL VERSION
 */

let currentFolderId = null; // null means Root
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
let currentPageIndex = 0;

// --- 1. LIBRARY MANAGEMENT ---

export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');

    if (!grid) return;
    grid.innerHTML = '';
    
    // Apply layout mode
    grid.className = 'notes-grid ' + (currentLayout === 'list' ? 'list-mode' : '');
    if (isSelectionMode) grid.classList.add('selection-active');

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
            
            const backBtn = document.getElementById('back-to-root');
            if (backBtn) {
                backBtn.onclick = () => {
                    currentFolderId = null;
                    currentView = 'all';
                    renderLibrary();
                };
            }
        }
    }

    // Update Selection Title
    const stTitle = document.getElementById('st-selection-title');
    if (stTitle) {
        stTitle.innerText = selectedItems.size > 0 ? `${selectedItems.size} Selected` : 'Select Items';
    }

    let foldersToShow = [];
    let docsToShow = [];

    const activeFolder = currentFolderId || null;

    if (currentView === 'all') {
        foldersToShow = (library.folders || []).filter(f => (f.parentId || null) === activeFolder);
        docsToShow = (library.documents || []).filter(d => (d.parentId || null) === activeFolder);
    } else if (currentView === 'favorites') {
        docsToShow = (library.documents || []).filter(d => d.favorite);
    } else if (currentView === 'shared') {
        docsToShow = (library.documents || []).filter(d => d.shared);
    }

    // Sorting Logic
    const sortFn = (a, b) => {
        if (currentSort === 'name') return a.name.localeCompare(b.name);
        if (currentSort === 'date') return (a.createdAt || 0) - (b.createdAt || 0);
        if (currentSort === 'modified') return (b.updatedAt || 0) - (a.updatedAt || 0);
        return 0;
    };

    foldersToShow.sort(sortFn);
    docsToShow.sort(sortFn);

    const renderItem = (data, type) => {
        const item = document.createElement('div');
        item.className = 'note-item' + (isSelectionMode ? ' selectable' : '');
        
        let iconContent = '';
        if (type === 'folder') {
            iconContent = `<div class="note-icon folder">📁</div>`;
        } else if (data.pages) { 
            // Thumbnail de Caderno com Capa
            const coverClass = data.coverStyle ? `cover-${data.coverStyle}` : 'cover-solid-blue';
            const bgStyle = data.coverImage ? `background-image: url(${data.coverImage}); background-size: cover;` : '';
            iconContent = `<div class="note-icon notebook-thumbnail ${coverClass}" style="${bgStyle}"></div>`;
        } else {
            iconContent = `<div class="note-icon">📄</div>`;
        }

        const meta = new Date(data.updatedAt || Date.now()).toLocaleDateString();
        
        if (isSelectionMode) {
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'note-checkbox';
            chk.checked = selectedItems.has(data.id);
            chk.onclick = (e) => {
                e.stopPropagation();
                if (chk.checked) selectedItems.add(data.id);
                else selectedItems.delete(data.id);
                renderLibrary();
            };
            item.appendChild(chk);
        }

        item.innerHTML += `
            ${iconContent}
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
                    renderLibrary();
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

    foldersToShow.forEach(f => renderItem(f, 'folder'));
    docsToShow.forEach(d => renderItem(d, 'document'));
}

export function createFolder() {
    const name = prompt("Enter folder name:", "New Folder");
    if (!name) return;
    const newFolder = {
        id: 'fld_' + Date.now(),
        name: name,
        parentId: currentFolderId || null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    if (!library.folders) library.folders = [];
    library.folders.push(newFolder);
    saveLibrary();
}

export function createDocument(type = 'Document', paper = 'Blank') {
    const name = prompt(`Enter ${type} name:`, `Untitled ${type}`);
    if (!name) return;
    const newDoc = {
        id: 'doc_' + Date.now(),
        name: name,
        parentId: currentFolderId || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
        shared: false,
        paperType: paper,
        pages: [null] 
    };
    if (!library.documents) library.documents = [];
    library.documents.push(newDoc);
    saveLibrary();
    openDocument(newDoc);
}

async function saveLibrary() {
    const user = window.auth.currentUser;
    if (user) {
        await saveUserData(user.uid);
        renderLibrary();
    }
}

// --- 2. CANVAS / DRAWING SYSTEM (WITH MULTI-PAGE) ---

function openDocument(doc) {
    currentDoc = doc;
    currentPageIndex = 0;

    // Garante que cadernos novos ou antigos tenham estrutura de páginas
    if (!currentDoc.pages || currentDoc.pages.length === 0) {
        currentDoc.pages = [currentDoc.data || null];
    }

    const notesArea = document.getElementById('notes-area');
    const notesSidebar = document.getElementById('notes-sidebar');
    const docEditor = document.getElementById('doc-editor');
    const docTitle = document.getElementById('current-doc-title');

    if (notesArea) notesArea.style.display = 'none';
    if (notesSidebar) notesSidebar.style.display = 'none';
    if (docEditor) docEditor.style.display = 'flex';
    if (docTitle) docTitle.innerText = doc.name;

    initCanvas();
    loadPage(0);
}

function loadPage(index) {
    if (!ctx || !currentDoc.pages) return;
    currentPageIndex = index;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const canvasEl = document.getElementById('note-canvas');
    if (canvasEl) {
        canvasEl.className = ""; 
        const paperClass = "paper-" + (currentDoc.paperType || "Blank").toLowerCase().replace(/ /g, '-');
        canvasEl.classList.add(paperClass);
    }
    
    if (currentDoc.pages[index]) {
        const img = new Image();
        img.onload = () => { if (ctx) ctx.drawImage(img, 0, 0); };
        img.src = currentDoc.pages[index];
    }
}

// Navegação por Teclado (Setas)
document.addEventListener('keydown', (e) => {
    if (!currentDoc || document.getElementById('doc-editor').style.display === 'none') return;
    
    if (e.key === 'ArrowRight') {
        currentDoc.pages[currentPageIndex] = canvas.toDataURL();
        if (currentPageIndex === currentDoc.pages.length - 1) {
            currentDoc.pages.push(null); // Adiciona nova folha ao chegar no fim
        }
        loadPage(currentPageIndex + 1);
    } else if (e.key === 'ArrowLeft' && currentPageIndex > 0) {
        currentDoc.pages[currentPageIndex] = canvas.toDataURL();
        loadPage(currentPageIndex - 1);
    }
});

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
        ctx.lineWidth = baseWidth;
    } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 30;
    }
    ctx.stroke();
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    isDrawing = false;
    if (currentDoc && canvas) { 
        currentDoc.pages[currentPageIndex] = canvas.toDataURL(); 
    }
}

export function closeEditor() {
    if (currentDoc && canvas) {
        currentDoc.pages[currentPageIndex] = canvas.toDataURL();
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

// --- 3. INITIALIZATION & UI LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    const mainNewBtn = document.getElementById('main-new-btn');
    const newMenu = document.getElementById('new-options-menu');
    const viewOptionsBtn = document.getElementById('view-options-btn');
    const viewMenu = document.getElementById('view-options-menu');

    const closeAllMenus = () => {
        if (newMenu) newMenu.style.display = 'none';
        if (viewMenu) viewMenu.style.display = 'none';
    };

    if (mainNewBtn) {
        mainNewBtn.onclick = (e) => {
            e.stopPropagation();
            if (viewMenu) viewMenu.style.display = 'none';
            const isOpen = newMenu.style.display === 'flex';
            newMenu.style.display = isOpen ? 'none' : 'flex';
        };
    }

    if (viewOptionsBtn) {
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

    // MODO SELEÇÃO: ATIVAÇÃO
    if (btnSelectItems) {
        btnSelectItems.onclick = (e) => {
            e.stopPropagation();
            isSelectionMode = true;
            selectedItems.clear();
            const topbar = document.getElementById('notes-topbar');
            const selectionBar = document.getElementById('selection-toolbar');
            if (topbar) topbar.style.display = 'none';
            if (selectionBar) selectionBar.style.display = 'flex';
            renderLibrary();
            closeAllMenus();
        };
    }

    // MODO SELEÇÃO: FINALIZAÇÃO (DONE)
    const btnDoneSelection = document.getElementById('btn-selection-done');
    if (btnDoneSelection) {
        btnDoneSelection.onclick = () => {
            isSelectionMode = false;
            selectedItems.clear();
            const topbar = document.getElementById('notes-topbar');
            const selectionBar = document.getElementById('selection-toolbar');
            if (topbar) topbar.style.display = 'flex';
            if (selectionBar) selectionBar.style.display = 'none';
            renderLibrary();
        };
    }

    const btnSelectAllItems = document.getElementById('btn-select-all');
    if (btnSelectAllItems) {
        btnSelectAllItems.onclick = () => {
            const allItems = [...(library.folders || []), ...(library.documents || [])];
            if (selectedItems.size >= allItems.length && allItems.length > 0) {
                selectedItems.clear();
            } else {
                allItems.forEach(item => selectedItems.add(item.id));
            }
            renderLibrary();
        };
    }

    // AÇÕES DE SELEÇÃO
    if (document.getElementById('st-trash')) {
        document.getElementById('st-trash').onclick = () => {
            if (selectedItems.size === 0) return;
            if (confirm(`Delete ${selectedItems.size} items?`)) {
                selectedItems.forEach(id => {
                    library.documents = (library.documents || []).filter(d => d.id !== id);
                    library.folders = (library.folders || []).filter(f => f.id !== id);
                });
                saveLibrary();
                selectedItems.clear();
                btnDoneSelection.click();
            }
        };
    }

    if (document.getElementById('st-duplicate')) {
        document.getElementById('st-duplicate').onclick = () => {
            if (selectedItems.size === 0) return;
            selectedItems.forEach(id => {
                const doc = library.documents.find(d => d.id === id);
                if (doc) {
                    const newDoc = JSON.parse(JSON.stringify(doc));
                    newDoc.id = 'doc_' + Date.now() + Math.random();
                    newDoc.name = doc.name + " Copy";
                    library.documents.push(newDoc);
                }
            });
            saveLibrary();
            selectedItems.clear();
            btnDoneSelection.click();
        };
    }

    if (document.getElementById('st-export')) {
        document.getElementById('st-export').onclick = () => {
            if (selectedItems.size === 0) return;
            const selection = {
                documents: library.documents.filter(d => selectedItems.has(d.id)),
                folders: library.folders.filter(f => selectedItems.has(f.id))
            };
            const blob = new Blob([JSON.stringify(selection, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `export_${Date.now()}.json`;
            a.click();
        };
    }

    if (document.getElementById('st-move')) {
        document.getElementById('st-move').onclick = () => {
            if (selectedItems.size === 0) return;
            const dest = prompt("Destination folder name (Leave empty for root):");
            let targetId = null;
            if (dest) {
                const folder = library.folders.find(f => f.name.toLowerCase() === dest.toLowerCase());
                if (folder) targetId = folder.id;
                else { alert("Folder not found."); return; }
            }
            selectedItems.forEach(id => {
                const doc = library.documents.find(d => d.id === id);
                if (doc) doc.parentId = targetId;
                const fld = library.folders.find(f => f.id === id);
                if (fld) fld.parentId = targetId;
            });
            saveLibrary();
            selectedItems.clear();
            btnDoneSelection.click();
        };
    }

    document.querySelectorAll('.sort-opt').forEach(btn => {
        btn.onclick = () => {
            currentSort = btn.dataset.sort;
            updateViewCheckmarks();
            renderLibrary();
            closeAllMenus();
        };
    });

    // LÓGICA DO MODAL DE CADERNO
    const nbModal = document.getElementById('notebook-modal');
    const nbNameInput = document.getElementById('nb-name-input');
    const coverToggle = document.getElementById('nb-cover-toggle');
    const coversSection = document.getElementById('nb-covers-section');
    const papersSection = document.getElementById('nb-papers-selection-section');
    const coverPreviewTrigger = document.getElementById('nb-cover-preview-trigger');
    const paperPreviewTrigger = document.getElementById('nb-paper-preview-trigger');

    // Troca de abas ao clicar nas amostras
    if (coverPreviewTrigger) {
        coverPreviewTrigger.onclick = () => {
            coversSection.style.display = 'block';
            papersSection.style.display = 'none';
        };
    }

    if (paperPreviewTrigger) {
        paperPreviewTrigger.onclick = () => {
            coversSection.style.display = 'none';
            papersSection.style.display = 'block';
        };
    }

    let selectedCoverStyle = 'solid-blue';
    let importedCoverBase64 = null;

    document.querySelectorAll('.nb-cover-card').forEach(card => {
        card.onclick = () => {
            if (card.id === 'nb-import-cover-btn') {
                document.getElementById('nb-cover-upload').click();
                return;
            }
            document.querySelectorAll('.nb-cover-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedCoverStyle = card.dataset.cover;
            importedCoverBase64 = null;
            const preview = document.getElementById('nb-cover-preview-trigger');
            preview.className = 'nb-preview-box cover-' + selectedCoverStyle;
            preview.style.backgroundImage = '';
        };
    });

    const coverUploadInput = document.getElementById('nb-cover-upload');
    if (coverUploadInput) {
        coverUploadInput.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                importedCoverBase64 = event.target.result;
                const preview = document.getElementById('nb-cover-preview-trigger');
                preview.style.backgroundImage = `url(${importedCoverBase64})`;
                preview.style.backgroundSize = 'cover';
            };
            reader.readAsDataURL(file);
        };
    }

    document.querySelectorAll('.nb-paper-card').forEach(card => {
        card.onclick = () => {
            document.querySelectorAll('.nb-paper-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const paper = card.dataset.paper;
            document.getElementById('nb-selected-paper-name').innerText = paper;
            const preview = document.getElementById('nb-paper-preview-trigger');
            preview.className = 'nb-preview-box paper-' + paper.toLowerCase().replace(/ /g, '-');
        };
    });

    const btnNbCreate = document.getElementById('nb-create');
    if (btnNbCreate) {
        btnNbCreate.onclick = () => {
            const name = nbNameInput.value.trim() || "Untitled Notebook";
            const newDoc = {
                id: 'doc_' + Date.now(),
                name: name,
                paperType: document.getElementById('nb-selected-paper-name').innerText,
                coverStyle: coverToggle.checked ? selectedCoverStyle : null,
                coverImage: importedCoverBase64,
                pages: [null], 
                parentId: currentFolderId || null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            if (!library.documents) library.documents = [];
            library.documents.push(newDoc);
            saveLibrary();
            nbModal.style.display = 'none';
            openDocument(newDoc);
        };
    }

    const btnNbCancel = document.getElementById('nb-cancel');
    if (btnNbCancel) btnNbCancel.onclick = () => { nbModal.style.display = 'none'; };

    const btnNewNotebook = document.getElementById('btn-new-notebook');
    if (btnNewNotebook) {
        btnNewNotebook.onclick = () => { 
            closeAllMenus(); 
            nbModal.style.display = 'flex'; 
            nbNameInput.value = "";
            coversSection.style.display = 'none';
            papersSection.style.display = 'none';
        };
    }

    const btnNewTextDoc = document.getElementById('btn-new-text-doc');
    if (btnNewTextDoc) btnNewTextDoc.onclick = () => { closeAllMenus(); createDocument('Text Document'); };

    const btnCreateFolder = document.getElementById('btn-create-folder');
    if (btnCreateFolder) btnCreateFolder.onclick = () => { closeAllMenus(); createFolder(); };

    const closeEditorBtn = document.getElementById('close-editor-btn');
    if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
    
    const saveEditorBtn = document.getElementById('save-doc-btn');
    if (saveEditorBtn) saveEditorBtn.onclick = closeEditor;

    // TOOLBAR TOOLS
    document.getElementById('tool-pen').onclick = () => {
        currentTool = 'pen';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tool-pen').classList.add('active');
    };
    document.getElementById('tool-eraser').onclick = () => {
        currentTool = 'eraser';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tool-eraser').classList.add('active');
    };

    const navAll = document.getElementById('nav-all-docs');
    const navFav = document.getElementById('nav-favorites');
    const navShared = document.getElementById('nav-shared');

    if (navAll) navAll.onclick = () => { currentFolderId = null; currentView = 'all'; renderLibrary(); };
    if (navFav) navFav.onclick = () => { currentView = 'favorites'; renderLibrary(); };
    if (navShared) navShared.onclick = () => { currentView = 'shared'; renderLibrary(); };

    updateViewCheckmarks();
    renderLibrary();
});
