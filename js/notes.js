import { saveUserData, library } from './storage.js';

/**
 * NOTES & LIBRARY SYSTEM - INTEGRAL VERSION
 */

let currentFolderId = null; 
let isDrawing = false;
let currentTool = 'pen';
let canvas, ctx;
let lastX = 0;
let lastY = 0;
let currentDoc = null;
let currentPageIndex = 0; 
export let currentView = 'all'; 
let currentLayout = 'grid'; 
export let currentSort = 'modified'; 
export let isSelectionMode = false;
export let selectedItems = new Set();

// Helper para detectar se uma cor é escura
function isColorDark(color) {
    if (!color) return false;
    const c = color.toLowerCase();
    if (c === 'dark') return true;
    if (c === 'white' || c === 'yellow' || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return false;
    
    let r, g, b;
    if (c.startsWith('#')) {
        const hex = c.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else if (c.startsWith('rgb')) {
        const parts = c.match(/\d+/g);
        if (!parts) return false;
        r = parseInt(parts[0]);
        g = parseInt(parts[1]);
        b = parseInt(parts[2]);
    } else { 
        return false; 
    }
    // Luminância padrão para contraste
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 100;
}

// --- 1. LIBRARY MANAGEMENT ---

export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');

    if (!grid) return;
    grid.innerHTML = '';
    
    grid.className = 'notes-grid ' + (currentLayout === 'list' ? 'list-mode' : '');
    if (isSelectionMode) grid.classList.add('selection-active');
    
    updateSelectionUI();

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
    const activeFolder = currentFolderId || null;

    if (currentView === 'all') {
        foldersToShow = (library.folders || []).filter(f => (f.parentId || null) === activeFolder);
        docsToShow = (library.documents || []).filter(d => (d.parentId || null) === activeFolder);
    } else if (currentView === 'favorites') {
        docsToShow = (library.documents || []).filter(d => d.favorite);
    } else if (currentView === 'shared') {
        docsToShow = (library.documents || []).filter(d => d.shared);
    }

    const sortFn = (a, b) => {
        if (currentSort === 'name') return a.name.localeCompare(b.name);
        if (currentSort === 'date') return (a.createdAt || 0) - (b.createdAt || 0);
        if (currentSort === 'modified') return (b.updatedAt || 0) - (a.updatedAt || 0);
        if (currentSort === 'type') return 0;
        return 0;
    };

    foldersToShow.sort(sortFn);
    docsToShow.sort(sortFn);

    const renderItem = (data, type) => {
        const item = document.createElement('div');
        item.className = 'note-item' + (isSelectionMode ? ' selectable' : '');
        
        const isNotebook = data.paperType ? true : false;
        const meta = new Date(data.updatedAt || Date.now()).toLocaleDateString();
        
        let iconHtml = '';
        if (type === 'folder') {
            iconHtml = `<div class="note-icon folder">📁</div>`;
        } else if (isNotebook) {
            iconHtml = `
                <div class="note-icon notebook-thumbnail cover-solid-blue">
                    <div class="thumb-title">${data.name}</div>
                </div>`;
        } else {
            iconHtml = `<div class="note-icon">📄</div>`;
        }

        if (isSelectionMode) {
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'note-checkbox';
            chk.checked = selectedItems.has(data.id);
            chk.onclick = (e) => {
                e.stopPropagation();
                if (chk.checked) selectedItems.add(data.id);
                else selectedItems.delete(data.id);
                updateSelectionUI();
            };
            item.appendChild(chk);
        }

        // Using insertAdjacentHTML to avoid destroying checkbox properties set above
        item.insertAdjacentHTML('beforeend', `
            ${iconHtml}
            <div class="note-name">${data.name}</div>
            <div class="note-meta" style="font-size:10px; color:var(--muted);">${meta}</div>
        `);

        item.onclick = () => {
            if (isSelectionMode) {
                const chk = item.querySelector('.note-checkbox');
                if (chk) {
                    chk.checked = !chk.checked;
                    if (chk.checked) selectedItems.add(data.id);
                    else selectedItems.delete(data.id);
                    updateSelectionUI();
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

export function createDocument(type = 'Document', paper = 'Blank', customName = null) {
    let name = customName;
    if (!name) {
        name = prompt(`Enter ${type} name:`, `Untitled ${type}`);
    }
    if (!name) return;

    const size = document.getElementById('nb-size-select')?.value || 'goodnotes';
    const orientation = document.querySelector('.nb-orient-btn.active')?.dataset.orientation || 'portrait';
    
    const activeColorOpt = document.querySelector('.nb-color-option.active');
    let paperColor = 'white';
    if (activeColorOpt) {
        if (activeColorOpt.dataset.color === 'custom') {
            paperColor = document.getElementById('nb-custom-color-input').value;
        } else {
            paperColor = activeColorOpt.dataset.color;
        }
    }

    const newDoc = {
        id: 'doc_' + Date.now() + Math.random().toString(36).substr(2, 5),
        name: name,
        parentId: currentFolderId || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
        shared: false,
        paperType: paper,
        paperSize: size,
        orientation: orientation,
        paperColor: paperColor,
        pages: [null, null], 
        updatedAt: Date.now()
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

// --- 2. CANVAS & MULTI-PAGE SYSTEM ---

function openDocument(doc) {
    currentDoc = doc;
    if (!currentDoc.pages || currentDoc.pages.length === 0) {
        currentDoc.pages = [null, null];
    } else if (currentDoc.pages.length === 1) {
        currentDoc.pages.push(null);
    }
    currentPageIndex = 0; 
    document.getElementById('notes-area').style.display = 'none';
    document.getElementById('notes-sidebar').style.display = 'none';
    document.getElementById('planner-content').style.display = 'none';
    document.getElementById('doc-editor').style.display = 'flex';
    const titleEl = document.getElementById('editor-doc-title');
    if (titleEl) titleEl.innerText = doc.name;
    initCanvas();
    renderPage();
}

function renderPage() {
    if (!ctx || !canvas || !currentDoc) return;
    const ratio = window.devicePixelRatio || 1;
    
    const isLandscape = currentDoc.orientation === 'landscape';
    const baseW = isLandscape ? 1100 : 850;
    const baseH = isLandscape ? 850 : 1100;
    
    canvas.width = baseW * ratio;
    canvas.height = baseH * ratio;
    canvas.style.width = baseW + 'px';
    canvas.style.height = baseH + 'px';

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, baseW, baseH);
    
    const canvasEl = document.getElementById('note-canvas');
    if (canvasEl) {
        canvasEl.className = ""; 
        canvasEl.classList.remove('dark-paper'); 

        let bgColor = "#ffffff";
        if (currentPageIndex === 0) {
            bgColor = "#2a4f8a"; 
        } else {
            if (currentDoc.paperColor === 'yellow') bgColor = "#fdf5e0";
            else if (currentDoc.paperColor === 'dark') bgColor = "#1a1814";
            else if (currentDoc.paperColor && currentDoc.paperColor.startsWith('#')) bgColor = currentDoc.paperColor;
        }

        // Apply background color to the element style so CSS background-patterns are visible
        canvasEl.style.backgroundColor = bgColor;

        if (isColorDark(bgColor)) {
            canvasEl.classList.add('dark-paper');
        } else {
            canvasEl.classList.remove('dark-paper');
        }

        if (currentPageIndex === 0) {
            // For the cover, we fill the canvas bitmap so it's solid
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, baseW, baseH);
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.font = "bold 45px Georgia";
            ctx.fillText(currentDoc.name, baseW / 2, baseH / 2 - 50);
            ctx.font = "italic 20px Georgia";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText("Notebook Collection", baseW / 2, baseH / 2);
        } else {
            const paperClass = "paper-" + (currentDoc.paperType || "Blank").toLowerCase().replace(/ /g, '-');
            canvasEl.classList.add(paperClass);

            const pageData = currentDoc.pages[currentPageIndex];
            if (pageData) {
                const img = new Image();
                img.onload = () => { ctx.drawImage(img, 0, 0, baseW, baseH); };
                img.src = pageData;
            }
        }
    }
    
    const indicator = document.getElementById('page-indicator-text');
    if (indicator) {
        indicator.innerText = `${currentPageIndex + 1} de ${currentDoc.pages.length}`;
    }
}

function saveCurrentPage() {
    if (currentDoc && canvas && currentPageIndex !== 0) {
        currentDoc.pages[currentPageIndex] = canvas.toDataURL();
    }
}

export function nextPage() {
    if (!currentDoc) return;
    saveCurrentPage();
    if (currentPageIndex === currentDoc.pages.length - 1) {
        currentDoc.pages.push(null);
    }
    currentPageIndex++;
    renderPage();
    currentDoc.updatedAt = Date.now();
    saveLibrary();
}

export function prevPage() {
    if (!currentDoc || currentPageIndex <= 0) return;
    saveCurrentPage();
    currentPageIndex--;
    renderPage();
    currentDoc.updatedAt = Date.now();
    saveLibrary();
}

function initCanvas() {
    canvas = document.getElementById('note-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
}

function startDrawing(e) {
    if (currentPageIndex === 0) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const isLandscape = currentDoc.orientation === 'landscape';
    const baseW = isLandscape ? 1100 : 850;
    const baseH = isLandscape ? 850 : 1100;
    
    lastX = (e.clientX - rect.left) * (baseW / rect.width);
    lastY = (e.clientY - rect.top) * (baseH / rect.height);
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const isLandscape = currentDoc.orientation === 'landscape';
    const baseW = isLandscape ? 1100 : 850;
    const baseH = isLandscape ? 850 : 1100;

    const x = (e.clientX - rect.left) * (baseW / rect.width);
    const y = (e.clientY - rect.top) * (baseH / rect.height);
    
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
    if (docEditor) docEditor.style.display = 'none';
    document.getElementById('notes-area').style.display = 'flex';
    document.getElementById('notes-sidebar').style.display = 'flex';
    document.getElementById('planner-content').style.display = 'none'; 
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

export function deleteCurrentPage() {
    if (!currentDoc || currentDoc.pages.length <= 2) {
        alert("A notebook must have at least a cover and one page.");
        return;
    }
    if (currentPageIndex === 0) {
        alert("You cannot delete the cover page.");
        return;
    }
    if (confirm("Permanently delete this page?")) {
        currentDoc.pages.splice(currentPageIndex, 1);
        if (currentPageIndex >= currentDoc.pages.length) {
            currentPageIndex = currentDoc.pages.length - 1;
        }
        renderPage();
        saveLibrary();
    }
}

export function toggleReadOnly() {
    const btn = document.getElementById('btn-toggle-read-only');
    const isLocked = btn.innerText.includes('Unlock');
    
    if (!isLocked) {
        btn.innerHTML = '🔓 Unlock Editing';
        canvas.removeEventListener('pointerdown', startDrawing);
        canvas.style.cursor = 'default';
    } else {
        btn.innerHTML = '🔒 Read Only Mode';
        canvas.addEventListener('pointerdown', startDrawing);
        canvas.style.cursor = 'crosshair';
    }
}

// --- 3. INITIALIZATION & GESTURE SYSTEM ---

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', (e) => {
        const editor = document.getElementById('doc-editor');
        if (editor && editor.style.display === 'flex') {
            if (e.key === 'ArrowRight') nextPage();
            else if (e.key === 'ArrowLeft') prevPage();
        }
    });

    const mainNewBtn = document.getElementById('main-new-btn');
    const newMenu = document.getElementById('new-options-menu');
    const viewOptionsBtn = document.getElementById('view-options-btn');
    const viewMenu = document.getElementById('view-options-menu');
    const nbModal = document.getElementById('notebook-modal');

    const closeAllMenus = () => {
        if (newMenu) newMenu.style.display = 'none';
        if (viewMenu) viewMenu.style.display = 'none';
    };

    if (mainNewBtn && newMenu) {
        mainNewBtn.onclick = (e) => {
            e.stopPropagation();
            if (viewMenu) viewMenu.style.display = 'none';
            const isNewMenuOpen = newMenu.style.display === 'flex';
            newMenu.style.display = isNewMenuOpen ? 'none' : 'flex';
        };
    }

    if (viewOptionsBtn && viewMenu) {
        viewOptionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (newMenu) newMenu.style.display = 'none';
            const isViewMenuOpen = viewMenu.style.display === 'flex';
            viewMenu.style.display = isViewMenuOpen ? 'none' : 'flex';
        };
    }

    document.addEventListener('click', (e) => {
        if (newMenu && !newMenu.contains(e.target) && e.target !== mainNewBtn) newMenu.style.display = 'none';
        if (viewMenu && !viewMenu.contains(e.target) && e.target !== viewOptionsBtn) viewMenu.style.display = 'none';
    });

    const paperCards = document.querySelectorAll('.nb-paper-card');
    paperCards.forEach(card => {
        card.onclick = () => {
            paperCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const paper = card.dataset.paper;
            const nbSelectedPaperName = document.getElementById('nb-selected-paper-name');
            const nbPaperPreview = document.getElementById('nb-paper-preview-trigger');
            if (nbSelectedPaperName) nbSelectedPaperName.innerText = paper;
            if (nbPaperPreview) {
                nbPaperPreview.classList.remove('paper-blank', 'paper-dotted', 'paper-squared', 'paper-narrow-ruled', 'paper-wide-ruled', 'paper-cornell', 'paper-legal', 'paper-single-column', 'paper-three-columns');
                const paperClass = "paper-" + paper.toLowerCase().replace(/ /g, '-');
                nbPaperPreview.classList.add(paperClass);
            }
        };
    });

    const nbCancel = document.getElementById('nb-cancel');
    const nbCreate = document.getElementById('nb-create');

    if (nbCancel) nbCancel.onclick = () => { if (nbModal) nbModal.style.display = 'none'; };

    if (nbCreate) {
        nbCreate.onclick = () => {
            const nbNameInput = document.getElementById('nb-name-input');
            const nbSelectedPaperName = document.getElementById('nb-selected-paper-name');
            const name = nbNameInput.value.trim() || "Untitled Notebook";
            const paperType = nbSelectedPaperName.innerText;
            createDocument('Notebook', paperType, name);
            if (nbModal) nbModal.style.display = 'none';
        };
    }

    const btnNewNotebook = document.getElementById('btn-new-notebook');
    if (btnNewNotebook) {
        btnNewNotebook.onclick = () => { 
            closeAllMenus(); 
            const nbNameInput = document.getElementById('nb-name-input');
            if (nbNameInput) nbNameInput.value = "";
            if (nbModal) nbModal.style.display = 'flex'; 
        };
    }
    
    document.getElementById('btn-new-text-doc').onclick = () => { closeAllMenus(); createDocument('Text Document'); };
    document.getElementById('btn-create-folder').onclick = () => { closeAllMenus(); createFolder(); };
    const closeEditorBtn = document.getElementById('close-editor-btn');
    if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;

    document.getElementById('tool-pen').onclick = () => { currentTool = 'pen'; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); document.getElementById('tool-pen').classList.add('active'); };
    document.getElementById('tool-eraser').onclick = () => { currentTool = 'eraser'; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); document.getElementById('tool-eraser').classList.add('active'); };

    const navAll = document.getElementById('nav-all-docs');
    const navFav = document.getElementById('nav-favorites');
    const navShared = document.getElementById('nav-shared');
    if (navAll) navAll.onclick = () => { currentFolderId = null; currentView = 'all'; renderLibrary(); };
    if (navFav) navFav.onclick = () => { currentView = 'favorites'; renderLibrary(); };
    if (navShared) navShared.onclick = () => { currentView = 'shared'; renderLibrary(); };

    const btnExportNote = document.getElementById('btn-export-doc');
    if (btnExportNote) {
        btnExportNote.onclick = () => {
            const link = document.createElement('a');
            link.download = `${currentDoc.name}_page_${currentPageIndex + 1}.png`;
            link.href = canvas.toDataURL();
            link.click();
        };
    }

    const btnMoreNote = document.getElementById('btn-more-options');
    const moreMenuNote = document.getElementById('editor-more-menu');
    if (btnMoreNote && moreMenuNote) {
        btnMoreNote.onclick = (e) => {
            e.stopPropagation();
            moreMenuNote.style.display = moreMenuNote.style.display === 'flex' ? 'none' : 'flex';
        };
    }

    document.addEventListener('click', () => { if (moreMenuNote) moreMenuNote.style.display = 'none'; });

    // Listeners para Orientação (Tabs)
    document.querySelectorAll('.nb-orient-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nb-orient-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const preview = document.getElementById('nb-paper-preview-trigger');
            if (preview) {
                if (btn.dataset.orientation === 'landscape') preview.style.aspectRatio = '4/3';
                else preview.style.aspectRatio = '3/4';
            }
        };
    });

    // Listeners para Cores (Contraste dinâmico para amostra do modal)
    document.querySelectorAll('.nb-color-option').forEach(opt => {
        opt.onclick = () => {
            if (opt.id === 'nb-custom-color-btn') {
                document.getElementById('nb-custom-color-input').click();
                return;
            }
            document.querySelectorAll('.nb-color-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            const preview = document.getElementById('nb-paper-preview-trigger');
            if (preview) {
                const bgColor = opt.style.backgroundColor || window.getComputedStyle(opt).backgroundColor;
                preview.style.backgroundColor = bgColor;
                
                if (isColorDark(bgColor)) {
                    preview.classList.add('dark-paper');
                } else {
                    preview.classList.remove('dark-paper');
                }
            }
        };
    });

    const customColorInput = document.getElementById('nb-custom-color-input');
    if (customColorInput) {
        customColorInput.oninput = (e) => {
            const btn = document.getElementById('nb-custom-color-btn');
            btn.style.background = e.target.value;
            document.querySelectorAll('.nb-color-option').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            
            const preview = document.getElementById('nb-paper-preview-trigger');
            if (preview) {
                preview.style.backgroundColor = e.target.value;
                if (isColorDark(e.target.value)) {
                    preview.classList.add('dark-paper');
                } else {
                    preview.classList.remove('dark-paper');
                }
            }
        };
    }

    renderLibrary();
});

// --- SELECTION SYSTEM FUNCTIONS ---

export function toggleSelectionMode(active) {
    isSelectionMode = active;
    if (!active) selectedItems.clear();
    const notesTopbar = document.getElementById('notes-topbar');
    const selectionToolbar = document.getElementById('selection-toolbar');
    if (active) {
        if (notesTopbar) notesTopbar.style.display = 'none';
        if (selectionToolbar) selectionToolbar.style.display = 'flex';
    } else {
        if (notesTopbar) notesTopbar.style.display = 'flex';
        if (selectionToolbar) selectionToolbar.style.display = 'none';
    }
    renderLibrary();
}

export function updateSelectionUI() {
    const stTitle = document.getElementById('st-selection-title');
    const btnSelectAll = document.getElementById('btn-select-all');
    
    if (stTitle) {
        stTitle.innerText = selectedItems.size > 0 ? `${selectedItems.size} Selected` : 'Select Items';
    }

    if (btnSelectAll) {
        btnSelectAll.innerText = selectedItems.size > 0 ? 'Deselect All' : 'Select All';
    }
}

export function selectAllItems() {
    const activeFolder = currentFolderId || null;
    let visibleItems = [];

    if (currentView === 'all') {
        const folders = (library.folders || []).filter(f => (f.parentId || null) === activeFolder);
        const docs = (library.documents || []).filter(d => (d.parentId || null) === activeFolder);
        visibleItems = [...folders, ...docs];
    } else if (currentView === 'favorites') {
        visibleItems = (library.documents || []).filter(d => d.favorite);
    } else if (currentView === 'shared') {
        visibleItems = (library.documents || []).filter(d => d.shared);
    }

    const allSelected = visibleItems.length > 0 && visibleItems.every(item => selectedItems.has(item.id));

    if (allSelected) {
        visibleItems.forEach(item => selectedItems.delete(item.id));
    } else {
        visibleItems.forEach(item => selectedItems.add(item.id));
    }

    updateSelectionUI();
    renderLibrary();
}

export async function deleteSelectedItems() {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) return;
    selectedItems.forEach(id => {
        library.documents = (library.documents || []).filter(d => d.id !== id);
        library.folders = (library.folders || []).filter(f => f.id !== id);
    });
    selectedItems.clear();
    await saveLibrary();
    toggleSelectionMode(false);
}

export async function duplicateSelectedItems() {
    if (selectedItems.size === 0) return;
    selectedItems.forEach(id => {
        const originalDoc = library.documents.find(d => d.id === id);
        if (originalDoc) {
            const copy = JSON.parse(JSON.stringify(originalDoc));
            copy.id = 'doc_' + Date.now() + Math.random().toString(36).substr(2, 5);
            copy.name = originalDoc.name + " (Copy)";
            copy.createdAt = Date.now();
            copy.updatedAt = Date.now();
            library.documents.push(copy);
        }
        const originalFolder = library.folders.find(f => f.id === id);
        if (originalFolder) {
            const copy = JSON.parse(JSON.stringify(originalFolder));
            copy.id = 'fld_' + Date.now() + Math.random().toString(36).substr(2, 5);
            copy.name = originalFolder.name + " (Copy)";
            copy.createdAt = Date.now();
            copy.updatedAt = Date.now();
            library.folders.push(copy);
        }
    });
    await saveLibrary();
    toggleSelectionMode(false);
}

export function exportSelectedItems() {
    if (selectedItems.size === 0) return;
    const exportData = {
        documents: library.documents.filter(d => selectedItems.has(d.id)),
        folders: library.folders.filter(f => selectedItems.has(f.id)),
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exported_notes_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toggleSelectionMode(false);
}

export async function moveSelectedItems() {
    if (selectedItems.size === 0) return;
    const targetName = prompt("Move to which folder? (Type 'Root' for main directory or the Folder Name):", "Root");
    if (targetName === null) return;
    let targetId = null;
    if (targetName.toLowerCase() !== 'root') {
        const found = library.folders.find(f => f.name.toLowerCase() === targetName.toLowerCase());
        if (found) { targetId = found.id; } 
        else { alert("Folder not found."); return; }
    }
    selectedItems.forEach(id => {
        const doc = library.documents.find(d => d.id === id);
        if (doc) doc.parentId = targetId;
        const folder = library.folders.find(f => f.id === id);
        if (folder && folder.id !== targetId) folder.parentId = targetId;
    });
    await saveLibrary();
    toggleSelectionMode(false);
}

export async function importNoteData(file) {
    try {
        const text = await file.text();
        const imported = JSON.parse(text);
        const docsToAdd = imported.documents || (imported.paperType ? [imported] : []);
        const foldersToAdd = imported.folders || (imported.name && !imported.paperType ? [imported] : []);
        if (docsToAdd.length === 0 && foldersToAdd.length === 0) { throw new Error("Invalid file format"); }
        docsToAdd.forEach(doc => {
            doc.id = 'doc_' + Date.now() + Math.random().toString(36).substr(2, 5);
            doc.parentId = currentFolderId || null;
            library.documents.push(doc);
        });
        foldersToAdd.forEach(fld => {
            fld.id = 'fld_' + Date.now() + Math.random().toString(36).substr(2, 5);
            fld.parentId = currentFolderId || null;
            library.folders.push(fld);
        });
        await saveLibrary();
        alert("Import successful!");
    } catch (err) { alert("Failed to import: " + err.message); }
}

export function setLibraryLayout(layout) {
    currentLayout = layout;
    renderLibrary();
}

export function setLibrarySort(sort) {
    currentSort = sort;
    renderLibrary();
}
