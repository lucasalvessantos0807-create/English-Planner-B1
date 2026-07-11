export function updateProgressBar(prefix = "", customConfig = null, customState = null) {
    const state = customState || window.appState || {};
    const config = customConfig || window.plannerConfig || {};
    let total = 0; Object.values(config).forEach(w => { if (w.days) total += w.days.length; });
    let done = 0;
    Object.keys(config).forEach(wkKey => {
        const m = wkKey.split('-')[0];
        config[wkKey].days?.forEach(d => {
            if ((state[`m${m}-d${d.n}`] && state[`m${m}-d${d.n}`].done) || (state[`d${d.n}`] && state[`d${d.n}`].done)) done++;
        });
    });
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const bar = document.getElementById(prefix + "pbar"); if (bar) bar.style.width = pct + "%";
    const dcnt = document.getElementById(prefix + "dcnt"); if (dcnt) dcnt.textContent = done;
    const pEl = document.getElementById(prefix + "pct"); if (pEl) pEl.textContent = pct + "%";
    const statEl = document.querySelector(prefix ? `#sb-dcnt` : `#dcnt`);
    if (statEl && statEl.parentElement) statEl.parentElement.innerHTML = `<strong id="${prefix}dcnt">${done}</strong> / ${total} days`;
}

export function renderStructure(config, editMode, onWeek, isPrev = false, prefix = "") {
    const nav = document.getElementById(prefix + 'monthNav');
    const panels = document.getElementById(prefix + 'monthPanels');
    const addBtn = document.getElementById(prefix + 'addMonthBtn');
    if (!nav || !panels) return;
    nav.querySelectorAll(isPrev ? '.mbtn' : '.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    panels.innerHTML = '';
    const months = [...new Set(Object.keys(config).map(k => k.split('-')[0]))].sort((a,b) => a-b);
    months.forEach((m, idx) => {
        const btn = document.createElement('button');
        btn.className = `mbtn ${idx === 0 ? 'on' : ''}`; btn.textContent = `Month ${m}`;
        if (isPrev || !addBtn) nav.appendChild(btn); else nav.insertBefore(btn, addBtn);
        const pan = document.createElement('div'); pan.className = `mpanel ${idx === 0 ? 'on' : ''}`; pan.id = `${prefix}mp${m}`;
        pan.innerHTML = `<div class="mheader"><h2>Month ${m}</h2><p class="${isPrev ? '' : 'editable-global'}" id="${prefix}m-desc-${m}" contenteditable="${editMode && !isPrev}">Continuous Progress</p><div style="display:${isPrev ? 'none' : 'flex'}; gap:10px;"><button class="edit-m-btn" data-month="${m}">⚙️ Restructure</button><button class="del-m-btn" data-month="${m}">🗑️ Delete</button></div></div><div class="week-nav"></div>`;
        const wNav = pan.querySelector('.week-nav');
        const weeks = Object.keys(config).filter(k => k.startsWith(`${m}-`)).sort((a,b) => a.split('-')[1] - b.split('-')[1]);
        weeks.forEach((wk, wIdx) => {
            const wb = document.createElement('button'); wb.className = `wbtn ${wIdx === 0 ? 'on' : ''}`; wb.textContent = config[wk].label;
            const wp = document.createElement('div'); wp.className = `wpanel ${wIdx === 0 ? 'on' : ''}`; wp.id = `${prefix}wp${m}-${wk.split('-')[1]}`;
            wb.onclick = () => { pan.querySelectorAll('.wbtn, .wpanel').forEach(e => e.classList.remove('on')); wb.classList.add('on'); wp.classList.add('on'); onWeek(m, wk.split('-')[1], isPrev, prefix); };
            wNav.appendChild(wb); pan.appendChild(wp);
        });
        if (!isPrev) {
            pan.querySelector('.edit-m-btn').onclick = () => import('./planner.js').then(mod => mod.editMonthStructure(m, window.auth.currentUser.uid));
            pan.querySelector('.del-m-btn').onclick = () => import('./planner.js').then(mod => mod.deleteMonth(m, window.auth.currentUser.uid));
        }
        panels.appendChild(pan);
        btn.onclick = () => { nav.querySelectorAll('.mbtn').forEach(e => e.classList.remove('on')); panels.querySelectorAll('.mpanel').forEach(e => e.classList.remove('on')); btn.classList.add('on'); pan.classList.add('on'); pan.querySelector('.wbtn')?.click(); };
    });
}
