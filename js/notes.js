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
let currentView = 'all'; 
let currentLayout = 'grid'; 
let currentSort = 'modified'; 
let isSelectionMode = false;
let selectedItems = new Set();

// --- 1. LIBRARY MANAGEMENT ---

export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');

    if (!grid) return;
    grid.innerHTML = '';
    
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

// --- 2. CANVAS & MULTI-PAGE SYSTEM ---

function openDocument(doc) {
    currentDoc = doc;
    
    if (!currentDoc.pages) {
        currentDoc.pages = [null];
    }
    currentPageIndex = 0;

    // Hide other areas to prevent overlap
    document.getElementById('notes-area').style.display = 'none';
    document.getElementById('notes-sidebar').style.display = 'none';
    document.getElementById('planner-content').style.display = 'none';
    document.getElementById('doc-editor').style.display = 'flex';

    initCanvas();

    const canvasEl = document.getElementById('note-canvas');
    if (canvasEl) {
        canvasEl.className = ""; // Reset patterns
        const paperClass = "paper-" + (doc.paperType || "Blank").toLowerCase().replace(/ /g, '-');
        canvasEl.classList.add(paperClass);
    }
    
    renderPage();
}

function renderPage() {
    if (!ctx || !canvas || !currentDoc) return;
    
    const ratio = window.devicePixelRatio || 1;
    // Reset transform to clear the entire canvas correctly
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Apply scale again for drawing
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    
    const pageData = currentDoc.pages[currentPageIndex];
    if (pageData) {
        const img = new Image();
        img.onload = () => { 
            // Clear again just before drawing to avoid flickers on slow loads
            ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
            ctx.drawImage(img, 0, 0, 850, 1100); 
        };
        img.src = pageData;
    }
    
    const indicator = document.getElementById('page-indicator-text');
    if (indicator) {
        indicator.innerText = `Page ${currentPageIndex + 1} / ${currentDoc.pages.length}`;
    }
}

function saveCurrentPage() {
    if (currentDoc && canvas) {
        currentDoc.pages[currentPageIndex] = canvas.toDataURL();
    }
}

export function nextPage() {
    if (!currentDoc) return;
    saveCurrentPage();
    
    // Infinite pages: Create new if at the end
    if (currentPageIndex === currentDoc.pages.length - 1) {
        currentDoc.pages.push(null);
    }
    
    currentPageIndex++;
    renderPage();
    
    // Auto-save to cloud when changing pages to prevent data loss
    currentDoc.updatedAt = Date.now();
    saveLibrary();
}

export function prevPage() {
    if (!currentDoc || currentPageIndex <= 0) return;
    saveCurrentPage();
    currentPageIndex--;
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
    
    // Close editor and show library/notes correctly
    document.getElementById('doc-editor').style.display = 'none';
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

// --- 3. INITIALIZATION & GESTURE SYSTEM ---

document.addEventListener('DOMContentLoaded', () => {
    
    // Keyboard Navigation: Left/Right keys
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

    // Modal Paper Selection Preview Update
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
                // Clear old paper patterns
                nbPaperPreview.classList.remove('paper-blank', 'paper-dotted', 'paper-squared', 'paper-narrow-ruled', 'paper-wide-ruled', 'paper-cornell', 'paper-legal', 'paper-single-column', 'paper-three-columns');
                // Apply selected pattern to preview
                const paperClass = "paper-" + paper.toLowerCase().replace(/ /g, '-');
                nbPaperPreview.classList.add(paperClass);
            }
        };
    });

    const nbModal = document.getElementById('notebook-modal');
    const nbCancel = document.getElementById('nb-cancel');
    const nbCreate = document.getElementById('nb-create');

    if (nbCancel) nbCancel.onclick = () => { if (nbModal) nbModal.style.display = 'none'; };

    if (nbCreate) {
        nbCreate.onclick = () => {
            const nbNameInput = document.getElementById('nb-name-input');
            const nbSelectedPaperName = document.getElementById('nb-selected-paper-name');
            const name = nbNameInput.value.trim() || "Untitled Notebook";
            const paperType = nbSelectedPaperName.innerText;
            createDocument('Notebook', paperType);
            if (nbModal) nbModal.style.display = 'none';
        };
    }

    const btnNewNotebook = document.getElementById('btn-new-notebook');
    if (btnNewNotebook) btnNewNotebook.onclick = () => { closeAllMenus(); if (nbModal) nbModal.style.display = 'flex'; };
    
    document.getElementById('btn-new-text-doc').onclick = () => { closeAllMenus(); createDocument('Text Document'); };
    document.getElementById('btn-create-folder').onclick = () => { closeAllMenus(); createFolder(); };
    document.getElementById('close-editor-btn').onclick = closeEditor;

    document.getElementById('tool-pen').onclick = () => { currentTool = 'pen'; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); document.getElementById('tool-pen').classList.add('active'); };
    document.getElementById('tool-eraser').onclick = () => { currentTool = 'eraser'; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); document.getElementById('tool-eraser').classList.add('active'); };

    const navAll = document.getElementById('nav-all-docs');
    const navFav = document.getElementById('nav-favorites');
    const navShared = document.getElementById('nav-shared');

    if (navAll) navAll.onclick = () => { currentFolderId = null; currentView = 'all'; renderLibrary(); };
    if (navFav) navFav.onclick = () => { currentView = 'favorites'; renderLibrary(); };
    if (navShared) navShared.onclick = () => { currentView = 'shared'; renderLibrary(); };

    // Swipe Gestures: Touch Start/End
 // Enhanced Swipe Gestures: Applied to the container for better Kindle-like experience
    let touchStartX = 0;
    const editorContainer = document.querySelector('.canvas-container');
    if (editorContainer) {
        editorContainer.addEventListener('touchstart', (e) => {
            // Only trigger swipe if not currently drawing (1 touch point)
            if (e.touches.length === 1) {
                touchStartX = e.changedTouches[0].screenX;
            }
        }, { passive: true });

        editorContainer.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                let diff = touchStartX - e.changedTouches[0].screenX;
                // Threshold of 80px to avoid accidental turns while drawing
                if (Math.abs(diff) > 80) { 
                    if (diff > 0) nextPage();
                    else prevPage();
                }
            }
        }, { passive: true });
    }

    renderLibrary();
});
