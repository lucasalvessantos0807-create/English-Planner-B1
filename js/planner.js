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
        let monthToOpen = targetMonth;
        if (!monthToOpen) {
            const available = Object.keys(window.plannerConfig).sort();
            if (available.length > 0) monthToOpen = available[0].split('-')[0];
        }
        setTimeout(() => {
            const monthButtons = document.querySelectorAll('#monthNav .mbtn');
            const targetBtn = Array.from(monthButtons).find(b => b.textContent.trim() === `Month ${monthToOpen}`);
            if (targetBtn) { targetBtn.click(); } else if (monthButtons.length > 0) { monthButtons[0].click(); }
            mod.updateProgressBar();
        }, 100); 
    });
}

function pushToUndo() {
    undoStack.push({
        config: JSON.parse(JSON.stringify(window.plannerConfig)),
        content: JSON.parse(JSON.stringify(window.pageContent || {}))
    });
    document.getElementById('undoBtn').style.display = 'block';
}

export function performUndo(uid) {
    if (undoStack.length === 0) return;
    const lastState = undoStack.pop();
    window.plannerConfig = lastState.config;
    window.pageContent = lastState.content;
    refreshGlobalTexts();
    if (undoStack.length === 0) document.getElementById('undoBtn').style.display = 'none';
    refreshCurrentWeek(uid);
    renderDynamicOverviewBlocks(uid);
    renderDailyTemplate(uid);
}

function refreshGlobalTexts() {
    Object.keys(window.pageContent || {}).forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.id.includes('ov-') && !el.id.includes('tpl-')) { 
            el.innerHTML = window.pageContent[id];
        }
    });
}

export function cancelEdit(uid) {
    if (!confirm("Discard all changes?")) return;
    window.plannerConfig = JSON.parse(JSON.stringify(sessionInitialConfig));
    window.pageContent = JSON.parse(JSON.stringify(sessionInitialContent));
    isEditMode = false;
    document.getElementById('dynamic-ov-grid').classList.remove('edit-active');
    document.getElementById('addOverviewBlockBtn').style.display = 'none';
    const tplList = document.getElementById('dynamic-tpl-list');
    if (tplList) tplList.classList.remove('edit-active');
    const addTplBtn = document.getElementById('addTemplateRowBtn');
    if (addTplBtn) addTplBtn.style.display = 'none';
    document.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = "false";
        if (sessionInitialDOMSnapshot[el.id] !== undefined) { el.innerHTML = sessionInitialDOMSnapshot[el.id]; }
    });
    updateUIEditMode();
    renderDynamicOverviewBlocks(uid);
    renderDailyTemplate(uid);
    refreshUI(uid);
}

function updateUIEditMode() {
    const saveBtn = document.getElementById('saveChangesBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const undoBtn = document.getElementById('undoBtn');
    const fab = document.getElementById('fabWrapper');
    if (isEditMode) {
        if (fab) fab.classList.add('fab-hidden');
        if (saveBtn) saveBtn.style.display = "block";
        if (cancelBtn) cancelBtn.style.display = "block";
        if (undoBtn) undoBtn.style.display = (undoStack.length > 0) ? "block" : "none";
    } else {
        if (fab) fab.classList.remove('fab-hidden');
        if (saveBtn) saveBtn.style.display = "none";
        if (cancelBtn) cancelBtn.style.display = "none";
        if (undoBtn) undoBtn.style.display = "none";
    }
}

export function toggleEditMode(uid) {
    if (!isEditMode) {
        sessionInitialConfig = JSON.parse(JSON.stringify(window.plannerConfig));
        sessionInitialContent = JSON.parse(JSON.stringify(window.pageContent || {}));
        sessionInitialDOMSnapshot = {};
        document.querySelectorAll('.editable-global').forEach(el => {
            sessionInitialDOMSnapshot[el.id] = el.innerHTML;
        });
        undoStack = [];
        isEditMode = true;
        document.getElementById('dynamic-ov-grid').classList.add('edit-active');
        document.getElementById('addOverviewBlockBtn').style.display = 'block';
        const tplList = document.getElementById('dynamic-tpl-list');
        if (tplList) tplList.classList.add('edit-active');
        const addTplBtn = document.getElementById('addTemplateRowBtn');
        if (addTplBtn) addTplBtn.style.display = 'block';
    } else {
        addHistoryEntry("Before Edit", sessionInitialConfig, sessionInitialContent);
        saveUserData(uid);
        isEditMode = false;
        document.getElementById('dynamic-ov-grid').classList.remove('edit-active');
        document.getElementById('addOverviewBlockBtn').style.display = 'none';
        const tplList = document.getElementById('dynamic-tpl-list');
        if (tplList) tplList.classList.remove('edit-active');
        const addTplBtn = document.getElementById('addTemplateRowBtn');
        if (addTplBtn) addTplBtn.style.display = 'none';
    }
    updateUIEditMode();
    document.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = isEditMode;
        if (isEditMode) {
            el.onfocus = () => pushToUndo();
            el.onblur = () => { if (!window.pageContent) window.pageContent = {}; window.pageContent[el.id] = el.innerHTML; };
        }
    });
    refreshCurrentWeek(uid);
    renderDynamicOverviewBlocks(uid);
    renderDailyTemplate(uid);
}

function refreshCurrentWeek(uid) {
    builtWeeks.clear();
    const active = document.querySelector('.mpanel.on .wpanel.on');
    if (active) {
        const idParts = active.id.replace('wp', '').split('-');
        buildWeek(idParts[0], idParts[1], uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')));
    }
}

export function buildWeek(m, w, uid, openDays = [], isPreview = false, prefix = "", customConfig = null, customState = null) {
    const config = customConfig || window.plannerConfig;
    const activeState = customState || window.appState;
    const key = `${m}-${w}`;
    const wk = config[key];
    const container = document.getElementById(`${prefix}wp${m}-${w}`);
    if (!wk || !container) return;
    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p contenteditable="${isEditMode && !isPreview}" data-type="theme" data-week="${key}">${wk.theme}</p></div>`;
    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const fullKey = `m${m}-${dayKey}`;
        const dayData = activeState[fullKey] || activeState[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        const isOpen = openDays.includes(day.n.toString());
        const activitiesHtml = day.activities.map((act, aIdx) => {
            let suggestionsHtml = (isEditMode && !isPreview) ? `<div class="icon-suggestions">${EMOJI_LIST.map(emoji => `<span class="suggest-emoji" data-emoji="${emoji}">${emoji}</span>`).join('')}</div>` : '';
            return `<div class="act"><div class="aico-wrapper"><div class="aico ${act.t}" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.i">${act.i}</div>${suggestionsHtml}</div><div class="acont"><div class="atitle" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.title">${act.title}</div><div class="adesc" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.desc">${act.desc}</div></div><div class="atime" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.time">${act.time}</div>${(isEditMode && !isPreview) ? `<div class="del-act" data-week="${key}" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}</div>`;
        }).join('');
        card.innerHTML = `<div class="dayhead ${day.review ? 'rv' : ''}"><div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div><div class="dayname">${day.name}</div><div class="daytag" contenteditable="${isEditMode && !isPreview}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div></div><div class="daybody ${isOpen ? 'on' : ''}" id="${prefix}db${day.n}"><div class="activities-container">${activitiesHtml}</div>${(isEditMode && !isPreview) ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}<textarea class="ntxt" id="${prefix}nt${day.n}" placeholder="Notes..." ${isPreview ? 'readonly' : ''}>${dayData.notes || ""}</textarea><label class="chk ${dayData.done ? 'done' : ''}"><input type="checkbox" ${dayData.done ? 'checked' : ''} ${isPreview ? 'disabled' : ''}><span>Completed</span></label></div>`;
        if (isEditMode && !isPreview) {
            card.querySelectorAll('.aico').forEach(icon => { icon.onclick = (e) => { e.stopPropagation(); const wrapper = icon.closest('.aico-wrapper'); const wasOpen = wrapper.classList.contains('show-suggestions'); document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions')); if (!wasOpen) wrapper.classList.add('show-suggestions'); }; });
            card.querySelectorAll('.suggest-emoji').forEach(sug => { sug.onclick = (e) => { pushToUndo(); const emoji = e.target.dataset.emoji; const act = e.target.closest('.act'); const titleEl = act.querySelector('.atitle'); const path = titleEl.dataset.path; const [wkK, dI, aI] = path.split('.'); act.querySelector('.aico').innerText = emoji; window.plannerConfig[wkK].days[dI].activities[aI].i = emoji; if (ICON_MAP[emoji]) { titleEl.innerText = ICON_MAP[emoji]; window.plannerConfig[wkK].days[dI].activities[aI].title = ICON_MAP[emoji]; } }; });
            card.querySelectorAll('[contenteditable]').forEach(el => { el.onblur = () => { const path = el.dataset.path; if (path) { const [wkK, dI, aI, prop] = path.split('.'); window.plannerConfig[wkK].days[dI].activities[aI][prop] = el.innerText; } else if (el.dataset.type === 'tag') { window.plannerConfig[el.dataset.week].days[el.dataset.dayidx].tag = el.innerText; } else if (el.dataset.type === 'theme') { window.plannerConfig[el.dataset.week].theme = el.innerText; } }; });
            const addBtn = card.querySelector('.add-act-btn');
            if (addBtn) addBtn.onclick = () => { pushToUndo(); window.plannerConfig[addBtn.dataset.week].days[addBtn.dataset.dayidx].activities.push({t: "grammar", i: "📝", title: "New Activity", desc: "Edit", time: "20m"}); buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')), isPreview, prefix, config, activeState); };
            card.querySelectorAll('.del-act').forEach(btn => { btn.onclick = () => { if(confirm("Delete activity?")) { pushToUndo(); window.plannerConfig[btn.dataset.week].days[btn.dataset.dayidx].activities.splice(btn.dataset.actidx, 1); buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')), isPreview, prefix, config, activeState); } }; });
        }
        card.querySelector('.dayhead').onclick = (e) => { if (!e.target.hasAttribute('contenteditable') && !e.target.closest('.aico-wrapper')) { card.querySelector('.daybody').classList.toggle('on'); } };
        if (!isPreview) {
            const textarea = card.querySelector('textarea');
            textarea.oninput = (e) => { updateState(m, dayKey, { notes: e.target.value }); saveUserData(uid); };
            const chk = card.querySelector('input[type="checkbox"]');
            chk.onchange = (e) => { updateState(m, dayKey, { done: e.target.checked }); card.querySelector('.chk').classList.toggle('done', e.target.checked); saveUserData(uid); updateProgressBar(); };
        }
        container.appendChild(card);
    });
}

export function addNewMonth(uid) {
    const dayCount = parseInt(prompt("How many days?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    addHistoryEntry("Before Add Month", window.plannerConfig, window.pageContent);
    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    let currentDay = 1;
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        window.plannerConfig[`${nextMonth}-${w}`] = {
            label: `Week ${w}`, theme: "Plans",
            days: Array.from({length: daysInW}, (_, i) => {
                const d = currentDay++;
                return { n: d, name: dayNames[i], tag: "Activity", activities: [{t:"grammar", i:"📝", title:"Task", desc:"Edit", time: "20m"}] };
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid, nextMonth));
}

export function editMonthStructure(m, uid) {
    let dayCountInput = prompt(`How many days for Month ${m}?`, "30");
    if (dayCountInput === null) return;
    let dayCount = parseInt(dayCountInput);
    if (isNaN(dayCount) || dayCount <= 0) return;
    const weeksOfM = Object.keys(window.plannerConfig).filter(k => k.startsWith(`${m}-`)).sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
    const existingDays = [];
    weeksOfM.forEach(wk => { window.plannerConfig[wk].days.forEach(d => { existingDays.push(JSON.parse(JSON.stringify(d))); }); });
    if (dayCount < existingDays.length) { if (!confirm(`Delete extra days?`)) return; }
    addHistoryEntry(`Before Restructure Month ${m}`, window.plannerConfig, window.pageContent);
    weeksOfM.forEach(wk => delete window.plannerConfig[wk]);
    let currentDayIdx = 0;
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        const weekDays = [];
        for (let d = 0; d < daysInW; d++) {
            const newDayNum = currentDayIdx + 1;
            if (existingDays[currentDayIdx]) {
                const preserved = existingDays[currentDayIdx];
                preserved.n = newDayNum; preserved.name = dayNames[d];
                weekDays.push(preserved);
            } else {
                weekDays.push({ n: newDayNum, name: dayNames[d], tag: "Activity", activities: [{t:"grammar", i:"📝", title:"Task", desc:"Edit", time: "20m"}] });
            }
            currentDayIdx++;
        }
        window.plannerConfig[`${m}-${w}`] = { label: `Week ${w}`, theme: "Updated", days: weekDays };
    }
    saveUserData(uid).then(() => refreshUI(uid, m));
}

export function deleteMonth(m, uid) {
    if (confirm(`Delete Month ${m}?`)) {
         addHistoryEntry(`Before Deleting Month ${m}`, window.plannerConfig, window.pageContent);
         Object.keys(window.plannerConfig).forEach(k => { if (k.startsWith(`${m}-`)) delete window.plannerConfig[k]; });
         saveUserData(uid).then(() => refreshUI(uid));
     }
}

export function addOverviewBlock(uid) {
    if (!isEditMode) return;
    pushToUndo();
    const blockId = 'ov-' + Date.now();
    if(!window.pageContent.dynamicBlocks) window.pageContent.dynamicBlocks = [];
    window.pageContent.dynamicBlocks.push(blockId);
    renderDynamicOverviewBlocks(uid);
}

export function renderDynamicOverviewBlocks(uid, prefix = "", customContent = null) {
    const gridId = prefix + 'dynamic-ov-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const content = customContent || window.pageContent || {};
    grid.innerHTML = '';
    if(content.dynamicBlocks) {
        content.dynamicBlocks.forEach(blockId => {
            const newBlock = document.createElement('div');
            newBlock.className = 'ov-card cg';
            newBlock.id = `${prefix}container-${blockId}`;
            newBlock.innerHTML = `
                ${(isEditMode && !prefix) ? '<button class="del-ov-btn" data-type="dynamic" data-id="' + blockId + '" style="display:flex;">✕</button>' : ''}
                <div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}${blockId}-title" contenteditable="${isEditMode && !prefix}">${content[blockId + '-title'] || 'Phase'}</div>
                <div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}${blockId}-body" contenteditable="${isEditMode && !prefix}">${content[blockId + '-body'] || 'Edit focus...'}</div>
            `;
            grid.appendChild(newBlock);
        });
    }
    if (!prefix && isEditMode) {
        grid.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onfocus = () => pushToUndo();
            el.onblur = () => { window.pageContent[el.id] = el.innerHTML; };
        });
        grid.querySelectorAll('.del-ov-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const bId = btn.dataset.id;
                if(confirm("Delete block?")) {
                    pushToUndo();
                    const elToRemove = document.getElementById(`container-${bId}`);
                    if (elToRemove) elToRemove.remove();
                    window.pageContent.dynamicBlocks = window.pageContent.dynamicBlocks.filter(id => id !== bId);
                }
            };
        });
    }
}

export function renderDailyTemplate(uid, prefix = "", customContent = null) {
    const listId = prefix + 'dynamic-tpl-list';
    const list = document.getElementById(listId);
    if (!list) return;
    const content = customContent || window.pageContent || {};
    if (!content.templateRows) content.templateRows = [];
    list.innerHTML = '';
    content.templateRows.forEach(rowId => {
        const row = document.createElement('div');
        row.className = 'tpl-row';
        row.id = `${prefix}row-container-${rowId}`;
        row.innerHTML = `
            ${(isEditMode && !prefix) ? `<button class="del-tpl-btn" data-id="${rowId}">✕</button>` : ''}
            <div class="tpl-time ${prefix ? '' : 'editable-global'}" id="${prefix}${rowId}-t" contenteditable="${isEditMode && !prefix}">${content[rowId + '-t'] || '00:00'}</div>
            <div class="tpl-act ${prefix ? '' : 'editable-global'}" id="${prefix}${rowId}-a" contenteditable="${isEditMode && !prefix}">${content[rowId + '-a'] || 'Task...'}</div>
        `;
        list.appendChild(row);
    });
    if (!prefix && isEditMode) {
        list.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onfocus = () => pushToUndo();
            el.onblur = () => { if (!window.pageContent) window.pageContent = {}; window.pageContent[el.id] = el.innerHTML; };
        });
        list.querySelectorAll('.del-tpl-btn').forEach(btn => {
            btn.onclick = () => {
                const rId = btn.dataset.id;
                if(confirm("Delete task?")) {
                    pushToUndo();
                    window.pageContent.templateRows = window.pageContent.templateRows.filter(id => id !== rId);
                    renderDailyTemplate(uid);
                }
            };
        });
    }
}

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'addTemplateRowBtn') {
        import('./storage.js').then(store => {
            const user = window.auth.currentUser;
            if (!user || !isEditMode) return;
            const uid = user.uid;
            pushToUndo();
            const newId = 'tpl-' + Date.now();
            if(!window.pageContent.templateRows) window.pageContent.templateRows = [];
            window.pageContent.templateRows.push(newId);
            renderDailyTemplate(uid);
        });
    }
});
