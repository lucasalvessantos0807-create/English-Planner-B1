import { updateState, saveUserData, state, plannerConfig } from './storage.js';
import { updateProgressBar } from './ui.js';

let isEditMode = false;
const builtWeeks = new Set();

export function toggleEditMode(uid) {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    btn.textContent = isEditMode ? "✅ Save Changes" : "✎ Edit Mode";
    btn.style.background = isEditMode ? "var(--green-light)" : "none";
    btn.style.color = isEditMode ? "var(--green)" : "var(--muted)";
    
    if (!isEditMode) {
        saveUserData(uid);
    }
    
    // Limpa o cache visual para redesenhar com ou sem campos de edição
    builtWeeks.clear();
    const activeBtn = document.querySelector('.wbtn.on');
    if (activeBtn) activeBtn.click();
}

export function buildWeek(m, w, uid) {
    const key = `${m}-${w}`;
    const wk = window.plannerConfig[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;

    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p>${wk.theme}</p></div>`;

    wk.days.forEach((day, dIdx) => {
        const dayKey = `d${day.n}`;
        const dayData = state[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div>
                <div class="dayname">${day.name}</div>
                <div class="daytag" contenteditable="${isEditMode}">${day.tag}</div>
            </div>
            <div class="daybody" id="db${day.n}">
                ${day.activities.map((act, aIdx) => `
                    <div class="act">
                        <div class="aico ${act.t}">${act.i}</div>
                        <div class="acont">
                            <div class="atitle" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.title">${act.title}</div>
                            <div class="adesc" contenteditable="${isEditMode}" data-path="${key}.${dIdx}.${aIdx}.desc">${act.desc}</div>
                        </div>
                        <div class="atime">${act.time}</div>
                    </div>
                `).join('')}
                <textarea class="ntxt" id="nt${day.n}" placeholder="Notes...">${dayData.notes || ""}</textarea>
                <label class="chk ${dayData.done ? 'done' : ''}">
                    <input type="checkbox" ${dayData.done ? 'checked' : ''}>
                    <span>Day ${day.n} completed</span>
                </label>
            </div>
        `;

        // Salva edições de texto
        card.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.onblur = (e) => {
                const path = e.target.dataset.path;
                if (path) {
                    const [wkK, dI, aI, field] = path.split('.');
                    window.plannerConfig[wkK].days[dI].activities[aI][field] = e.target.innerText;
                } else if (e.target.classList.contains('daytag')) {
                    wk.days[dIdx].tag = e.target.innerText;
                }
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
    const monthPanels = document.getElementById('monthPanels');
    const monthNav = document.getElementById('monthNav');
    const addBtn = document.getElementById('addMonthBtn');
    
    const nextMonth = document.querySelectorAll('.mpanel').length + 1;
    const lastDay = Object.values(window.plannerConfig).reduce((acc, curr) => {
        const lastInWeek = curr.days[curr.days.length - 1].n;
        return lastInWeek > acc ? lastInWeek : acc;
    }, 0);

    // 1. Criar dados para as 4 novas semanas no config
    for (let w = 1; w <= 4; w++) {
        const key = `${nextMonth}-${w}`;
        const startDay = lastDay + ((w - 1) * 7) + 1;
        window.plannerConfig[key] = {
            label: `Week ${((nextMonth - 1) * 4) + w}`,
            theme: "New Month - Click 'Edit Mode' to change theme and activities",
            days: Array.from({length: 7}, (_, i) => ({
                n: startDay + i,
                name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i],
                tag: "Activity",
                activities: [{t:"grammar", i:"📐", title:"New Topic", desc:"Description of your study"}]
            }))
        };
    }

    // 2. Salva no Firebase
    saveUserData(uid).then(() => {
        alert("Novo mês adicionado com sucesso! A página irá recarregar.");
        location.reload();
    });
}
