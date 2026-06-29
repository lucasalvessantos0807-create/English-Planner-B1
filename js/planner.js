import { updateState, saveUserData, state, plannerConfig, addHistoryEntry } from './storage.js';
import { updateProgressBar } from './ui.js';

let isEditMode = false;

export function toggleEditMode(uid) {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    document.getElementById('cancelEditBtn').style.display = isEditMode ? "block" : "none";

    document.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = isEditMode;
        if(isEditMode) {
            el.onblur = () => {
                if(!window.pageContent) window.pageContent = {};
                window.pageContent[el.id] = el.innerHTML;
                saveUserData(uid);
            };
        }
    });
}

// ── FUNÇÃO OVERVIEW GRID ──
export function addOverviewBlock(uid) {
    const grid = document.getElementById('dynamic-ov-grid');
    if (!grid) return;
    const blockId = 'ov-block-' + Date.now();
    const newBlock = document.createElement('div');
    newBlock.className = 'ov-card ca';
    newBlock.innerHTML = `
        <div class="ov-label editable-global" id="${blockId}-title" contenteditable="true">NEW MONTH</div>
        <div class="ov-body editable-global" id="${blockId}-body" contenteditable="true">Edit your goals...</div>
        <button class="del-ov-block" style="position:absolute; top:5px; right:5px; background:none; border:none; cursor:pointer; font-size:10px; opacity:0.3;">✕</button>
    `;
    
    newBlock.querySelector('.del-ov-block').onclick = () => {
        if(confirm("Delete this block?")) { newBlock.remove(); saveUserData(uid); }
    };
    
    grid.appendChild(newBlock);
    newBlock.querySelectorAll('.editable-global').forEach(el => {
        el.onblur = () => {
            if (!window.pageContent) window.pageContent = {};
            window.pageContent[el.id] = el.innerHTML;
            saveUserData(uid);
        };
    });
}

export function buildWeek(m, w, uid) {
    const key = `${m}-${w}`;
    const wk = window.plannerConfig[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;

    container.innerHTML = `<div class="wkbar"><h3>${wk.label}</h3><p class="editable-global" id="m-desc-${m}" contenteditable="true">${wk.theme}</p></div>`;
    // ... restante da lógica de construção de cards de dia se desejar manter
}

export function addNewMonth(uid) { /* lógica de adicionar mês ao config */ }
export function cancelEdit(uid) { window.location.reload(); }
export function performUndo(uid) { console.log("Undo not implemented in clean version"); }
