import { updateState, saveUserData, state, plannerConfig, addHistoryEntry } from './storage.js';
import { updateProgressBar } from './ui.js';

let isEditMode = false;
let undoStack = []; 
let sessionInitialConfig = null; // Backup para cancelamento
let sessionInitialContent = null; // Backup para cancelamento

const builtWeeks = new Set();
const EMOJI_LIST = ['📚','📖','🎙️','📐','✍️','🎧','🗣️','🔁','⭐','✅','📝','📍'];
const ICON_MAP = { '📚': 'Vocabulary', '📖': 'Reading', '🎙️': 'Shadowing', '🎧': 'Listening', '📐': 'Grammar', '✍️': 'Writing', '🗣️': 'Speaking', '🔁': 'Review Day', '⭐': 'Review Day', '✅': 'Completed', '📝': 'Exercise', '📍': 'Extra Activity' };

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

// Restaura os textos globais na tela
function refreshGlobalTexts() {
    Object.keys(window.pageContent || {}).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = window.pageContent[id];
    });
}

// Cancela todas as edições da sessão atual
export function cancelEdit(uid) {
    if (!confirm("Discard all changes made in this session?")) return;
    window.plannerConfig = JSON.parse(JSON.stringify(sessionInitialConfig));
    window.pageContent = JSON.parse(JSON.stringify(sessionInitialContent));
    isEditMode = false;
    refreshGlobalTexts();
    updateUIEditMode();
    refreshCurrentWeek(uid);
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
        // INICIANDO EDIÇÃO: Tira "foto" do estado atual
        sessionInitialConfig = JSON.parse(JSON.stringify(window.plannerConfig));
        sessionInitialContent = JSON.parse(JSON.stringify(window.pageContent || {}));
        undoStack = [];
        isEditMode = true;
    } else {
        // SALVANDO: Verifica se algo mudou de verdade
        const currentConfigStr = JSON.stringify(window.plannerConfig);
        const initialConfigStr = JSON.stringify(sessionInitialConfig);
        const currentContentStr = JSON.stringify(window.pageContent);
        const initialContentStr = JSON.stringify(sessionInitialContent);

        if (currentConfigStr !== initialConfigStr || currentContentStr !== initialContentStr) {
            // Só cria histórico se houver mudança. O histórico guarda como estava ANTES.
            addHistoryEntry("Before Edit Session", sessionInitialConfig, sessionInitialContent);
            saveUserData(uid);
        }
        isEditMode = false;
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
}

function refreshCurrentWeek(uid) {
    builtWeeks.clear();
    const active = document.querySelector('.mpanel.on .wpanel.on');
    if (active) {
        const idParts = active.id.replace('wp', '').split('-');
        buildWeek(idParts[0], idParts[1], uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')));
    }
}

export function buildWeek(m, w, uid, openDays = []) {
    const key = `${m}-${w}`;
    const wk = window.plannerConfig[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;

    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p contenteditable="${isEditMode}" data-type="theme" data-week="${key}">${wk.theme}</p></div>`;

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = state[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        const isOpen = openDays.includes(day.n.toString());

        const activitiesHtml = day.activities.map((act, aIdx) => {
            let suggestionsHtml = isEditMode ? `<div class="icon-suggestions">${EMOJI_LIST.map(emoji => `<span class="suggest-emoji" data-emoji="${emoji}">${emoji}</span>`).join('')}</div>` : '';
            return `
                <div class="act">
                    <div class="aico-wrapper">
                        <div class="aico ${act.t}" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.i">${act.i}</div>
                        ${suggestionsHtml}
                    </div>
                    <div class="acont">
                        <div class="atitle" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.title">${act.title}</div>
                        <div class="adesc" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.desc">${act.desc}</div>
                    </div>
                    <div class="atime" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.time">${act.time}</div>
                    ${isEditMode ? `<div class="del-act" data-week="${key}" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}
                </div>`;
        }).join('');

        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div>
                <div class="dayname">${day.name}</div>
                <div class="daytag" contenteditable="${isEditMode}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div>
            </div>
            <div class="daybody ${isOpen ? 'on' : ''}" id="db${day.n}">
                <div class="activities-container">${activitiesHtml}</div>
                ${isEditMode ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}
                <textarea class="ntxt" id="nt${day.n}" placeholder="Notes...">${dayData.notes || ""}</textarea>
                <label class="chk ${dayData.done ? 'done' : ''}"><input type="checkbox" ${dayData.done ? 'checked' : ''}><span>Day ${day.n} completed</span></label>
            </div>`;

        if (isEditMode) {
            card.querySelectorAll('.aico').forEach(icon => {
                icon.onclick = () => {
                    const wrapper = icon.closest('.aico-wrapper');
                    document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions'));
                    wrapper.classList.add('show-suggestions');
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
            el.onfocus = () => { if(isEditMode) pushToUndo(); };
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
            buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')));
        };

        card.querySelectorAll('.del-act').forEach(btn => {
            btn.onclick = () => {
                if(confirm("Delete?")) {
                    pushToUndo();
                    window.plannerConfig[btn.dataset.week].days[btn.dataset.dayidx].activities.splice(btn.dataset.actidx, 1);
                    buildWeek(m, w, uid, Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', '')));
                }
            };
        });

        card.querySelector('.dayhead').onclick = (e) => {
            if (!e.target.hasAttribute('contenteditable') && !e.target.closest('.aico-wrapper')) {
                card.querySelector('.daybody').classList.toggle('on');
            }
        };

        const textarea = card.querySelector('textarea');
        textarea.oninput = (e) => { updateState(dayKey, { notes: e.target.value }); saveUserData(uid); };

        const chk = card.querySelector('input[type="checkbox"]');
        chk.onchange = (e) => {
            updateState(dayKey, { done: e.target.checked });
            card.querySelector('.chk').classList.toggle('done', e.target.checked);
            saveUserData(uid);
            updateProgressBar();
        };

        container.appendChild(card);
    });
    builtWeeks.add(key);
}

export function addNewMonth(uid) {
    // Salva estado antes da mudança estrutural
    addHistoryEntry("Before Adding Month", window.plannerConfig, window.pageContent);
    const dayCount = parseInt(prompt("How many days?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    const startDay = (Object.values(window.plannerConfig).reduce((acc, curr) => Math.max(acc, curr.days[curr.days.length-1].n), 0) + 1);
    let currentDay = startDay;
    for (let w = 1; w <= Math.ceil(dayCount / 7); w++) {
        const daysInW = Math.min(7, dayCount - ((w - 1) * 7));
        window.plannerConfig[`${nextMonth}-${w}`] = {
            label: `Week ${Object.keys(window.plannerConfig).length + 1}`, theme: "New Month",
            days: Array.from({length: daysInW}, () => {
                const d = currentDay++;
                return { n: d, name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(d - 1) % 7], tag: "Act", activities: [{t:"grammar", i:"📐", title:"Topic", desc:"Edit", time: "20m"}]};
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid));
}

export function editMonthStructure(m, uid) {
    addHistoryEntry(`Before Restructuring Month ${m}`, window.plannerConfig, window.pageContent);
    const dayCount = parseInt(prompt("Days?", "30")), startDay = parseInt(prompt("Start Day?", "1"));
    if (isNaN(dayCount)) return;
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
        mod.renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        const first = Object.keys(window.plannerConfig).sort()[0];
        if (first) { const [m, w] = first.split('-'); buildWeek(m, w, uid); }
        mod.updateProgressBar();
    });
}
