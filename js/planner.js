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
            
            if (targetBtn) {
                targetBtn.click();
            } else if (monthButtons.length > 0) {
                monthButtons[0].click();
            }
            mod.updateProgressBar();
        }, 100); 
    });
}

// --- FUNÇÕES DE UNDO E AUXILIARES ---
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

// --- CONTROLE DO MODO DE EDIÇÃO ---

export function cancelEdit(uid) {
    if (!confirm("Discard all changes made in this session?")) return;
    
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
        if (sessionInitialDOMSnapshot[el.id] !== undefined) {
            el.innerHTML = sessionInitialDOMSnapshot[el.id];
        }
    });

    updateUIEditMode();
    const currentLang = window.appState?.language || 'en';
    renderDynamicOverviewBlocks(uid, "", window.pageContent, currentLang);
    renderDailyTemplate(uid, "", window.pageContent, currentLang);
    refreshUI(uid);
}

function updateUIEditMode() {
    const saveBtn = document.getElementById('saveChangesBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const undoBtn = document.getElementById('undoBtn');
    const editBtn = document.getElementById('editModeBtn');
    const personalizeBtn = document.getElementById('personalizeBtn');
    const openNotesBtn = document.getElementById('openNotesBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const switchBtn = document.getElementById('switchAccountBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const fab = document.getElementById('fabWrapper');
    
    if (isEditMode) {
        if (saveBtn) saveBtn.style.display = "flex";
        if (cancelBtn) cancelBtn.style.display = "flex";
        if (undoBtn) undoBtn.style.display = (undoStack.length > 0) ? "flex" : "none";
        
        if (editBtn) editBtn.style.display = "none";
        if (personalizeBtn) personalizeBtn.style.display = "none";
        if (openNotesBtn) openNotesBtn.style.display = "none";
        if (settingsBtn) settingsBtn.style.display = "none";
        if (switchBtn) switchBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";

        if (fab) fab.classList.add('open');
    } else {
        if (saveBtn) saveBtn.style.display = "none";
        if (cancelBtn) cancelBtn.style.display = "none";
        if (undoBtn) undoBtn.style.display = "none";
        
        if (editBtn) editBtn.style.display = "flex";
        if (personalizeBtn) personalizeBtn.style.display = "flex";
        if (openNotesBtn) openNotesBtn.style.display = "flex";
        if (settingsBtn) settingsBtn.style.display = "flex";
        if (switchBtn) switchBtn.style.display = "flex";
        if (logoutBtn) logoutBtn.style.display = "flex";

        if (fab) fab.classList.remove('open');
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
        const currentConfigStr = JSON.stringify(window.plannerConfig);
        const initialConfigStr = JSON.stringify(sessionInitialConfig);
        const currentContentStr = JSON.stringify(window.pageContent);
        const initialContentStr = JSON.stringify(sessionInitialContent);

        if (currentConfigStr !== initialConfigStr || currentContentStr !== initialContentStr) {
            addHistoryEntry("Before Edit Session", sessionInitialConfig, sessionInitialContent);
            saveUserData(uid);
        }
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
            el.onblur = () => {
                if (!window.pageContent) window.pageContent = {};
                window.pageContent[el.id] = el.innerHTML;
                saveUserData(uid);
            };
        }
    });
    const currentLang = window.appState?.language || 'en';
    refreshCurrentWeek(uid);
    renderDynamicOverviewBlocks(uid, "", window.pageContent, currentLang);
    renderDailyTemplate(uid, "", window.pageContent, currentLang);
}

// --- RENDERIZAÇÃO DE SEMANAS E DIAS ---
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
    const lang = window.appState?.language || 'en';
    const t = (window.translations || {})[lang] || (window.translations || {}).en || {};

    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${t.week || 'Week'} ${w}</h3><p contenteditable="${isEditMode && !isPreview}" data-type="theme" data-week="${key}">${wk.theme}</p></div>`;

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = activeState[`m${m}-${dayKey}`] || activeState[dayKey] || { done: false, notes: "" };
        const dayNamesDict = {
            en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            pt: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"],
            es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
            fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
        };
        const isNative = (typeof window.isNativeText === 'function') ? window.isNativeText(day.name) : false;
        const displayName = isNative ? (dayNamesDict[lang][(day.n - 1) % 7]) : day.name;

        const activitiesHtml = day.activities.map((act, aIdx) => {
            const isNativeTitle = (typeof window.isNativeText === 'function') ? window.isNativeText(act.title) : false;
            const isNativeDesc = (typeof window.isNativeText === 'function') ? window.isNativeText(act.desc) : false;
            const displayTitle = isNativeTitle ? t.studyTopic : act.title;
            const displayDesc = isNativeDesc ? t.editDetails : act.desc;
            return `<div class="act"><div class="aico-wrapper"><div class="aico ${act.t}" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.i">${act.i}</div></div><div class="acont"><div class="atitle" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.title">${displayTitle}</div><div class="adesc" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.desc">${displayDesc}</div></div><div class="atime" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.time">${act.time}</div>${(isEditMode && !isPreview) ? `<div class="del-act" data-week="${key}" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}</div>`;
        }).join('');

        const isNativeTag = (typeof window.isNativeText === 'function') ? window.isNativeText(day.tag) : false;
        const displayTag = isNativeTag ? t.dailyAct : day.tag;

        const card = document.createElement("div");
        card.className = "daycard";
        card.innerHTML = `<div class="dayhead ${day.review ? 'rv' : ''}"><div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div><div class="dayname">${displayName}</div><div class="daytag" contenteditable="${isEditMode && !isPreview}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${displayTag}</div></div><div class="daybody ${openDays.includes(day.n.toString()) ? 'on' : ''}" id="${prefix}db${day.n}"><div class="activities-container">${activitiesHtml}</div>${(isEditMode && !isPreview) ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ ${t.activity || 'Add'}</button>` : ''}<textarea class="ntxt" placeholder="${t.notes || 'Notes...'}" ${isPreview ? 'readonly' : ''}>${dayData.notes || ""}</textarea><label class="chk ${dayData.done ? 'done' : ''}"><input type="checkbox" ${dayData.done ? 'checked' : ''}><span>${t.completed || 'Completed'}</span></label></div>`;
        container.appendChild(card);
    });
}

// --- GESTÃO DE MESES ---
export function addNewMonth(uid) {
    const lang = window.appState?.language || 'en';
    const t = (window.translations || {})[lang] || (window.translations || {}).en || {};
    
    const dayCount = parseInt(prompt(t.promptDays || "Days?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    
    addHistoryEntry("Before Adding Month", window.plannerConfig, window.pageContent);
    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    
    const dayNamesDict = {
        en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        pt: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"],
        es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
        fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    };
    const dayNames = dayNamesDict[lang] || dayNamesDict.en;

    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        window.plannerConfig[`${nextMonth}-${w}`] = {
            label: `${t.week || 'Week'} ${w}`, theme: t.monthlyPlans || "Plans",
            days: Array.from({length: daysInW}, (_, i) => ({
                n: ((w-1)*7) + i + 1, 
                name: dayNames[i % 7], 
                tag: t.dailyAct || "Activity", 
                activities: [{t:"grammar", i:"📝", title: t.studyTopic || "Topic", desc: t.editDetails || "Edit", time: "20m"}]
            }))
        };
    }
    saveUserData(uid).then(() => refreshUI(uid, nextMonth));
}

export function editMonthStructure(m, uid) {
    const lang = window.appState?.language || 'en';
    const t = (window.translations || {})[lang] || (window.translations || {}).en || {};
    
    let dayCountInput = prompt((t.promptMonthDays || "Days?").replace('{m}', m), "30");
    if (dayCountInput === null) return;
    let dayCount = parseInt(dayCountInput);
    if (isNaN(dayCount) || dayCount <= 0) return;

    const weeksOfM = Object.keys(window.plannerConfig)
        .filter(k => k.startsWith(`${m}-`))
        .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

    const existingDays = [];
    weeksOfM.forEach(wk => {
        window.plannerConfig[wk].days.forEach(d => {
            existingDays.push(JSON.parse(JSON.stringify(d)));
        });
    });

    if (dayCount < existingDays.length) {
        if (!confirm(t.promptRestructure || "Confirm?")) return;
    }

    addHistoryEntry(`Before Restructuring Month ${m}`, window.plannerConfig, window.pageContent);
    weeksOfM.forEach(wk => delete window.plannerConfig[wk]);

    const dayNamesDict = {
        en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        pt: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"],
        es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
        fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    };
    const dayNames = dayNamesDict[lang] || dayNamesDict.en;

    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        const weekDays = [];
        for (let d = 0; d < daysInW; d++) {
            const currentIdx = ((w-1)*7) + d;
            if (existingDays[currentIdx]) {
                const preserved = existingDays[currentIdx];
                preserved.n = currentIdx + 1;
                preserved.name = dayNames[d % 7];
                weekDays.push(preserved);
            } else {
                weekDays.push({ 
                    n: currentIdx + 1, name: dayNames[d % 7], tag: t.dailyAct || "Activity", 
                    activities: [{t:"grammar", i:"📝", title: t.studyTopic || "Topic", desc: t.editDetails || "Edit", time: "20m"}]
                });
            }
        }
        window.plannerConfig[`${m}-${w}`] = { label: `${t.week || 'Week'} ${w}`, theme: t.monthlyPlans || "Plans", days: weekDays };
    }
    saveUserData(uid).then(() => refreshUI(uid, m));
}

export function deleteMonth(m, uid) {
    if (confirm(`Are you sure you want to delete Month ${m}?`)) {
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
    const lang = window.appState?.language || 'en';
    renderDynamicOverviewBlocks(uid, "", window.pageContent, lang);
}

export function renderDynamicOverviewBlocks(uid, prefix = "", customContent = null, langCode = 'en') {
    const gridId = prefix + 'dynamic-ov-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const content = customContent || window.pageContent || {};
    const t = (window.translations || {})[langCode] || (window.translations || {}).en || {};
    grid.innerHTML = '';
    if (content.dynamicBlocks) {
        content.dynamicBlocks.forEach(blockId => {
            const newBlock = document.createElement('div');
            newBlock.className = 'ov-card cg';
            newBlock.id = `${prefix}container-${blockId}`;
            let currentTitle = content[blockId + '-title'] || '';
            let displayTitle = currentTitle;
            if (blockId.includes('first')) {
                displayTitle = (t.phase || 'Phase') + " " + blockId.split('-').pop();
            } else if (!currentTitle || (window.isNativeText && window.isNativeText(currentTitle))) {
                displayTitle = (t.phase || 'Phase') + " X";
            }
            const currentBody = content[blockId + '-body'] || '';
            const displayBody = (window.isNativeText && window.isNativeText(currentBody)) ? (t.editFocus || 'Focus') : (currentBody || (t.editFocus || 'Focus'));
            newBlock.innerHTML = `${(isEditMode && !prefix) ? `<button class="del-ov-btn" data-id="${blockId}" style="display:flex;">✕</button>` : ''}<div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}${blockId}-title" contenteditable="${isEditMode && !prefix}">${displayTitle}</div><div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}${blockId}-body" contenteditable="${isEditMode && !prefix}">${displayBody}</div>`;
            grid.appendChild(newBlock);
        });
    }
}

export function renderDailyTemplate(uid, prefix = "", customContent = null, langCode = 'en') {
    const listId = prefix + 'dynamic-tpl-list';
    const list = document.getElementById(listId);
    if (!list) return;

    const content = customContent || window.pageContent || {};
    const t = (window.translations || {})[langCode] || (window.translations || {}).en || {};
    if (!content.templateRows) content.templateRows = [];
    list.innerHTML = '';

    content.templateRows.forEach(rowId => {
        const row = document.createElement('div');
        row.className = 'tpl-row';
        row.id = `${prefix}row-container-${rowId}`;

        const currentAct = content[rowId + '-a'];
        const displayAct = (window.isNativeText && window.isNativeText(currentAct)) ? (t.editTask || 'Task') : (currentAct || (t.editTask || 'Task'));

        row.innerHTML = `
            ${(isEditMode && !prefix) ? '<button class="del-tpl-btn" data-id="' + rowId + '">✕</button>' : ''}
            <div class="tpl-time ${prefix ? '' : 'editable-global'}" id="${prefix}${rowId}-t" contenteditable="${isEditMode && !prefix}">${content[rowId + '-t'] || '00:00'}</div>
            <div class="tpl-act ${prefix ? '' : 'editable-global'}" id="${prefix}${rowId}-a" contenteditable="${isEditMode && !prefix}">${displayAct}</div>
        `;
        list.appendChild(row);
    });

    if (!prefix && isEditMode) {
        list.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onfocus = () => pushToUndo();
            el.onblur = () => { 
                if (!window.pageContent) window.pageContent = {}; 
                window.pageContent[el.id] = el.innerHTML; 
                saveUserData(uid); 
            };
        });
        
        list.querySelectorAll('.del-tpl-btn').forEach(btn => {
            btn.onclick = () => {
                const rId = btn.dataset.id;
                if (confirm("Delete this task?")) {
                    pushToUndo();
                    window.pageContent.templateRows = window.pageContent.templateRows.filter(id => id !== rId);
                    renderDailyTemplate(uid, "", window.pageContent, langCode);
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
            const lang = window.appState?.language || 'en';
            renderDailyTemplate(uid, "", window.pageContent, lang);
        });
    }
});
