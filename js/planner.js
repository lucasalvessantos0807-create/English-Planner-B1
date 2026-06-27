import { updateState, saveUserData, state, plannerConfig } from './storage.js';
import { renderStructure, updateProgressBar } from './ui.js';

let isEditMode = false;
const builtWeeks = new Set();

export function toggleEditMode(uid) {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    
    // Ajuste visual do botão
    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    btn.style.background = isEditMode ? "var(--green-light)" : "none";
    btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    
    if (!isEditMode) {
        saveUserData(uid);
    }
    
    // 1. Limpa o cache para permitir que a semana seja reconstruída
    builtWeeks.clear();

    // 2. Localiza com precisão o MÊS e a SEMANA que você está vendo agora
    const activeMonthBtn = document.querySelector('.mbtn.on');
    const activeWeekBtn = document.querySelector('.mpanel.on .wbtn.on');

    if (activeMonthBtn && activeWeekBtn) {
        const m = activeMonthBtn.dataset.month;
        const w = activeWeekBtn.dataset.week || activeWeekBtn.textContent.split(' ')[1]; 
        
        // 3. Força o redesenho instantâneo da semana atual
        buildWeek(m, w, uid);
    }
}

export function buildWeek(m, w, uid) {
    const key = `${m}-${w}`;
    // Remove do cache para forçar a atualização imediata da tela
    builtWeeks.delete(key);
    // Se estiver em modo edição, ignora o cache para garantir resposta imediata
    if (isEditMode) builtWeeks.delete(key);
    
    const wk = window.plannerConfig[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;

    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p contenteditable="${isEditMode}" data-type="theme" data-week="${key}">${wk.theme}</p></div>`;

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = state[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''} ${day.name === 'Sunday' ? 'sunday' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''} ${day.name === 'Sunday' ? 'sunday' : ''}">${day.n}</div>
                <div class="dayname">${day.name === 'Sunday' ? '⭐ Review Day' : day.name}</div>
                <div class="daytag" contenteditable="${isEditMode}" data-type="tag" data-week="${key}" data-dayidx="${dIdx}">${day.tag}</div>
            </div>
            <div class="daybody" id="db${day.n}">
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

        // Salvar edições de texto e tempo
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

        // Botão de Adicionar Atividade
        const addBtn = card.querySelector('.add-act-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                const wkKey = addBtn.dataset.week;
                const dI = addBtn.dataset.dayidx;
                window.plannerConfig[wkKey].days[dI].activities.push({
                    t: "grammar", i: "📝", title: "New Activity", desc: "Description here", time: "20 min"
                });
                // Atualiza a tela imediatamente
                buildWeek(m, w, uid);
                // Salva no banco de dados em segundo plano
                saveUserData(uid);
            };
        }

        // Botão de Deletar Atividade
        card.querySelectorAll('.del-act').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Delete this activity?")) {
                    const { week, dayidx, actidx } = btn.dataset;
                    window.plannerConfig[week].days[dayidx].activities.splice(actidx, 1);
                    // Atualiza a tela imediatamente
                    buildWeek(m, w, uid);
                    // Salva no banco de dados em segundo plano
                    saveUserData(uid);
                }
            };
        });

        // Parte C: Seletor de Emojis ao clicar no ícone
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
                    const btn = document.createElement('button');
                    btn.className = 'emoji-btn';
                    btn.textContent = emoji;
                    btn.onclick = () => {
                        const path = iconEl.dataset.path;
                        if (path) {
                            const [wkK, dI, aI, field] = path.split('.');
                            window.plannerConfig[wkK].days[dI].activities[aI].i = emoji;
                            iconEl.textContent = emoji;
                            saveUserData(uid);
                        }
                        picker.remove();
                    };
                    picker.appendChild(btn);
                });
                iconEl.parentElement.appendChild(picker);
            };
        });

        card.querySelector('.dayhead').onclick = (e) => {
            if (e.target.hasAttribute('contenteditable')) return;
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
    const dayCount = parseInt(prompt("How many days should this month have? (Ex: 30 or 31)", "30"));
    if (isNaN(dayCount) || dayCount <= 0) return;

    const currentMonths = [...new Set(Object.keys(window.plannerConfig).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;
    
    // Pergunta se quer continuar a contagem dos dias ou resetar para 1
    const startDayInput = prompt("What is the number of the first day of this month?", 
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

  saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
        alert("Novo mês criado!");
    });
}
export function editMonthStructure(m, uid) {
    const newDayCount = parseInt(prompt("How many days should this month have total?", "30"));
    const newStartDay = parseInt(prompt("What should be the number of the first day of this month?", "1"));
    
    if (isNaN(newDayCount) || isNaN(newStartDay)) return;

    // Remove as semanas antigas deste mês do config
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

    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
        alert("Month " + m + " restructured!");
    });
}

export function deleteMonth(m, uid) {
    if(!confirm("Are you sure you want to delete Month " + m + "? This will remove all weeks from this month.")) return;
    Object.keys(window.plannerConfig).forEach(key => {
        if (key.startsWith(`${m}-`)) {
            delete window.plannerConfig[key];
        }
    });
   saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
        alert("Month " + m + " deleted.");
    });
}
