import { saveUserData, library } from './storage.js';

/**
 * NOTES & LIBRARY SYSTEM
 */

let currentFolderId = null; // null means Root
let isDrawing = false;
let currentTool = 'pen';
let canvas, ctx;
let lastX = 0;
let lastY = 0;
let currentDoc = null;
let currentPageIndex = 0; 
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
    
    // Apply layout mode
    grid.className = 'notes-grid ' + (currentLayout === 'list' ? 'list-mode' : '');
    if (isSelectionMode) grid.classList.add('selection-active');
    const stTitle = document.getElementById('st-selection-title');
    if (stTitle) {
        stTitle.innerText = selectedItems.size > 0 ? `${selectedItems.size} Selected` : 'Select Items';
    }

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

    let foldersToShow = [];
    let docsToShow = [];

    // Helper to normalize parentId comparison
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
        
        const isNotebook = data.paperType ? true : false;
        const icon = type === 'folder' ? '📁' : (isNotebook ? '📓' : '📄');
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
        pages: [null],
        updatedAt: Date.now()
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

// --- 2. CANVAS & MULTI-PAGE DRAWING SYSTEM ---

function openDocument(doc) {
    currentDoc = doc;
    
    // Migração de dados: Se o documento tinha 'data' (formato antigo) e não tem 'pages', converte para array
    if (!currentDoc.pages) {
        currentDoc.pages = currentDoc.data ? [currentDoc.data] : [null];
    }
    currentPageIndex = 0;

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
    
    renderPage();
}

function renderPage() {
    if (!ctx || !canvas || !currentDoc) return;
    
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    
    const pageData = currentDoc.pages[currentPageIndex];
    if (pageData) {
        const img = new Image();
        img.onload = () => { 
            ctx.drawImage(img, 0, 0, 850, 1100); 
        };
        img.src = pageData;
    }
    
    const counter = document.getElementById('page-counter');
    if (counter) {
        counter.innerText = `Page ${currentPageIndex + 1} / ${currentDoc.pages.length}`;
    }
}

function saveCurrentPage() {
    if (currentDoc && canvas) {
        currentDoc.pages[currentPageIndex] = canvas.toDataURL();
    }
}

export function nextPage() {
    if (!currentDoc || currentPageIndex >= currentDoc.pages.length - 1) return;
    saveCurrentPage();
    currentPageIndex++;
    renderPage();
}

export function prevPage() {
    if (!currentDoc || currentPageIndex <= 0) return;
    saveCurrentPage();
    currentPageIndex--;
    renderPage();
}

export function addNewPage() {
    if (!currentDoc) return;
    saveCurrentPage();
    currentDoc.pages.push(null);
    currentPageIndex = currentDoc.pages.length - 1;
    renderPage();
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
    saveCurrentPage();
}

export function closeEditor() {
    if (currentDoc && canvas) {
        saveCurrentPage();
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
                if (btnDoneSelection) btnDoneSelection.click();
            }
        };
    }

    if (document.getElementById('st-duplicate')) {
        document.getElementById('st-duplicate').onclick = () => {
            if (selectedItems.size === 0) return;
            selectedItems.forEach(id => {
                const docToCopy = library.documents.find(d => d.id === id);
                if (docToCopy) {
                    const newDoc = JSON.parse(JSON.stringify(docToCopy));
                    newDoc.id = 'doc_' + Date.now() + Math.floor(Math.random() * 1000);
                    newDoc.name = docToCopy.name + " Copy";
                    newDoc.updatedAt = Date.now();
                    library.documents.push(newDoc);
                }
            });
            saveLibrary();
            selectedItems.clear();
            if (btnDoneSelection) btnDoneSelection.click();
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
            if (btnDoneSelection) btnDoneSelection.click();
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
                parentId: currentFolderId || null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                favorite: false,
                shared: false,
                pages: [null],
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

    const btnNewNotebook = document.getElementById('btn-new-notebook');
    const btnNewTextDoc = document.getElementById('btn-new-text-doc');
    const btnCreateFolder = document.getElementById('btn-create-folder');

    if (btnNewNotebook) btnNewNotebook.onclick = () => { 
        closeAllMenus(); 
        if (nbModal) nbModal.style.display = 'flex'; 
        if (nbNameInput) nbNameInput.value = "";
    };
    if (btnNewTextDoc) btnNewTextDoc.onclick = () => { closeAllMenus(); createDocument('Text Document'); };
    if (btnCreateFolder) btnCreateFolder.onclick = () => { closeAllMenus(); createFolder(); };

    const closeEditorBtn = document.getElementById('close-editor-btn');
    if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
    
    const saveEditorBtn = document.getElementById('save-doc-btn');
    if (saveEditorBtn) saveEditorBtn.onclick = closeEditor;

    const btnNext = document.getElementById('next-page-btn');
    const btnPrev = document.getElementById('prev-page-btn');
    const btnAddPage = document.getElementById('add-page-btn');

    if (btnNext) btnNext.onclick = nextPage;
    if (btnPrev) btnPrev.onclick = prevPage;
    if (btnAddPage) btnAddPage.onclick = addNewPage;

    let touchStartX = 0;
    const canvasEl = document.getElementById('note-canvas');
    if (canvasEl) {
        canvasEl.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        canvasEl.addEventListener('touchend', (e) => {
            let touchEndX = e.changedTouches[0].screenX;
            let diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) { 
                if (diff > 0) nextPage();
                else prevPage();
            }
        }, { passive: true });
    }

    const navAll = document.getElementById('nav-all-docs');
    const navFav = document.getElementById('nav-favorites');
    const navShared = document.getElementById('nav-shared');

    if (navAll) navAll.onclick = () => { currentFolderId = null; currentView = 'all'; renderLibrary(); };
    if (navFav) navFav.onclick = () => { currentView = 'favorites'; renderLibrary(); };
    if (navShared) navShared.onclick = () => { currentView = 'shared'; renderLibrary(); };

    updateViewCheckmarks();
    renderLibrary();
});
