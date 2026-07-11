import { updateState, saveUserData, state, plannerConfig, addHistoryEntry } from './storage.js';
import { updateProgressBar } from './ui.js';

let isEditMode = false;
let undoStack = []; 
let sessionInitialConfig = null; 
let sessionInitialContent = null; 
let sessionInitialDOMSnapshot = {}; 

const builtWeeks = new Set();
const EMOJI_LIST = ['📚','📖','🎙️','📐','✍️','🎧','🗣️','🔁','⭐','✅','📝','📍'];
const ICON_MAP = { '📚': 'Vocabulary', '📖': 'Reading', '🎙️': 'Shadowing', '🎧': 'Listening', '📐': 'Grammar', '✍️': 'Writing', '🗣️': 'Speaking', '🔁': 'Review Day', '⭐': 'Review Day', '✅': 'Completed', '📝': 'Exercise', '📍': 'Extra Activity' };

function refreshUI(uid, targetMonth = null) {
    import('./ui.js').then(mod => {
        mod.renderStructure(window.plannerConfig, isEditMode, (m, w) => buildWeek(m, w, uid));
        let mKey = targetMonth || (Object.keys(window.plannerConfig).sort()[0]?.split('-')[0]);
        setTimeout(() => {
            const btn = Array.from(document.querySelectorAll('#monthNav .mbtn')).find(b => b.textContent.trim() === `Month ${mKey}`);
            if (btn) btn.click();
            mod.updateProgressBar();
        }, 100); 
    });
}

function pushToUndo() {
    undoStack.push({ config: JSON.parse(JSON.stringify(window.plannerConfig)), content: JSON.parse(JSON.stringify(window.pageContent || {})) });
    const uBtn = document.getElementById('undoBtn');
    if (uBtn) uBtn.style.display = 'block';
}

export function performUndo(uid) {
    if (undoStack.length === 0) return;
    const last = undoStack.pop();
    window.plannerConfig = last.config; window.pageContent = last.content;
    if (undoStack.length === 0 && document.getElementById('undoBtn')) document.getElementById('undoBtn').style.display = 'none';
    refreshCurrentWeek(uid); renderDynamicOverviewBlocks(uid); renderDailyTemplate(uid);
}

export function cancelEdit(uid) {
    if (!confirm("Discard all changes?")) return;
    window.plannerConfig = JSON.parse(JSON.stringify(sessionInitialConfig));
    window.pageContent = JSON.parse(JSON.stringify(sessionInitialContent));
    isEditMode = false; updateUIEditMode();
    renderDynamicOverviewBlocks(uid); renderDailyTemplate(uid); refreshUI(uid);
}

function updateUIEditMode() {
    const saveBtn = document.getElementById('saveChangesBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const fab = document.getElementById('fabWrapper');
    if (isEditMode) {
        fab?.classList.add('fab-hidden');
        saveBtn.style.display = "block"; cancelBtn.style.display = "block";
    } else {
        fab?.classList.remove('fab-hidden');
        saveBtn.style.display = "none"; cancelBtn.style.display = "none";
        if(document.getElementById('undoBtn')) document.getElementById('undoBtn').style.display = "none";
    }
}

export function toggleEditMode(uid) {
    if (!isEditMode) {
        sessionInitialConfig = JSON.parse(JSON.stringify(window.plannerConfig));
        sessionInitialContent = JSON.parse(JSON.stringify(window.pageContent || {}));
        undoStack = []; isEditMode = true;
        document.getElementById('addOverviewBlockBtn').style.display = 'block';
        document.getElementById('addTemplateRowBtn').style.display = 'block';
    } else {
        addHistoryEntry("Manual Edit", sessionInitialConfig, sessionInitialContent);
        saveUserData(uid); isEditMode = false;
        document.getElementById('addOverviewBlockBtn').style.display = 'none';
        document.getElementById('addTemplateRowBtn').style.display = 'none';
    }
    updateUIEditMode();
    document.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = isEditMode;
        if (isEditMode) el.onblur = () => { window.pageContent[el.id] = el.innerHTML; };
    });
    refreshCurrentWeek(uid); renderDynamicOverviewBlocks(uid); renderDailyTemplate(uid);
}

function refreshCurrentWeek(uid) {
    const act = document.querySelector('.mpanel.on .wpanel.on');
    if (act) {
        const p = act.id.replace('wp', '').split('-');
        buildWeek(p[0], p[1], uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')));
    }
}

export function buildWeek(m, w, uid, openDays = [], isPreview = false, prefix = "", customConfig = null, customState = null) {
    const config = customConfig || window.plannerConfig;
    const activeState = customState || window.appState;
    const key = `${m}-${w}`; const wk = config[key];
    const container = document.getElementById(`${prefix}wp${m}-${w}`);
    if (!wk || !container) return;

    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p contenteditable="${isEditMode && !isPreview}" data-type="theme" data-week="${key}">${wk.theme}</p></div>`;

    wk.days.forEach((day, dIdx) => {
        const dKey = `d${day.n}`; const fKey = `m${m}-${dKey}`;
        const dData = activeState[fKey] || activeState[dKey] || { done: false, notes: "" };
        const card = document.createElement("div"); card.className = "daycard";
        const isOpen = openDays.includes(day.n.toString());

        const actsHtml = day.activities.map((act, aIdx) => {
            let sugHtml = (isEditMode && !isPreview) ? `<div class="icon-suggestions">${EMOJI_LIST.map(e => `<span class="suggest-emoji" data-emoji="${e}">${e}</span>`).join('')}</div>` : '';
            return `
                <div class="act">
                    <div class="aico-wrapper">
                        <div class="aico ${act.t}" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.i">${act.i}</div>
                        ${sugHtml}
                    </div>
                    <div class="acont">
                        <div class="atitle" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.title">${act.title}</div>
                        <div class="adesc" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.desc">${act.desc}</div>
                    </div>
                    <div class="atime" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.time">${act.time}</div>
                    ${(isEditMode && !isPreview) ? `<div class="del-act" data-week="${key}" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}
                </div>`;
        }).join('');

        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''}"><div class="daynum">${day.n}</div><div class="dayname">${day.name}</div><div class="daytag" contenteditable="${isEditMode && !isPreview}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div></div>
            <div class="daybody ${isOpen ? 'on' : ''}" id="${prefix}db${day.n}">
                <div class="acts-cont">${actsHtml}</div>
                ${(isEditMode && !isPreview) ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}
                <textarea class="ntxt" placeholder="Notes..." ${isPreview ? 'readonly' : ''}>${dData.notes || ""}</textarea>
                <label class="chk ${dData.done ? 'done' : ''}"><input type="checkbox" ${dData.done ? 'checked' : ''} ${isPreview ? 'disabled' : ''}><span>Day completed</span></label>
            </div>`;

        if (isEditMode && !isPreview) {
            card.querySelectorAll('.aico').forEach(icon => {
                icon.onclick = (e) => { e.stopPropagation(); const w = icon.closest('.aico-wrapper'); w.classList.toggle('show-suggestions'); };
            });
            card.querySelectorAll('.suggest-emoji').forEach(s => {
                s.onclick = (e) => {
                    pushToUndo(); const emoji = e.target.dataset.emoji;
                    const path = e.target.closest('.act').querySelector('.atitle').dataset.path;
                    const [wkK, dI, aI] = path.split('.'); window.plannerConfig[wkK].days[dI].activities[aI].i = emoji;
                    if(ICON_MAP[emoji]) window.plannerConfig[wkK].days[dI].activities[aI].title = ICON_MAP[emoji];
                    buildWeek(m, w, uid, [day.n.toString()]);
                };
            });
            card.querySelectorAll('[contenteditable]').forEach(el => {
                el.onblur = () => {
                    const p = el.dataset.path;
                    if (p) { const [wkK, dI, aI, prop] = p.split('.'); window.plannerConfig[wkK].days[dI].activities[aI][prop] = el.innerText; }
                    else if (el.dataset.type === 'tag') { window.plannerConfig[el.dataset.week].days[el.dataset.dayidx].tag = el.innerText; }
                };
            });
            card.querySelector('.add-act-btn').onclick = () => { pushToUndo(); window.plannerConfig[key].days[dIdx].activities.push({t: "grammar", i: "📝", title: "New", desc: "Edit", time: "20 min"}); buildWeek(m, w, uid, [day.n.toString()]); };
        }
        card.querySelector('.dayhead').onclick = (e) => { if(!e.target.hasAttribute('contenteditable')) card.querySelector('.daybody').classList.toggle('on'); };
        if (!isPreview) {
            card.querySelector('textarea').oninput = (e) => { updateState(m, dKey, { notes: e.target.value }); saveUserData(uid); };
            card.querySelector('input').onchange = (e) => { updateState(m, dKey, { done: e.target.checked }); saveUserData(uid); updateProgressBar(); };
        }
        container.appendChild(card);
    });
}

export function addNewMonth(uid) {
    const days = parseInt(prompt("How many days?", "30")); if (isNaN(days) || days <= 0) return;
    addHistoryEntry("Add Month", window.plannerConfig, window.pageContent);
    const ms = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nxt = ms.length > 0 ? Math.max(...ms.map(Number)) + 1 : 1;
    let cd = 1;
    for (let w = 1; w <= Math.ceil(days / 7); w++) {
        const dInW = Math.min(7, days - ((w - 1) * 7));
        window.plannerConfig[`${nxt}-${w}`] = { label: `Week ${w}`, theme: "New", days: Array.from({length: dInW}, () => ({ n: cd++, name: "Day", tag: "Daily", activities: [{t:"vocab", i:"📚", title:"Study", desc:"Edit", time:"20m"}] })) };
    }
    saveUserData(uid).then(() => refreshUI(uid, nxt));
}

export function editMonthStructure(m, uid) {
    const days = parseInt(prompt(`New day count for Month ${m}?`, "30")); if (isNaN(days)) return;
    addHistoryEntry(`Restructure Month ${m}`, window.plannerConfig, window.pageContent);
    const existing = []; Object.keys(window.plannerConfig).filter(k => k.startsWith(`${m}-`)).forEach(k => { existing.push(...window.plannerConfig[k].days); delete window.plannerConfig[k]; });
    let cd = 1;
    for (let w = 1; w <= Math.ceil(days / 7); w++) {
        const dInW = Math.min(7, days - ((w - 1) * 7)); const wDays = [];
        for (let i=0; i<dInW; i++) {
            if(existing[cd-1]) { let d = existing[cd-1]; d.n = cd; wDays.push(d); }
            else wDays.push({ n:cd, name:"Day", tag:"Daily", activities:[] });
            cd++;
        }
        window.plannerConfig[`${m}-${w}`] = { label: `Week ${w}`, theme: "Updated", days: wDays };
    }
    saveUserData(uid).then(() => refreshUI(uid, m));
}

export function deleteMonth(m, uid) {
    if (confirm(`Delete Month ${m}?`)) {
        addHistoryEntry(`Delete Month ${m}`, window.plannerConfig, window.pageContent);
        Object.keys(window.plannerConfig).forEach(k => { if (k.startsWith(`${m}-`)) delete window.plannerConfig[k]; });
        saveUserData(uid).then(() => refreshUI(uid));
    }
}

export function addOverviewBlock(uid) { pushToUndo(); const id = 'ov-' + Date.now(); if(!window.pageContent.dynamicBlocks) window.pageContent.dynamicBlocks = []; window.pageContent.dynamicBlocks.push(id); renderDynamicOverviewBlocks(uid); }

export function renderDynamicOverviewBlocks(uid, prefix = "", customContent = null) {
    const grid = document.getElementById(prefix + 'dynamic-ov-grid'); if (!grid) return;
    const content = customContent || window.pageContent || {};
    const defaults = [
        { id: 'global-ov-ca', class: 'ca', label: 'Phase 1', body: 'Edit phase description...' },
        { id: 'global-ov-cb', class: 'cb', label: 'Phase 2', body: 'Edit phase description...' },
        { id: 'global-ov-cg', class: 'cg', label: 'Phase 3', body: 'Edit phase description...' }
    ];
    grid.innerHTML = '';
    defaults.forEach(def => {
        if (content.hiddenDefaults?.includes(def.id)) return;
        const card = document.createElement('div'); card.className = `ov-card ${def.class}`; card.id = `${prefix}container-${def.id}`;
        const lbl = content[def.id + '-label'] || def.label; const bdy = content[def.id + '-body'] || def.body;
        card.innerHTML = `${(isEditMode && !prefix) ? '<button class="del-ov-btn" data-id="'+def.id+'">✕</button>' : ''}<div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}${def.id}-label" contenteditable="${isEditMode && !prefix}">${lbl}</div><div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}${def.id}-body" contenteditable="${isEditMode && !prefix}">${bdy}</div>`;
        grid.appendChild(card);
    });
    content.dynamicBlocks?.forEach(bId => {
        const card = document.createElement('div'); card.className = 'ov-card cg'; card.id = `${prefix}container-${bId}`;
        card.innerHTML = `${(isEditMode && !prefix) ? '<button class="del-ov-btn" data-id="'+bId+'">✕</button>' : ''}<div class="ov-label editable-global" id="${prefix}${bId}-title" contenteditable="${isEditMode && !prefix}">${content[bId + '-title'] || 'New'}</div><div class="ov-body editable-global" id="${prefix}${bId}-body" contenteditable="${isEditMode && !prefix}">${content[bId + '-body'] || 'Edit...'}</div>`;
        grid.appendChild(card);
    });
    if(!prefix && isEditMode) {
        grid.querySelectorAll('.del-ov-btn').forEach(b => b.onclick = () => { pushToUndo(); const id = b.dataset.id; if(id.startsWith('ov-')) window.pageContent.dynamicBlocks = window.pageContent.dynamicBlocks.filter(x => x !== id); else { if(!window.pageContent.hiddenDefaults) window.pageContent.hiddenDefaults = []; window.pageContent.hiddenDefaults.push(id); } renderDynamicOverviewBlocks(uid); });
    }
}

export function renderDailyTemplate(uid, prefix = "", customContent = null) {
    const list = document.getElementById(prefix + 'dynamic-tpl-list'); if (!list) return;
    const content = customContent || window.pageContent || {};
    const rows = content.templateRows || ['tpl-1', 'tpl-2', 'tpl-3', 'tpl-4', 'tpl-5', 'tpl-6', 'tpl-7'];
    const defs = { 'tpl-1-t': 'Step/Time', 'tpl-1-a': 'Add activity...', 'tpl-7-t': 'Review', 'tpl-7-a': 'Summary...' };
    list.innerHTML = '';
    rows.forEach(rId => {
        const row = document.createElement('div'); row.className = 'tpl-row';
        const t = content[rId + '-t'] || defs[rId + '-t'] || 'Step/Time'; const a = content[rId + '-a'] || defs[rId + '-a'] || 'Activity...';
        row.innerHTML = `${(isEditMode && !prefix) ? `<button class="del-tpl-btn" data-id="${rId}">✕</button>` : ''}<div class="tpl-time ${prefix ? '' : 'editable-global'}" id="${prefix}${rId}-t" contenteditable="${isEditMode && !prefix}">${t}</div><div class="tpl-act ${prefix ? '' : 'editable-global'}" id="${prefix}${rId}-a" contenteditable="${isEditMode && !prefix}">${a}</div>`;
        list.appendChild(row);
    });
    if (!prefix && isEditMode) {
        list.querySelectorAll('.del-tpl-btn').forEach(b => b.onclick = () => { pushToUndo(); window.pageContent.templateRows = rows.filter(x => x !== b.dataset.id); renderDailyTemplate(uid); });
    }
}
