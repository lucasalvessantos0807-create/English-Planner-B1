import { updateState, saveUserData, state, plannerConfig } from './storage.js';
import { updateProgressBar } from './ui.js';

let isEditMode = false;
const builtWeeks = new Set();
const EMOJI_LIST = ['📚','📖','🎙️','📐','✍️','🎧','🗣️','🔁','⭐','✅','📝','📍'];

export function toggleEditMode(uid) {
    const openDays = Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', ''));
    
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    btn.style.background = isEditMode ? "var(--green-light)" : "none";
    btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    
    if (!isEditMode) {
        saveUserData(uid);
    }
    
    builtWeeks.clear();
    const activeWeekPanel = document.querySelector('.mpanel.on .wpanel.on');
    if (activeWeekPanel) {
        const idParts = activeWeekPanel.id.replace('wp', '').split('-');
        buildWeek(idParts[0], idParts[1], uid, openDays);
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

        // Pré-calcula o HTML das atividades para evitar erro de sintaxe por aninhamento excessivo
        const activitiesHtml = day.activities.map((act, aIdx) => {
            let suggestionsHtml = '';
            if (isEditMode) {
                const emojis = EMOJI_LIST.map(emoji => `<span class="suggest-emoji" data-emoji="${emoji}">${emoji}</span>`).join('');
                suggestionsHtml = `<div class="icon-suggestions">${emojis}</div>`;
            }

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
                <label class="chk ${dayData.done ? 'done' : ''}">
                    <input type="checkbox" ${dayData.done ? 'checked' : ''}>
                    <span>Day ${day.n} completed</span>
                </label>
            </div>
        `;

        // Eventos: Ícones
        if (isEditMode) {
            card.querySelectorAll('.aico').forEach(icon => {
                icon.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const wrapper = icon.closest('.aico-wrapper');
                    const wasOpen = wrapper.classList.contains('show-suggestions');
                    document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions'));
                    if (!wasOpen) wrapper.classList.add('show-suggestions');
                };
            });
            card.querySelectorAll('.suggest-emoji').forEach(sug => {
                sug.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const emoji = e.target.dataset.emoji;
                    const wrapper = e.target.closest('.aico-wrapper');
                    const aico = wrapper.querySelector('.aico');
                    aico.innerText = emoji;
                    wrapper.classList.remove('show-suggestions');
                    aico.focus(); aico.blur();
                };
            });
        }

        // Eventos: Salvamento
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

        // Eventos: Botões de ação
        const addBtn = card.querySelector('.add-act-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                const open = Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', ''));
                window.plannerConfig[addBtn.dataset.week].days[addBtn.dataset.dayidx].activities.push({
                    t: "grammar", i: "📝", title: "New Activity", desc: "Description here", time: "20 min"
                });
                saveUserData(uid).then(() => buildWeek(m, w, uid, open));
            };
        }

        card.querySelectorAll('.del-act').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Delete this activity?")) {
                    const open = Array.from(document.querySelectorAll('.daybody.on')).map(d => d.id.replace('db', ''));
                    window.plannerConfig[btn.dataset.week].days[btn.dataset.dayidx].activities.splice(btn.dataset.actidx, 1);
                    saveUserData(uid).then(() => buildWeek(m, w, uid, open));
                }
            };
        });

        card.querySelector('.dayhead').onclick = (e) => {
            if (e.target.hasAttribute('contenteditable') || e.target.closest('.aico-wrapper')) return;
            card.querySelector('.daybody').classList.toggle('on');
        };

        const textarea = card.querySelector('textarea');
        textarea.oninput = (e) => {
            updateState(dayKey, { notes: e.target.value });
            saveUserData(uid);
        };

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
    const dayCount = parseInt(prompt("How many days should this month have?", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;
    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    const startDayInput = prompt("First day number?", 
        (Object.values(window.plannerConfig).reduce((acc, curr) => {
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
                    activities: [{t:"grammar", i:"📐", title:"New Topic", desc:"Edit me", time: "20 min"}]
                };
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid));
}

export function editMonthStructure(m, uid) {
    const newDayCount = parseInt(prompt("How many days total?", "30"));
    const newStartDay = parseInt(prompt("First day number?", "1"));
    if (isNaN(newDayCount) || isNaN(newStartDay)) return;
    Object.keys(window.plannerConfig).forEach(key => {
        if (key.startsWith(`${m}-`)) delete window.plannerConfig[key];
    });
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
                    activities: [{t:"grammar", i:"📐", title:"New Topic", desc:"Edit me", time: "20 min"}]
                };
            })
        };
    }
    saveUserData(uid).then(() => refreshUI(uid));
}

export function deleteMonth(m, uid) {
    if (!confirm(`Are you sure you want to delete Month ${m} and all its weeks?`)) return;
    Object.keys(window.plannerConfig).forEach(key => {
        if (key.startsWith(`${m}-`)) delete window.plannerConfig[key];
    });
    saveUserData(uid).then(() => refreshUI(uid));
}

function refreshUI(uid) {
    import('./ui.js').then(modUI => {
        modUI.renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        const firstKey = Object.keys(window.plannerConfig).sort()[0];
        if (firstKey) {
            const [m, w] = firstKey.split('-');
            buildWeek(m, w, uid);
        }
        modUI.updateProgressBar();
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.aico-wrapper')) {
        document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions'));
    }
});
