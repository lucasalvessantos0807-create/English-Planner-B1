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
}

function refreshGlobalTexts() {
    Object.keys(window.pageContent || {}).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = window.pageContent[id];
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
    
    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    btn.style.background = isEditMode ? "var(--green-light)" : "none";
    btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    cancelBtn.style.display = isEditMode ? "block" : "none";
    if (!isEditMode) undoBtn.style.display = "none";
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

    // Cabeçalho da Semana
    container.innerHTML = `
        <div class="wkbar ${wk.review ? 'rv' : ''}">
            <h3>${wk.label}</h3>
            <p contenteditable="${isEditMode && !isPreview}" data-type="theme" data-week="${key}">${wk.theme}</p>
        </div>`;

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const fullKey = `m${m}-${dayKey}`;
        const dayData = activeState[fullKey] || activeState[dayKey] || { done: false, notes: "" };
        
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

        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div>
                <div class="dayname">${day.name}</div>
                <div class="daytag" contenteditable="${isEditMode && !isPreview}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div>
            </div>
            <div class="daybody ${isOpen ? 'on' : ''}" id="${prefix}db${day.n}">
                <div class="activities-container">${activitiesHtml}</div>
                ${(isEditMode && !isPreview) ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}
                <textarea class="ntxt" id="${prefix}nt${day.n}" placeholder="Notes..." ${isPreview ? 'readonly' : ''}>${dayData.notes || ""}</textarea>
                <label class="chk ${dayData.done ? 'done' : ''}"><input type="checkbox" ${dayData.done ? 'checked' : ''} ${isPreview ? 'disabled' : ''}><span>Day ${day.n} completed</span></label>
            </div>`;

        // Eventos de Edição
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

            // Persistência de texto nas atividades
            card.querySelectorAll('[contenteditable]').forEach(el => {
                el.onblur = () => {
                    const path = el.dataset.path;
                    if (path) {
                        const [wkK, dI, aI, prop] = path.split('.');
                        window.plannerConfig[wkK].days[dI].activities[aI][prop] = el.innerText;
                    } else if (el.dataset.type === 'tag') {
                        window.plannerConfig[el.dataset.week].days[el.dataset.dayidx].tag = el.innerText;
                    } else if (el.dataset.type === 'theme') {
                        window.plannerConfig[el.dataset.week].theme = el.innerText;
                    }
                };
            });

            const addBtn = card.querySelector('.add-act-btn');
            if (addBtn) addBtn.onclick = () => {
                pushToUndo();
                window.plannerConfig[addBtn.dataset.week].days[addBtn.dataset.dayidx].activities.push({t: "grammar", i: "📝", title: "New Activity", desc: "Edit", time: "20m"});
                buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')), isPreview, prefix, config, activeState);
            };

            card.querySelectorAll('.del-act').forEach(btn => {
                btn.onclick = () => {
                    if(confirm("Delete this activity?")) {
                        pushToUndo();
                        window.plannerConfig[btn.dataset.week].days[btn.dataset.dayidx].activities.splice(btn.dataset.actidx, 1);
                        buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')), isPreview, prefix, config, activeState);
                    }
                };
            });
        }

        // Eventos Comuns (Expandir/Check)
        card.querySelector('.dayhead').onclick = (e) => {
            if (!e.target.hasAttribute('contenteditable') && !e.target.closest('.aico-wrapper')) {
                card.querySelector('.daybody').classList.toggle('on');
            }
        };

        if (!isPreview) {
            const textarea = card.querySelector('textarea');
            textarea.oninput = (e) => { updateState(m, dayKey, { notes: e.target.value }); saveUserData(uid); };
            const chk = card.querySelector('input[type="checkbox"]');
            chk.onchange = (e) => {
                updateState(m, dayKey, { done: e.target.checked });
                card.querySelector('.chk').classList.toggle('done', e.target.checked);
                saveUserData(uid);
                updateProgressBar();
            };
        }

        container.appendChild(card);
    });
}

// --- GESTÃO DE MESES ---
export function addNewMonth(uid) {
    const dayCount = parseInt(prompt("How many days for this new month?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    
    addHistoryEntry("Before Adding Month", window.plannerConfig, window.pageContent);
    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    
    let currentDay = 1;
    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        window.plannerConfig[`${nextMonth}-${w}`] = {
            label: `Week ${w}`, theme: "New Month Plans",
            days: Array.from({length: daysInW}, () => {
                const d = currentDay++;
                return { 
                    n: d, 
                    name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(d - 1) % 7], 
                    tag: "Daily Act", 
                    activities: [{t:"grammar", i:"📐", title:"Study Topic", desc:"Click to edit your activity", time: "20m"}]
                };
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid, nextMonth));
}

export function editMonthStructure(m, uid) {
    let dayCountInput = prompt(`How many days should Month ${m} have?`, "30");
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
        let hasCustomContent = false;
        let affectedDays = [];

        for (let i = dayCount; i < existingDays.length; i++) {
            const dayObj = existingDays[i];
            const stateKey = `m${m}-d${dayObj.n}`;
            const oldKey = `d${dayObj.n}`; 
            const dayState = window.appState[stateKey] || window.appState[oldKey];
            
            let hasProgress = dayState && (dayState.done === true || (dayState.notes && dayState.notes.trim() !== ""));
            let isTagEdited = dayObj.tag !== "Daily Act";
            let areActivitiesEdited = dayObj.activities.some(act => 
                (act.title !== "Study Topic" && act.title !== "New Activity") || 
                (act.desc !== "Edit" && act.desc !== "Click to edit your activity")
            );

            if (hasProgress || isTagEdited || areActivitiesEdited) {
                hasCustomContent = true;
                affectedDays.push(dayObj.n);
            }
        }

        if (hasCustomContent) {
            const warningMessage = `ATTENTION: You are reducing the month to ${dayCount} days, but there is custom content or progress saved on the following days: ${affectedDays.join(', ')}.\n\nIf you proceed, all notes, progress markers, and edited activities for these days will be PERMANENTLY DELETED.\n\nDo you want to continue?`;
            const confirmDeletion = confirm(warningMessage);
            if (!confirmDeletion) return;
        }

        // LIMPAR DADOS FANTASMAS (Remove do state os dias que deixaram de existir)
        for (let i = dayCount; i < existingDays.length; i++) {
            delete window.appState[`m${m}-d${existingDays[i].n}`];
            delete window.appState[`d${existingDays[i].n}`];
        }
    }

    addHistoryEntry(`Before Restructuring Month ${m}`, window.plannerConfig, window.pageContent);

    weeksOfM.forEach(wk => delete window.plannerConfig[wk]);

    let currentDayIdx = 0;
    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        const weekDays = [];
        
        for (let d = 0; d < daysInW; d++) {
            const newDayNum = currentDayIdx + 1;
            
            if (existingDays[currentDayIdx]) {
                const preserved = existingDays[currentDayIdx];
                preserved.n = newDayNum;
                weekDays.push(preserved);
            } else {
                // Ao criar dias novos por aumento de mês, garantimos que não puxe lixo de estados antigos
                delete window.appState[`m${m}-d${newDayNum}`];
                weekDays.push({ 
                    n: newDayNum, 
                    name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(newDayNum - 1) % 7], 
                    tag: "Daily Act", 
                    activities: [{t:"grammar", i:"📐", title:"Study Topic", desc:"Edit", time: "20m"}]
                });
            }
            currentDayIdx++;
        }

        window.plannerConfig[`${m}-${w}`] = {
            label: `Week ${w}`, 
            theme: "Plans Updated",
            days: weekDays
        };
    }

    saveUserData(uid).then(() => {
        // Forçar renderização completa
        import('./ui.js').then(mod => {
            mod.renderStructure(window.plannerConfig, isEditMode, (m, w) => buildWeek(m, w, uid));
            setTimeout(() => {
                const monthButtons = document.querySelectorAll('#monthNav .mbtn');
                const targetBtn = Array.from(monthButtons).find(b => b.textContent.trim() === `Month ${m}`);
                if (targetBtn) targetBtn.click();
                mod.updateProgressBar();
            }, 100);
        });
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
    saveUserData(uid);
}

export function renderDynamicOverviewBlocks(uid, prefix = "", customContent = null) {
    const gridId = prefix + 'dynamic-ov-grid';
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
          <div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}global-ov-ca-label"></div>
          <div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}global-ov-ca-body"></div>
        </div>
        <div class="ov-card cb">
          <div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}global-ov-cb-label"></div>
          <div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}global-ov-cb-body"></div>
        </div>
        <div class="ov-card cg">
          <div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}global-ov-cg-label"></div>
          <div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}global-ov-cg-body"></div>
        </div>
    `;

    ["ca", "cb", "cg"].forEach(id => {
        const labelEl = document.getElementById(`${prefix}global-ov-${id}-label`);
        const bodyEl = document.getElementById(`${prefix}global-ov-${id}-body`);
        const key = `global-ov-${id}`;
        if(labelEl) labelEl.innerHTML = content[key + '-label'] || defaults[key + '-label'];
        if(bodyEl) bodyEl.innerHTML = content[key + '-body'] || defaults[key + '-body'];
    });

    if(content.dynamicBlocks) {
        content.dynamicBlocks.forEach(blockId => {
            const newBlock = document.createElement('div');
            newBlock.className = 'ov-card cg';
            newBlock.id = `${prefix}container-${blockId}`;
            newBlock.innerHTML = `
                ${prefix ? '' : '<button class="del-ov-btn" data-id="' + blockId + '">✕</button>'}
                <div class="ov-label ${prefix ? '' : 'editable-global'}" id="${prefix}${blockId}-title">${content[blockId + '-title'] || 'New Phase'}</div>
                <div class="ov-body ${prefix ? '' : 'editable-global'}" id="${prefix}${blockId}-body">${content[blockId + '-body'] || 'Edit...'}</div>
            `;
            grid.appendChild(newBlock);
        });

        // RE-ANEXAR LISTENERS DE DELETAR (Crucial para o funcionamento do X)
        if (!prefix) {
            grid.querySelectorAll('.del-ov-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const bId = btn.dataset.id;
                    if(confirm("Delete this block?")) {
                        document.getElementById(`container-${bId}`).remove();
                        window.pageContent.dynamicBlocks = window.pageContent.dynamicBlocks.filter(id => id !== bId);
                        delete window.pageContent[`${bId}-title`];
                        delete window.pageContent[`${bId}-body`];
                        saveUserData(uid);
                    }
                };
            });
        }
    }
}
