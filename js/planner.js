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

function pushToUndo() {
    undoStack.push({
        config: JSON.parse(JSON.stringify(window.plannerConfig)),
        content: JSON.parse(JSON.stringify(window.pageContent || {}))
    });
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.style.display = 'block';
}

export function performUndo(uid) {
    if (undoStack.length === 0) return;
    const lastState = undoStack.pop();
    window.plannerConfig = lastState.config;
    window.pageContent = lastState.content;
    refreshGlobalTexts();
    const undoBtn = document.getElementById('undoBtn');
    if (undoStack.length === 0 && undoBtn) undoBtn.style.display = 'none';
    refreshCurrentWeek(uid);
}

function refreshGlobalTexts() {
    Object.keys(window.pageContent || {}).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = window.pageContent[id];
    });
}

export function cancelEdit(uid) {
    if (!confirm("Discard all changes made in this session?")) return;
    
    window.plannerConfig = JSON.parse(JSON.stringify(sessionInitialConfig));
    window.pageContent = JSON.parse(JSON.stringify(sessionInitialContent));
    
    isEditMode = false;

    document.getElementById('dynamic-ov-grid').classList.remove('edit-active');
    document.getElementById('addOverviewBlockBtn').style.display = 'none';

    document.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = "false";
        if (sessionInitialDOMSnapshot[el.id] !== undefined) {
            el.innerHTML = sessionInitialDOMSnapshot[el.id];
        }
    });

    updateUIEditMode();
    refreshUI(uid);
}

function updateUIEditMode() {
    const btn = document.getElementById('editModeBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const undoBtn = document.getElementById('undoBtn');
    
    if (btn) {
        btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
        btn.style.background = isEditMode ? "var(--green-light)" : "none";
        btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    }
    if (cancelBtn) cancelBtn.style.display = isEditMode ? "block" : "none";
    if (undoBtn && !isEditMode) undoBtn.style.display = "none";
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
    }
    updateUIEditMode();
    document.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = isEditMode;
        if (isEditMode) {
            el.onfocus = () => pushToUndo();
            el.onblur = () => {
                if (!window.pageContent) window.pageContent = {};
                window.pageContent[el.id] = el.innerHTML;
            };
        }
    });
    refreshCurrentWeek(uid);
    renderDynamicOverviewBlocks(uid);
}

function refreshCurrentWeek(uid) {
    builtWeeks.clear();
    const active = document.querySelector('.mpanel.on .wpanel.on');
    if (active) {
        const idParts = active.id.replace('wp', '').split('-');
        buildWeek(idParts[0], idParts[1], uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')));
    }
}

export function buildWeek(m, w, uid, openDays = [], isPreview = false, targetPrefix = "", customConfig = null, customState = null) {
    const key = `${m}-${w}`;
    const config = customConfig || window.plannerConfig;
    const activeState = customState || window.appState || window.state;
    
    const containerId = targetPrefix ? `${targetPrefix}wp${m}-${w}` : `wp${m}-${w}`;
    const container = document.getElementById(containerId);
    
    const wk = config[key];
    if (!wk || !container) return;

    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p contenteditable="${isEditMode && !isPreview}" data-type="theme" data-week="${key}">${wk.theme}</p></div>`;

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = activeState[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        const isOpen = openDays.includes(day.n.toString());

        const activitiesHtml = day.activities.map((act, aIdx) => {
            let suggestionsHtml = (isEditMode && !isPreview) ? `<div class="icon-suggestions">${EMOJI_LIST.map(emoji => `<span class="suggest-emoji" data-emoji="${emoji}">${emoji}</span>`).join('')}</div>` : '';
            return `
                <div class="act">
                    <div class="aico-wrapper">
                        <div class="aico ${act.t}" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.i">${act.i}</div>
                        ${suggestionsHtml}
                    </div>
                    <div class="acont">
                        <div class="atitle" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.title">${act.title}</div>
                        <div class="adesc" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.desc">${act.desc}</div>
                    </div>
                    <div class="atime" contenteditable="${isEditMode && !isPreview}" data-path="${key}.${dIdx}.${aIdx}.time">${act.time}</div>
                    ${(isEditMode && !isPreview) ? `<div class="del-act" data-week="${key}" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}
                </div>`;
        }).join('');

        const dbId = targetPrefix ? `${targetPrefix}db${day.n}` : `db${day.n}`;
        const ntId = targetPrefix ? `${targetPrefix}nt${day.n}` : `nt${day.n}`;

        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div>
                <div class="dayname">${day.name}</div>
                <div class="daytag" contenteditable="${isEditMode && !isPreview}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div>
            </div>
            <div class="daybody ${isOpen ? 'on' : ''}" id="${dbId}">
                <div class="activities-container">${activitiesHtml}</div>
                ${(isEditMode && !isPreview) ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}
                <textarea class="ntxt" id="${ntId}" placeholder="Notes..." ${isPreview ? 'disabled' : ''}>${dayData.notes || ""}</textarea>
                <label class="chk ${dayData.done ? 'done' : ''}"><input type="checkbox" ${dayData.done ? 'checked' : ''} ${isPreview ? 'disabled' : ''}><span>Day ${day.n} completed</span></label>
            </div>`;

        if (isEditMode && !isPreview) {
            card.querySelectorAll('.aico').forEach(icon => {
               icon.onclick = (e) => {
                    e.stopPropagation();
                    const wrapper = icon.closest('.aico-wrapper');
                    const wasOpen = wrapper.classList.contains('show-suggestions');
                    document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions'));
                    if (!wasOpen) wrapper.classList.add('show-suggestions');
                };
            });
            card.querySelectorAll('.suggest-emoji').forEach(sug => {
                sug.onclick = (e) => {
                    pushToUndo();
                    const emoji = e.target.dataset.emoji;
                    const act = e.target.closest('.act');
                    const titleEl = act.querySelector('.atitle');
                    const path = titleEl.dataset.path;
                    const [wkK, dI, aI] = path.split('.');
                    act.querySelector('.aico').innerText = emoji;
                    window.plannerConfig[wkK].days[dI].activities[aI].i = emoji;
                    if (ICON_MAP[emoji]) {
                        titleEl.innerText = ICON_MAP[emoji];
                        window.plannerConfig[wkK].days[dI].activities[aI].title = ICON_MAP[emoji];
                    }
                };
            });
        }

        card.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onfocus = () => { if(isEditMode && !isPreview) pushToUndo(); };
            el.onblur = (e) => {
                const path = e.target.dataset.path;
                const type = e.target.dataset.type;
                if (path) {
                    const [wkK, dI, aI, field] = path.split('.');
                    const actualField = field === 'i' ? 'i' : (e.target.classList.contains('atitle') ? 'title' : (e.target.classList.contains('adesc') ? 'desc' : 'time'));
                    window.plannerConfig[wkK].days[dI].activities[aI][actualField] = e.target.innerText;
                } else if (type === 'tag') {
                    window.plannerConfig[e.target.dataset.week].days[e.target.dataset.dayidx].tag = e.target.innerText;
                } else if (type === 'theme') {
                    window.plannerConfig[e.target.dataset.week].theme = e.target.innerText;
                }
            };
        });

        const addBtn = card.querySelector('.add-act-btn');
        if (addBtn) addBtn.onclick = () => {
            pushToUndo();
            window.plannerConfig[addBtn.dataset.week].days[addBtn.dataset.dayidx].activities.push({t: "grammar", i: "📝", title: "New Activity", desc: "Edit", time: "20m"});
            buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')), isPreview, targetPrefix, config, activeState);
        };

        card.querySelectorAll('.del-act').forEach(btn => {
            btn.onclick = () => {
                if(confirm("Delete this activity?")) {
                    pushToUndo();
                    window.plannerConfig[btn.dataset.week].days[btn.dataset.dayidx].activities.splice(btn.dataset.actidx, 1);
                    buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')), isPreview, targetPrefix, config, activeState);
                }
            };
        });

        card.querySelector('.dayhead').onclick = (e) => {
            if (!e.target.hasAttribute('contenteditable') && !e.target.closest('.aico-wrapper')) {
                card.querySelector('.daybody').classList.toggle('on');
            }
        };

        if (!isPreview) {
            const textarea = card.querySelector('textarea');
            textarea.oninput = (e) => { updateState(dayKey, { notes: e.target.value }); saveUserData(uid); };
            const chk = card.querySelector('input[type="checkbox"]');
            chk.onchange = (e) => {
                updateState(dayKey, { done: e.target.checked });
                card.querySelector('.chk').classList.toggle('done', e.target.checked);
                saveUserData(uid);
                updateProgressBar();
            };
        }

        container.appendChild(card);
    });
}

export function addNewMonth(uid) {
    const dayCount = parseInt(prompt("How many days?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    
    addHistoryEntry("Before Adding Month", window.plannerConfig, window.pageContent);
    
    const existingMonths = [...new Set(Object.keys(window.plannerConfig).map(k => parseInt(k.split('-')[0])))];
    const nextMonth = existingMonths.length > 0 ? Math.max(...existingMonths) + 1 : 1;
    
    // Calcula o último dia absoluto para continuar a contagem
    let lastDay = 0;
    Object.values(window.plannerConfig).forEach(week => {
        week.days.forEach(day => {
            if (day.n > lastDay) lastDay = day.n;
        });
    });
    
    let currentDay = lastDay + 1;
    const totalWeeks = Math.ceil(dayCount / 7);
    
    for (let w = 1; w <= totalWeeks; w++) {
        const daysInThisWeek = Math.min(7, dayCount - ((w - 1) * 7));
        const weekKey = `${nextMonth}-${w}`;
        
        window.plannerConfig[weekKey] = {
            label: `Week ${w}`,
            theme: "New Month Focus",
            days: Array.from({length: daysInThisWeek}, () => {
                const d = currentDay++;
                const weekDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                const dayName = weekDayNames[(d - 1) % 7];
                
                return {
                    n: d,
                    name: dayName,
                    tag: "Act",
                    activities: [{t:"grammar", i:"📐", title:"New Topic", desc:"Edit details...", time: "20m"}]
                };
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid));
}

export function editMonthStructure(m, uid) {
    const dayCount = parseInt(prompt("Total days?", "30")), startDay = parseInt(prompt("Start Day?", "1"));
    if (isNaN(dayCount)) return;
    addHistoryEntry(`Before Restructuring Month ${m}`, window.plannerConfig, window.pageContent);
    Object.keys(window.plannerConfig).forEach(k => { if (k.startsWith(`${m}-`)) delete window.plannerConfig[k]; });
    let currentDay = startDay;
    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        window.plannerConfig[`${m}-${w}`] = {
            label: `Week ${w}`, theme: "Adjusted",
            days: Array.from({length: daysInW}, () => {
                const d = currentDay++;
                return { n: d, name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(d - 1) % 7], tag: "Act", activities: [{t:"grammar", i:"📐", title:"Topic", desc:"Edit", time: "20m"}]};
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid));
}

export function deleteMonth(m, uid) {
   if (confirm(`Delete Month ${m}?`)) {
        addHistoryEntry(`Before Deleting Month ${m}`, window.plannerConfig, window.pageContent);
        Object.keys(window.plannerConfig).forEach(k => { if (k.startsWith(`${m}-`)) delete window.plannerConfig[k]; });
        saveUserData(uid).then(() => refreshUI(uid));
    }
}

function refreshUI(uid) {
    import('./ui.js').then(mod => {
        mod.renderStructure(window.plannerConfig, isEditMode, (m, w) => buildWeek(m, w, uid));
        const first = Object.keys(window.plannerConfig).sort()[0];
        if (first) { const [m, w] = first.split('-'); buildWeek(m, w, uid); }
        mod.updateProgressBar();
    });
}

export function addOverviewBlock(uid) {
    const grid = document.getElementById('dynamic-ov-grid');
    const blockId = 'ov-' + Date.now();
    if(!window.pageContent.dynamicBlocks) window.pageContent.dynamicBlocks = [];
    window.pageContent.dynamicBlocks.push(blockId);
    const newBlock = document.createElement('div');
    newBlock.className = 'ov-card cg';
    newBlock.id = `container-${blockId}`;
    newBlock.innerHTML = `
        <button class="del-ov-btn" style="display:flex;">✕</button>
        <div class="ov-label editable-global" id="${blockId}-title" contenteditable="true">New Phase</div>
        <div class="ov-body editable-global" id="${blockId}-body" contenteditable="true">Edit...</div>
    `;
    newBlock.querySelector('.del-ov-btn').onclick = (e) => {
        e.stopPropagation();
        if(confirm("Delete this block?")) {
            newBlock.remove();
            window.pageContent.dynamicBlocks = window.pageContent.dynamicBlocks.filter(id => id !== blockId);
            delete window.pageContent[`${blockId}-title`];
            delete window.pageContent[`${blockId}-body`];
            saveUserData(uid);
        }
    };
    grid.appendChild(newBlock);
    newBlock.querySelectorAll('.editable-global').forEach(el => {
        el.contentEditable = isEditMode;
        el.onblur = () => { window.pageContent[el.id] = el.innerHTML; saveUserData(uid); };
    });
    saveUserData(uid);
}

export function renderDynamicOverviewBlocks(uid, targetPrefix = "", customContent = null) {
    const gridId = targetPrefix ? `${targetPrefix}dynamic-ov-grid` : 'dynamic-ov-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const content = customContent || window.pageContent || {};

    const defaults = {
        'global-ov-ca-label': 'Month 1 — Foundation',
        'global-ov-ca-body': 'Past simple · Present perfect · Used to · A few/a little · Although/despite · Have/have got<br><br>Vocab: Home, Education, Appearance, Clothes, Character<br><br>📖 Charlotte\'s Web',
        'global-ov-cb-label': 'Month 2 — Building',
        'global-ov-cb-body': 'Modal verbs · Passives · Reported speech · Conditionals · Neither/So do I · Be able to · Be allowed to<br><br>Vocab: Make & Do, Holidays, Illness, Cooking, Weather, Furniture<br><br>📖 Eleanor & Grey',
        'global-ov-cg-label': 'Month 3 — Consolidation',
        'global-ov-cg-body': 'Relative clauses · Adjective connotations · Adverbs of manner · Perfect tenses · Question tags · Affixes · Participles<br><br>Vocab: Crime, Politics, Film/TV, Family, Animals, Hotels<br><br>📖 Romeo & Juliet / Moby Dick'
    };

    grid.innerHTML = `
        <div class="ov-card ca">
          <div class="ov-label" id="${targetPrefix}global-ov-ca-label"></div>
          <div class="ov-body" id="${targetPrefix}global-ov-ca-body"></div>
        </div>
        <div class="ov-card cb">
          <div class="ov-label" id="${targetPrefix}global-ov-cb-label"></div>
          <div class="ov-body" id="${targetPrefix}global-ov-cb-body"></div>
        </div>
        <div class="ov-card cg">
          <div class="ov-label" id="${targetPrefix}global-ov-cg-label"></div>
          <div class="ov-body" id="${targetPrefix}global-ov-cg-body"></div>
        </div>
    `;

    ['ca','cb','cg'].forEach(suffix => {
        const id = `global-ov-${suffix}`;
        const lbl = document.getElementById(`${targetPrefix}${id}-label`);
        const bdy = document.getElementById(`${targetPrefix}${id}-body`);
        if(lbl) lbl.innerHTML = content[`${id}-label`] || defaults[`${id}-label`];
        if(bdy) bdy.innerHTML = content[`${id}-body`] || defaults[`${id}-body`];
    });

    if (!targetPrefix) {
        grid.querySelectorAll('.ov-card').forEach((card, index) => {
            if (!card.querySelector('.del-ov-btn')) {
                const delBtn = document.createElement('button');
                delBtn.className = 'del-ov-btn';
                delBtn.innerHTML = '✕';
                delBtn.style.display = isEditMode ? 'flex' : 'none';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if(confirm("Hide this block?")) {
                        card.style.display = 'none';
                        window.pageContent[`hide-static-ov-${index}`] = true;
                        saveUserData(uid);
                    }
                };
                card.prepend(delBtn);
            }
            if(window.pageContent && window.pageContent[`hide-static-ov-${index}`]) card.style.display = 'none';
        });
    }

    if(content.dynamicBlocks) {
        content.dynamicBlocks.forEach(blockId => {
            const newBlock = document.createElement('div');
            newBlock.className = 'ov-card cg';
            newBlock.id = `${targetPrefix}container-${blockId}`;
            const displayDel = (isEditMode && !targetPrefix) ? 'flex' : 'none';
            newBlock.innerHTML = `
                <button class="del-ov-btn" style="display:${displayDel};">✕</button>
                <div class="ov-label" id="${targetPrefix}${blockId}-title">${content[`${blockId}-title`] || 'New Phase'}</div>
                <div class="ov-body" id="${targetPrefix}${blockId}-body">${content[`${blockId}-body`] || 'Edit...'}</div>
            `;
            grid.appendChild(newBlock);
        });
    }
}
