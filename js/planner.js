import { updateState, saveUserData, state, plannerConfig } from './storage.js';
import { renderStructure, updateProgressBar } from './ui.js';

let isEditMode = false;
const builtWeeks = new Set();
let activeWeekKey = null; 
const openDays = new Set(); 

// Mapa de moldes: Vincula o ícone ao Tipo (cor) e ao Título Padrão
const DATA_MAP = {
    "📚": { type: "vocab", title: "Vocabulary" },
    "📖": { type: "reading", title: "Reading" },
    "🎙️": { type: "shadowing", title: "Shadowing" },
    "🎧": { type: "listening", title: "Listening + Dictation" },
    "📐": { type: "grammar", title: "Grammar" },
    "✍️": { type: "writing", title: "Writing" },
    "🗣️": { type: "speaking", title: "Speaking" },
    "🔁": { type: "review", title: "Review" }
};

export function toggleEditMode(uid) {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    
    builtWeeks.clear();

    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    btn.style.background = isEditMode ? "var(--green-light)" : "none";
    btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    
    if (!isEditMode) saveUserData(uid);
    
    if (activeWeekKey) {
        const [m, w] = activeWeekKey.split('-');
        buildWeek(m, w, uid);
    }
}

export function buildWeek(m, w, uid) {
    const key = `${m}-${w}`;
    activeWeekKey = key; 

    if (!isEditMode && builtWeeks.has(key)) return;
    
    const wk = window.plannerConfig[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;

    container.innerHTML = ""; 
    
    const wkBar = document.createElement("div");
    wkBar.className = `wkbar ${wk.review ? 'rv' : ''}`;
    wkBar.innerHTML = `<h3>${wk.label}</h3><p contenteditable="${isEditMode}" data-type="theme" data-week="${key}">${wk.theme}</p>`;
    container.appendChild(wkBar);

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = state[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        
        const isOpen = openDays.has(day.n) ? 'on' : '';

        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''} ${day.name === 'Sunday' ? 'sunday' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''} ${day.name === 'Sunday' ? 'sunday' : ''}">${day.n}</div>
                <div class="dayname">${day.name === 'Sunday' ? '⭐ Review Day' : day.name}</div>
                <div class="daytag" contenteditable="${isEditMode}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div>
            </div>
            <div class="daybody ${isOpen}" id="db${day.n}">
                <div class="activities-container">
                    ${day.activities.map((act, aIdx) => `
                        <div class="act">
                            <div class="aico ${act.t}" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.i">${act.i}</div>
                            <div class="acont">
                                <div class="atitle" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.title">${act.title}</div>
                                <div class="adesc" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.desc">${act.desc}</div>
                            </div>
                            <div class="atime" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.time">${act.time}</div>
                            ${isEditMode ? `<div class="del-act" data-week="${key}" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                ${isEditMode ? `<button class="add-act-btn" data-week="${key}" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}
                <textarea class="ntxt" id="nt${day.n}" placeholder="Notes...">${dayData.notes || ""}</textarea>
                <label class="chk ${dayData.done ? 'done' : ''}">
                    <input type="checkbox" ${dayData.done ? 'checked' : ''}>
                    <span>Day ${day.n} completed</span>
                </label>
            </div>
        `;

        // --- LISTENERS ---

        // Edição manual de textos
        card.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onblur = (e) => {
                const path = e.target.dataset.path;
                const type = e.target.dataset.type;
                if (path) {
                    const [wkK, dI, aI, field] = path.split('.');
                    window.plannerConfig[wkK].days[dI].activities[aI][field] = e.target.innerText;
                } else if (type === 'tag') {
                    window.plannerConfig[e.target.dataset.week].days[e.target.dataset.dayidx].tag = e.target.innerText;
                } else if (type === 'theme') {
                    window.plannerConfig[e.target.dataset.week].theme = e.target.innerText;
                }
                saveUserData(uid);
            };
        });

        // Botão Adicionar (Usa Grammar como padrão)
        const addBtn = card.querySelector('.add-act-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                const wkKey = addBtn.dataset.week;
                const dI = addBtn.dataset.dayidx;
                const mold = DATA_MAP["📐"]; 
                window.plannerConfig[wkKey].days[dI].activities.push({
                    t: mold.type, i: "📐", title: mold.title, desc: "Edit description", time: "20 min"
                });
                builtWeeks.delete(wkKey);
                buildWeek(m, w, uid);
                saveUserData(uid);
            };
        }

        // Botão Deletar
        card.querySelectorAll('.del-act').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm("Delete this activity?")) {
                    const { week, dayidx, actidx } = btn.dataset;
                    window.plannerConfig[week].days[dayidx].activities.splice(actidx, 1);
                    builtWeeks.delete(week);
                    buildWeek(m, w, uid);
                    saveUserData(uid);
                }
            };
        });

        // Seletor de Emoji com Preenchimento Automático
        card.querySelectorAll('.aico').forEach(iconEl => {
            if (!isEditMode) return;
            iconEl.onclick = (e) => {
                e.stopPropagation();
                const oldPicker = document.querySelector('.emoji-picker');
                if (oldPicker) oldPicker.remove();
                const picker = document.createElement('div');
                picker.className = 'emoji-picker';
                const emojis = ['📚','📖','🎙️','🎧','📐','✍️','🗣️','🔁','✅','📝','🎬','📻','💡','🔥','🌟'];
                
                emojis.forEach(emoji => {
                    const b = document.createElement('button');
                    b.className = 'emoji-btn';
                    b.textContent = emoji;
                    b.onclick = () => {
                        const path = iconEl.dataset.path;
                        if (path) {
                            const [wkK, dI, aI] = path.split('.');
                            const act = window.plannerConfig[wkK].days[dI].activities[aI];
                            
                            act.i = emoji;
                            iconEl.textContent = emoji;

                            if (DATA_MAP[emoji]) {
                                const mold = DATA_MAP[emoji];
                                act.t = mold.type;
                                iconEl.className = `aico ${mold.type}`;
                                act.title = mold.title; 
                                const titleEl = iconEl.parentElement.querySelector('.atitle');
                                if (titleEl) titleEl.innerText = mold.title;
                            }
                            saveUserData(uid);
                        }
                        picker.remove();
                    };
                    picker.appendChild(b);
                });
                iconEl.parentElement.appendChild(picker);
            };
        });

        // Toggle Dia (Persistente)
        card.querySelector('.dayhead').onclick = (e) => {
            if (e.target.hasAttribute('contenteditable')) return;
            const body = card.querySelector('.daybody');
            body.classList.toggle('on');
            if (body.classList.contains('on')) openDays.add(day.n);
            else openDays.delete(day.n);
        };

        // Notas e Checkbox
        const textarea = card.querySelector('textarea');
        textarea.oninput = (e) => { updateState(dayKey, { notes: e.target.value }); saveUserData(uid); };
        const chk = card.querySelector('input[type="checkbox"]');
        chk.onchange = (e) => {
            const isDone = e.target.checked;
            // Atualiza o estado no objeto global
            updateState(dayKey, { done: isDone });
            
            // Feedback visual na lista
            card.querySelector('.chk').classList.toggle('done', isDone);
            
            // Salva e força a atualização da barra de progresso
            saveUserData(uid);
            updateProgressBar();
        };

        container.appendChild(card);
    });

    if (!isEditMode) builtWeeks.add(key);
}

// --- GESTÃO DE MESES ---

export function addNewMonth(uid) {
    const dayCount = parseInt(prompt("How many days should this month have?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    const startDayInput = prompt("Number of the first day?", (Object.values(window.plannerConfig).reduce((acc, curr) => {
        const last = curr.days[curr.days.length - 1].n;
        return last > acc ? last : acc;
    }, 0) + 1));
    let currentDayCounter = parseInt(startDayInput);
    const totalWeeksInMonth = Math.ceil(dayCount / 7);
    const totalWeeksSoFar = Object.keys(window.plannerConfig).length;
    for (let w = 1; w <= totalWeeksInMonth; w++) {
        const key = `${nextMonth}-${w}`;
        const daysInThisWeek = Math.min(7, dayCount - ((w - 1) * 7));
        window.plannerConfig[key] = {
            label: `Week ${totalWeeksSoFar + w}`,
            theme: "New Month - Edit theme",
            days: Array.from({length: daysInThisWeek}, (_, i) => {
                const dayNum = currentDayCounter++;
                return {
                    n: dayNum,
                    name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(dayNum - 1) % 7],
                    tag: "Activity",
                    activities: [{t:"grammar", i:"📐", title:"Grammar", desc:"Edit description", time: "20 min"}]
                };
            })
        };
    }
    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
    });
}

export function editMonthStructure(m, uid) {
    const newDayCount = parseInt(prompt("Total days for this month?", "30"));
    const newStartDay = parseInt(prompt("First day number?", "1"));
    if (isNaN(newDayCount) || isNaN(newStartDay)) return;
    Object.keys(window.plannerConfig).forEach(key => { if (key.startsWith(`${m}-`)) delete window.plannerConfig[key]; });
    let currentDayCounter = newStartDay;
    const totalWeeksInMonth = Math.ceil(newDayCount / 7);
    for (let w = 1; w <= totalWeeksInMonth; w++) {
        const key = `${m}-${w}`;
        const daysInThisWeek = Math.min(7, newDayCount - ((w - 1) * 7));
        window.plannerConfig[key] = {
           label: `Week ${w}`,
            theme: "Adjusted Month",
            days: Array.from({length: daysInThisWeek}, (_, i) => {
                const dayNum = currentDayCounter++;
                return {
                    n: dayNum,
                    name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(dayNum - 1) % 7],
                    tag: "Activity",
                    activities: [{t:"grammar", i:"📐", title:"Grammar", desc:"Edit description", time: "20 min"}]
                };
            })
        };
    }
    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
    });
}

export function deleteMonth(m, uid) {
    if(!confirm("Are you sure you want to delete Month " + m + "?")) return;
    Object.keys(window.plannerConfig).forEach(key => { if (key.startsWith(`${m}-`)) delete window.plannerConfig[key]; });
    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
    });
}
