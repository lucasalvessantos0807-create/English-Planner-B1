import { updateState, saveUserData, state, plannerConfig } from './storage.js';
import { renderStructure, updateProgressBar } from './ui.js';

let isEditMode = false;
const builtWeeks = new Set();

/**
 * Ativa ou Desativa o Modo de Edição Geral
 */
export function toggleEditMode(uid) {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    
    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    btn.style.background = isEditMode ? "var(--green-light)" : "none";
    btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    
    if (!isEditMode) {
        saveUserData(uid);
    }

    // --- EDIÇÃO DO OVERVIEW (3 CARDS) ---
    const overviewFields = ['ov-t1', 'ov-b1', 'ov-t2', 'ov-b2', 'ov-t3', 'ov-b3'];
    overviewFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.contentEditable = isEditMode;
            el.style.border = isEditMode ? "1px dashed var(--accent)" : "none";
            
            // Evento para salvar ao editar
            el.onblur = () => {
                if (!window.plannerConfig.overview) window.plannerConfig.overview = { m1:{}, m2:{}, m3:{} };
                const mNum = id.at(-1); // Pega o número do mês do ID
                if (id.includes('-t')) {
                    window.plannerConfig.overview[`m${mNum}`].title = el.innerText;
                } else {
                    window.plannerConfig.overview[`m${mNum}`].body = el.innerText;
                }
                saveUserData(uid);
            };
        }
    });

    // --- EDIÇÃO DO DAILY TEMPLATE ---
    const templateRows = document.querySelectorAll('[id^="tpl-"]');
    templateRows.forEach(el => {
        el.contentEditable = isEditMode;
        el.style.backgroundColor = isEditMode ? "var(--accent-light)" : "transparent";
        
        el.onblur = () => {
            if (!window.plannerConfig.dailyTemplate) window.plannerConfig.dailyTemplate = [];
            const idx = el.id.replace(/[^\d]/g, ''); // Extrai apenas o número do ID
            if (!window.plannerConfig.dailyTemplate[idx]) window.plannerConfig.dailyTemplate[idx] = {};
            
            if (el.id.includes('-t')) {
                window.plannerConfig.dailyTemplate[idx].time = el.innerText;
            } else {
                window.plannerConfig.dailyTemplate[idx].act = el.innerText;
            }
            saveUserData(uid);
        };
    });

    // --- REDESENHO DA SEMANA ATUAL ---
    const activePanel = document.querySelector('.wpanel.on');
    if (activePanel) {
        const idParts = activePanel.id.replace('wp', '').split('-');
        const m = idParts[0];
        const w = idParts[1];
        // Força a remoção do cache para reconstruir com inputs de edição
        builtWeeks.delete(`${m}-${w}`);
        buildWeek(m, w, uid);
    }
}

/**
 * Constrói a visualização dos dias de uma semana específica
 */
export function buildWeek(m, w, uid) {
    const key = `${m}-${w}`;
    // No modo edição, sempre limpamos o cache para garantir reatividade
    if (isEditMode) builtWeeks.delete(key);
    
    if (builtWeeks.has(key)) return;

    const wk = window.plannerConfig[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;

    // Cabeçalho da Semana
    container.innerHTML = `
        <div class="wkbar ${wk.review ? 'rv' : ''}">
            <h3>${wk.label}</h3>
            <p contenteditable="${isEditMode}" data-type="theme" data-week="${key}">${wk.theme}</p>
        </div>
    `;

    // Renderiza cada dia
    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = state[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        
        card.innerHTML = `
            <div class="dayhead ${day.name === 'Sunday' ? 'sunday' : ''}">
                <div class="daynum ${day.name === 'Sunday' ? 'sunday' : ''}">${day.n}</div>
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
                            ${isEditMode ? `<div class="del-act" data-dayidx="${dIdx}" data-actidx="${aIdx}">✕</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                ${isEditMode ? `<button class="add-act-btn" data-dayidx="${dIdx}">+ Add Activity</button>` : ''}
                <textarea class="ntxt" id="nt${day.n}" placeholder="Notes...">${dayData.notes || ""}</textarea>
                <label class="chk ${dayData.done ? 'done' : ''}">
                    <input type="checkbox" ${dayData.done ? 'checked' : ''}>
                    <span>Day ${day.n} completed</span>
                </label>
            </div>
        `;

        // Eventos de Edição dos Textos
        card.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onblur = (e) => {
                const path = e.target.dataset.path;
                const type = e.target.dataset.type;
                if (path) {
                    const [wkK, dI, aI, field] = path.split('.');
                    window.plannerConfig[wkK].days[dI].activities[aI][field] = e.target.innerText;
                } else if (type === 'tag') {
                    window.plannerConfig[key].days[dIdx].tag = e.target.innerText;
                } else if (type === 'theme') {
                    window.plannerConfig[key].theme = e.target.innerText;
                }
                saveUserData(uid);
            };
        });

        // Botão Adicionar Atividade
        const addBtn = card.querySelector('.add-act-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                window.plannerConfig[key].days[dIdx].activities.push({t: "grammar", i: "📝", title: "Nova Atividade", desc: "Descrição", time: "20 min"});
                buildWeek(m, w, uid);
                saveUserData(uid);
            };
        }

        // Botão Deletar Atividade
        card.querySelectorAll('.del-act').forEach(btn => {
            btn.onclick = () => {
                const { actidx } = btn.dataset;
                window.plannerConfig[key].days[dIdx].activities.splice(actidx, 1);
                buildWeek(m, w, uid);
                saveUserData(uid);
            };
        });

        // Seletor de Emoji
        card.querySelectorAll('.aico').forEach(iconEl => {
            if (!isEditMode) return;
            iconEl.onclick = (e) => {
                e.stopPropagation();
                const old = document.querySelector('.emoji-picker');
                if (old) old.remove();
                const picker = document.createElement('div');
                picker.className = 'emoji-picker';
                const emojis = ['📚','📖','🎙️','🎧','📐','✍️','🗣️','🔁','✅','📝','🎬','📻','💡','🔥','🌟'];
                emojis.forEach(emoji => {
                    const eb = document.createElement('button');
                    eb.className = 'emoji-btn';
                    eb.textContent = emoji;
                    eb.onclick = () => {
                        const path = iconEl.dataset.path;
                        const [wkK, dI, aI, field] = path.split('.');
                        window.plannerConfig[wkK].days[dI].activities[aI].i = emoji;
                        iconEl.textContent = emoji;
                        saveUserData(uid);
                        picker.remove();
                    };
                    picker.appendChild(eb);
                });
                iconEl.parentElement.appendChild(picker);
            };
        });

        // Toggle do Card
        card.querySelector('.dayhead').onclick = (e) => {
            if (e.target.hasAttribute('contenteditable') || e.target.classList.contains('aico')) return;
            card.querySelector('.daybody').classList.toggle('on');
        };

        // Notas (Textarea)
        const textarea = card.querySelector('textarea');
        textarea.oninput = (e) => {
            updateState(dayKey, { notes: e.target.value });
            saveUserData(uid);
        };

        // Checkbox de conclusão
        const chk = card.querySelector('input[type="checkbox"]');
        chk.onchange = (e) => {
            updateState(dayKey, { done: e.target.checked });
            card.querySelector('.chk').classList.toggle('done', e.target.checked);
            saveUserData(uid);
            updateProgressBar();
        };

        container.appendChild(card);
    });
    
    if (!isEditMode) builtWeeks.add(key);
}

/**
 * Cria um novo mês completo (4 ou 5 semanas)
 */
export function addNewMonth(uid) {
    const dayCount = parseInt(prompt("Quantos dias tem este mês?", "30"));
    if (isNaN(dayCount)) return;

    const currentMonths = [...new Set(Object.keys(window.plannerConfig).filter(k => k.includes('-')).map(k => k.split('-')[0]))];
    const nextMonth = currentMonths.length > 0 ? Math.max(...currentMonths.map(Number)) + 1 : 1;

    // Encontra o último dia numerado para continuar a sequência
    const lastDay = Object.values(window.plannerConfig)
        .filter(v => v.days)
        .reduce((acc, curr) => {
            const lastInWk = curr.days[curr.days.length - 1].n;
            return lastInWk > acc ? lastInWk : acc;
        }, 0);

    let dayCounter = lastDay + 1;
    const totalWeeksInMonth = Math.ceil(dayCount / 7);
    const totalWeeksOverall = Object.keys(window.plannerConfig).filter(k => k.includes('-')).length;

    for (let w = 1; w <= totalWeeksInMonth; w++) {
        const key = `${nextMonth}-${w}`;
        const daysInThisWeek = Math.min(7, dayCount - ((w - 1) * 7));
        
        window.plannerConfig[key] = {
            label: `Week ${totalWeeksOverall + w}`,
            theme: "Novo Mês - Clique em Edit Mode para mudar o tema",
            days: Array.from({length: daysInThisWeek}, (_, i) => ({
                n: dayCounter++,
                name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(dayCounter - 2) % 7],
                tag: "Activity",
                activities: [{t:"grammar", i:"📐", title:"Tópico", desc:"Descrição", time: "20 min"}]
            }))
        };
    }

    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
    });
}

/**
 * Altera a estrutura de dias/semanas de um mês existente
 */
export function editMonthStructure(m, uid) {
    const newCount = parseInt(prompt(`Total de dias para o Mês ${m}?`, "30"));
    const startDay = parseInt(prompt(`Qual o número do primeiro dia do Mês ${m}?`, "1"));
    if (isNaN(newCount) || isNaN(startDay)) return;

    // Deleta semanas antigas
    Object.keys(window.plannerConfig).forEach(k => {
        if (k.startsWith(`${m}-`)) delete window.plannerConfig[k];
    });

    let dayCounter = startDay;
    const totalWeeks = Math.ceil(newCount / 7);
    for (let w = 1; w <= totalWeeks; w++) {
        const key = `${m}-${w}`;
        const daysInWk = Math.min(7, newCount - ((w - 1) * 7));
        window.plannerConfig[key] = {
            label: `Week ${w}`,
            theme: "Mês Reestruturado",
            days: Array.from({length: daysInWk}, (_, i) => ({
                n: dayCounter++,
                name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(dayCounter - 2) % 7],
                tag: "Activity",
                activities: [{t:"grammar", i:"📐", title:"Tópico", desc:"Desc", time: "20 min"}]
            }))
        };
    }
    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
    });
}

/**
 * Exclui um mês inteiro
 */
export function deleteMonth(m, uid) {
    if (!confirm(`Tem certeza que deseja excluir o Mês ${m}?`)) return;
    Object.keys(window.plannerConfig).forEach(k => {
        if (k.startsWith(`${m}-`)) delete window.plannerConfig[k];
    });
    saveUserData(uid).then(() => {
        renderStructure(window.plannerConfig, (m, w) => buildWeek(m, w, uid));
        updateProgressBar();
    });
}
