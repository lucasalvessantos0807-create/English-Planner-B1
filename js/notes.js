import { saveUserData, library } from './storage.js';

/**
 * NOTES & LIBRARY SYSTEM
 * Functionality inspired by Goodnotes for Web
 */

let currentFolderId = null; // null means Root
let isDrawing = false;
let currentTool = 'pen';
let canvas, ctx;
let lastX = 0;
let lastY = 0;
let currentDoc = null;
let isNewMenuOpen = false;
let currentView = 'all'; // 'all', 'favorites', 'shared'

// --- 1. LIBRARY MANAGEMENT ---

export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');
    const sortVal = document.getElementById('sort-docs-select')?.value || 'name';

    if (!grid) return;
    grid.innerHTML = '';

    // Safety check for breadcrumb element to prevent "null" errors
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

    // Filter items logic with safety arrays
    let foldersToShow = [];
    let docsToShow = [];

    if (currentView === 'all') {
        foldersToShow = (library.folders || []).filter(f => f.parentId === currentFolderId);
        docsToShow = (library.documents || []).filter(d => d.parentId === currentFolderId);
    } else if (currentView === 'favorites') {
        docsToShow = (library.documents || []).filter(d => d.favorite);
    } else if (currentView === 'shared') {
        docsToShow = (library.documents || []).filter(d => d.shared);
    }

    // Sorting Logic
    const sortFn = (a, b) => {
        if (sortVal === 'name') return a.name.localeCompare(b.name);
        if (sortVal === 'date') return (b.updatedAt || 0) - (a.updatedAt || 0);
        if (sortVal === 'size') {
            const sizeA = a.data ? a.data.length : 0;
            const sizeB = b.data ? b.data.length : 0;
            return sizeB - sizeA;
        }
        return 0;
    };

    foldersToShow.sort(sortFn);
    docsToShow.sort(sortFn);

    // Render Folders
    foldersToShow.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'note-item';
        item.innerHTML = `
            <div class="note-icon folder">📁</div>
            <div class="note-name">${folder.name}</div>
            <div class="note-meta" style="font-size:10px; color:var(--muted);">${new Date(folder.updatedAt).toLocaleDateString()}</div>
        `;
        item.onclick = () => {
            currentFolderId = folder.id;
            currentView = 'all';
            renderLibrary();
        };
        item.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
                deleteFolder(folder.id);
            }
        };
        grid.appendChild(item);
    });

    // Render Documents
    docsToShow.forEach(doc => {
        const item = document.createElement('div');
        item.className = 'note-item';
        const isFav = doc.favorite ? '⭐' : '';
        item.innerHTML = `
            <div class="note-icon">📄<span style="position:absolute; top:5px; right:5px; font-size:12px;">${isFav}</span></div>
            <div class="note-name">${doc.name}</div>
            <div class="note-meta" style="font-size:10px; color:var(--muted);">${new Date(doc.updatedAt).toLocaleDateString()}</div>
        `;
        item.onclick = () => openDocument(doc);
        
        item.oncontextmenu = (e) => {
            e.preventDefault();
            const action = confirm("Press OK to Toggle Favorite, or Cancel to Delete Document.");
            if (action) {
                doc.favorite = !doc.favorite;
                doc.updatedAt = Date.now();
                saveLibrary();
            } else {
                if (confirm("Delete this document?")) {
                    deleteDocument(doc.id);
                }
            }
        };
        grid.appendChild(item);
    });
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

// --- 2. CANVAS / DRAWING SYSTEM (Bluetooth Pen Support) ---

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
    
    if (doc.data) {
        const img = new Image();
        img.onload = () => {
            if (ctx) ctx.drawImage(img, 0, 0);
        };
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
    if (currentDoc && canvas) {
        currentDoc.data = canvas.toDataURL();
    }
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

// --- 3. EXPORT / IMPORT ---

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

// --- 4. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    const mainNewBtn = document.getElementById('main-new-btn');
    const newMenu = document.getElementById('new-options-menu');

    // Toggle Menu
    if (mainNewBtn) {
        mainNewBtn.onclick = (e) => {
            e.stopPropagation();
            isNewMenuOpen = !isNewMenuOpen;
            newMenu.style.display = isNewMenuOpen ? 'flex' : 'none';
        };
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (newMenu && !newMenu.contains(e.target) && e.target !== mainNewBtn) {
            isNewMenuOpen = false;
            newMenu.style.display = 'none';
        }
    });

    // Mapeamento dos botões do menu para as funções existentes (ou futuras)
    const btnNewNotebook = document.getElementById('btn-new-notebook');
    const btnNewTextDoc = document.getElementById('btn-new-text-doc');
    const btnCreateFolder = document.getElementById('btn-create-folder');

    if (btnNewNotebook) btnNewNotebook.onclick = () => { createDocument(); isNewMenuOpen = false; newMenu.style.display = 'none'; };
    if (btnNewTextDoc) btnNewTextDoc.onclick = () => { createDocument(); isNewMenuOpen = false; newMenu.style.display = 'none'; };
    if (btnCreateFolder) btnCreateFolder.onclick = () => { createFolder(); isNewMenuOpen = false; newMenu.style.display = 'none'; };

    // As demais opções (Scan, Study Set, etc) serão implementadas funcionalmente nas próximas etapas
    const closeBtn = document.getElementById('close-editor-btn');
    const saveDocBtn = document.getElementById('save-doc-btn');
    const penBtn = document.getElementById('tool-pen');
    const eraserBtn = document.getElementById('tool-eraser');
    const sortSelect = document.getElementById('sort-docs-select');

    if (newFolderBtn) newFolderBtn.onclick = createFolder;
    if (newDocBtn) newDocBtn.onclick = createDocument;
    if (closeBtn) closeBtn.onclick = closeEditor;
    if (saveDocBtn) saveDocBtn.onclick = closeEditor;
    if (sortSelect) sortSelect.onchange = renderLibrary;

    const exportLibraryBtn = document.getElementById('export-library-btn');
    if (exportLibraryBtn) exportLibraryBtn.onclick = exportLibrary;

    const importLibraryBtn = document.getElementById('import-library-btn');
    if (importLibraryBtn) {
        importLibraryBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const imported = JSON.parse(event.target.result);
                            if (imported.folders && imported.documents) {
                                if (confirm("Merge imported library with current?")) {
                                    library.folders = [...library.folders, ...imported.folders];
                                    library.documents = [...library.documents, ...imported.documents];
                                    await saveLibrary();
                                    alert("Library merged!");
                                }
                            }
                        } catch (err) { alert("Invalid file"); }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        };
    }

    // Navigation Filters
    const navAll = document.getElementById('nav-all-docs');
    const navFav = document.getElementById('nav-favorites');
    const navShared = document.getElementById('nav-shared');

    if (navAll) {
        navAll.onclick = () => {
            currentFolderId = null;
            currentView = 'all';
            updateNavUI(navAll);
            renderLibrary();
        };
    }

    if (navFav) {
        navFav.onclick = () => {
            currentView = 'favorites';
            updateNavUI(navFav);
            renderLibrary();
        };
    }

    if (navShared) {
        navShared.onclick = () => {
            currentView = 'shared';
            updateNavUI(navShared);
            renderLibrary();
        };
    }

    function updateNavUI(activeBtn) {
        document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }
});
