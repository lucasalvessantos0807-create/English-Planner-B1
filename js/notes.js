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
let currentView = 'all'; // 'all', 'favorites', 'shared'

// --- 1. LIBRARY MANAGEMENT ---

export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');
    const sortVal = document.getElementById('sort-docs-select')?.value || 'name';

    if (!grid) return;
    grid.innerHTML = '';

    // Update Breadcrumb and Navigation
    if (currentView === 'favorites') {
        breadcrumb.innerText = 'Favorites';
    } else if (currentView === 'shared') {
        breadcrumb.innerText = 'Shared with me';
    } else if (!currentFolderId) {
        breadcrumb.innerText = 'Documents';
    } else {
        const folder = library.folders.find(f => f.id === currentFolderId);
        breadcrumb.innerHTML = `<span style="cursor:pointer; color:var(--accent);" id="back-to-root">Documents</span> / ${folder ? folder.name : 'Unknown'}`;
        document.getElementById('back-to-root').onclick = () => {
            currentFolderId = null;
            currentView = 'all';
            renderLibrary();
        };
    }

    // Filter items based on view and folder
    let foldersToShow = [];
    let docsToShow = [];

    if (currentView === 'all') {
        foldersToShow = library.folders.filter(f => f.parentId === currentFolderId);
        docsToShow = library.documents.filter(d => d.parentId === currentFolderId);
    } else if (currentView === 'favorites') {
        docsToShow = library.documents.filter(d => d.favorite);
    } else if (currentView === 'shared') {
        docsToShow = library.documents.filter(d => d.shared);
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
                if (confirm("Delete this document permanently?")) {
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

    library.documents.push(newDoc);
    saveLibrary();
    openDocument(newDoc);
}

function deleteDocument(id) {
    const index = library.documents.findIndex(d => d.id === id);
    if (index !== -1) {
        library.documents.splice(index, 1);
        saveLibrary();
    }
}

function deleteFolder(id) {
    // Delete documents inside this folder
    library.documents = library.documents.filter(d => d.parentId !== id);
    // Delete subfolders (one level deep for this logic)
    library.folders = library.folders.filter(f => f.parentId !== id);
    // Delete the folder itself
    library.folders = library.folders.filter(f => f.id !== id);
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
    document.getElementById('notes-area').style.display = 'none';
    document.getElementById('notes-sidebar').style.display = 'none';
    document.getElementById('doc-editor').style.display = 'flex';
    document.getElementById('current-doc-title').innerText = doc.name;

    initCanvas();
    
    if (doc.data) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = doc.data;
    }
}

function initCanvas() {
    canvas = document.getElementById('note-canvas');
    ctx = canvas.getContext('2d');

    // High DPI Support for Retina/Modern screens and Stylus precision
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 850 * ratio;
    canvas.height = 1100 * ratio;
    canvas.style.width = '850px';
    canvas.style.height = '1100px';
    ctx.scale(ratio, ratio);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pointer events support pressure sensitivity for Bluetooth Pens
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
        ctx.strokeStyle = document.getElementById('pen-color').value;
        // Use pen pressure if available
        const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 1;
        ctx.lineWidth = document.getElementById('pen-width').value * pressure;
    } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 30;
    }

    ctx.stroke();
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    isDrawing = false;
    if (currentDoc) {
        // Auto-save data URL to memory while drawing stops
        currentDoc.data = canvas.toDataURL();
    }
}

export function closeEditor() {
    if (currentDoc) {
        currentDoc.data = canvas.toDataURL();
        currentDoc.updatedAt = Date.now();
        saveLibrary();
    }
    document.getElementById('doc-editor').style.display = 'none';
    document.getElementById('notes-area').style.display = 'flex';
    document.getElementById('notes-sidebar').style.display = 'flex';
    currentDoc = null;
}

// --- 3. EXPORT / IMPORT ---

export function exportLibrary() {
    const dataStr = JSON.stringify(library, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my_library_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importLibrary(file) {
    try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (imported.folders && imported.documents) {
            if (confirm("This will merge the imported folders and documents with your current library. Continue?")) {
                library.folders = [...library.folders, ...imported.folders];
                library.documents = [...library.documents, ...imported.documents];
                await saveLibrary();
                alert("Library imported successfully!");
            }
        } else {
            alert("Invalid library file format.");
        }
    } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to import library.");
    }
}

// --- 4. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    const newFolderBtn = document.getElementById('new-folder-btn');
    const newDocBtn = document.getElementById('new-doc-btn');
    const closeBtn = document.getElementById('close-editor-btn');
    const saveDocBtn = document.getElementById('save-doc-btn');
    const penBtn = document.getElementById('tool-pen');
    const eraserBtn = document.getElementById('tool-eraser');
    const sortSelect = document.getElementById('sort-docs-select');
    const exportBtn = document.getElementById('export-library-btn');
    const importBtn = document.getElementById('import-library-btn');

    if (newFolderBtn) newFolderBtn.onclick = createFolder;
    if (newDocBtn) newDocBtn.onclick = createDocument;
    if (closeBtn) closeBtn.onclick = closeEditor;
    if (saveDocBtn) saveDocBtn.onclick = closeEditor;
    if (sortSelect) sortSelect.onchange = renderLibrary;
    if (exportBtn) exportBtn.onclick = exportLibrary;
    
    if (importBtn) {
        importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                if (e.target.files.length > 0) importLibrary(e.target.files[0]);
            };
            input.click();
        };
    }

    if (penBtn) penBtn.onclick = () => {
        currentTool = 'pen';
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    };
    if (eraserBtn) eraserBtn.onclick = () => {
        currentTool = 'eraser';
        eraserBtn.classList.add('active');
        penBtn.classList.remove('active');
    };

    // Nav filters
    document.getElementById('nav-all-docs').onclick = () => {
        currentFolderId = null;
        currentView = 'all';
        document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-all-docs').classList.add('active');
        renderLibrary();
    };

    document.getElementById('nav-favorites').onclick = () => {
        currentView = 'favorites';
        document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-favorites').classList.add('active');
        renderLibrary();
    };

    document.getElementById('nav-shared').onclick = () => {
        currentView = 'shared';
        document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-shared').classList.add('active');
        renderLibrary();
    };
});
