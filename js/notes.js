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

// --- 1. LIBRARY MANAGEMENT ---

/**
 * Renders the library grid based on current folder and sorting
 */
export function renderLibrary() {
    const grid = document.getElementById('notes-grid');
    const breadcrumb = document.getElementById('notes-breadcrumb');
    const sortVal = document.getElementById('sort-docs-select') ? document.getElementById('sort-docs-select').value : 'name';

    if (!grid) return;
    grid.innerHTML = '';

    // Update Breadcrumb
    if (!currentFolderId) {
        breadcrumb.innerText = 'Documents';
    } else {
        const folder = library.folders.find(f => f.id === currentFolderId);
        breadcrumb.innerHTML = `<span style="cursor:pointer; color:var(--accent);" id="back-to-root">Documents</span> / ${folder ? folder.name : 'Unknown'}`;
        document.getElementById('back-to-root').onclick = () => {
            currentFolderId = null;
            renderLibrary();
        };
    }

    // Filter content
    let foldersToShow = library.folders.filter(f => f.parentId === currentFolderId);
    let docsToShow = library.documents.filter(d => d.parentId === currentFolderId);

    // Sorting Logic
    const sortFn = (a, b) => {
        if (sortVal === 'name') return a.name.localeCompare(b.name);
        if (sortVal === 'date') return b.updatedAt - a.updatedAt;
        if (sortVal === 'size') return (b.data?.length || 0) - (a.data?.length || 0);
        return 0;
    };

    foldersToShow.sort(sortFn);
    docsToShow.sort(sortFn);

    // Render Folders
    foldersToShow.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'note-item';
        item.innerHTML = `
            <div class="note-icon">📁</div>
            <div class="note-name">${folder.name}</div>
            <div class="note-meta" style="font-size:10px; color:var(--muted);">${new Date(folder.updatedAt).toLocaleDateString()}</div>
        `;
        item.onclick = () => {
            currentFolderId = folder.id;
            renderLibrary();
        };
        // Right click to delete
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
            const action = confirm("Press OK to Favorite/Unfavorite, or Cancel to Delete.");
            if (action) {
                doc.favorite = !doc.favorite;
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
    const name = prompt("Folder Name:", "New Folder");
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
    const name = prompt("Document Name:", "Untitled Note");
    if (!name) return;

    const newDoc = {
        id: 'doc_' + Date.now(),
        name: name,
        parentId: currentFolderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
        data: null // Drawing data
    };

    library.documents.push(newDoc);
    saveLibrary();
    openDocument(newDoc);
}

function deleteDocument(id) {
    library.documents = library.documents.filter(d => d.id !== id);
    saveLibrary();
}

function deleteFolder(id) {
    // Delete sub-folders and docs recursively
    library.documents = library.documents.filter(d => d.parentId !== id);
    library.folders = library.folders.filter(f => f.id !== id);
    saveLibrary();
}

async function saveLibrary() {
    const uid = window.auth.currentUser.uid;
    await saveUserData(uid);
    renderLibrary();
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

    // High DPI Setup
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 800 * ratio;
    canvas.height = 1100 * ratio;
    canvas.style.width = '800px';
    canvas.style.height = '1100px';
    ctx.scale(ratio, ratio);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pointer Events for Bluetooth Pen / Stylus
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);

    if (currentTool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = document.getElementById('pen-color').value;
        // Pressure sensitivity support
        ctx.lineWidth = document.getElementById('pen-width').value * (e.pressure || 1);
    } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
    }

    ctx.stroke();
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    isDrawing = false;
}

export function closeEditor() {
    if (currentDoc) {
        // Save canvas to data URL
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
    const dataStr = JSON.stringify(library);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'library_backup.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// --- 4. INITIALIZATION OF EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const newFolderBtn = document.getElementById('new-folder-btn');
    const newDocBtn = document.getElementById('new-doc-btn');
    const closeEditorBtn = document.getElementById('close-editor-btn');
    const saveDocBtn = document.getElementById('save-doc-btn');
    const sortSelect = document.getElementById('sort-docs-select');
    
    if (newFolderBtn) newFolderBtn.onclick = createFolder;
    if (newDocBtn) newDocBtn.onclick = createDocument;
    if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
    if (saveDocBtn) saveDocBtn.onclick = closeEditor;
    if (sortSelect) sortSelect.onchange = renderLibrary;

    // Tool switching
    const penBtn = document.getElementById('tool-pen');
    const eraserBtn = document.getElementById('tool-eraser');

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

    // Sidebar navigation
    document.getElementById('nav-all-docs').onclick = () => {
        currentFolderId = null;
        renderLibrary();
    };

    document.getElementById('nav-favorites').onclick = () => {
        const grid = document.getElementById('notes-grid');
        grid.innerHTML = '';
        const favs = library.documents.filter(d => d.favorite);
        // Reuse rendering logic for favorites
        favs.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'note-item';
            item.innerHTML = `<div class="note-icon">📄⭐</div><div class="note-name">${doc.name}</div>`;
            item.onclick = () => openDocument(doc);
            grid.appendChild(item);
        });
    };
});
