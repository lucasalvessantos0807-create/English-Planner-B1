import { weeksData } from './weeks.js';
import { updateState, saveUserProgress, state } from './storage.js';
import { updateProgressBar } from './ui.js';

const builtWeeks = new Set();

export function buildWeek(m, w, uid) {
    const key = `${m}-${w}`;
    if (builtWeeks.has(key)) return;
    const wk = weeksData[key];
    const container = document.getElementById(`wp${m}-${w}`);
    if (!wk || !container) return;
    container.innerHTML = `<div class="wkbar ${wk.review ? 'rv' : ''}"><h3>${wk.label}</h3><p>${wk.theme}</p></div>`;
    wk.days.forEach(day => {
        const dayKey = `d${day.n}`;
        const dayData = state[dayKey] || { done: false, notes: "" };
        const card = document.createElement("div");
        card.className = "daycard";
        card.innerHTML = `
            <div class="dayhead ${day.review ? 'rv' : ''}">
                <div class="daynum ${day.review ? 'rv' : ''}">${day.n}</div>
                <div class="dayname">${day.name}</div>
                <div class="daytag ${day.review ? 'rv' : ''}">${day.tag}</div>
            </div>
            <div class="daybody" id="db${day.n}">
                ${day.activities.map(act => `
                    <div class="act">
                        <div class="aico ${act.t}">${act.i}</div>
                        <div class="acont">
                            <div class="atitle">${act.title}</div>
                            <div class="adesc">${act.desc}</div>
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
        card.querySelector('.dayhead').onclick = () => card.querySelector('.daybody').classList.toggle('on');
        const textarea = card.querySelector('textarea');
        textarea.oninput = (e) => {
            updateState(dayKey, { notes: e.target.value });
            saveUserProgress(uid);
        };
        const chk = card.querySelector('input[type="checkbox"]');
        chk.onchange = (e) => {
            const isDone = e.target.checked;
            updateState(dayKey, { done: isDone });
            card.querySelector('.chk').classList.toggle('done', isDone);
            saveUserProgress(uid);
            updateProgressBar();
        };
        container.appendChild(card);
    });
    builtWeeks.add(key);
}
