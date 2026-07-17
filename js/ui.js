export function updateProgressBar() {
    const state = window.appState || {};
    const config = window.plannerConfig || {};
    
    let totalDays = 0;
    Object.values(config).forEach(w => {
        if (w.days) totalDays += w.days.length;
    });
    
    let done = 0;
    Object.keys(state).forEach(key => {
        if (state[key] && state[key].done === true) {
            done++;
        }
    });

    const pct = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    const pbar = document.getElementById("pbar");
    if(pbar) pbar.style.width = pct + "%";
    
    const dcntEl = document.getElementById("dcnt");
    const pctEl = document.getElementById("pct");
    if (dcntEl) dcntEl.textContent = done;
    if (pctEl) pctEl.textContent = pct + "%";
    
    const totalLabel = document.querySelector('.prog-stats span:first-child');
    if (totalLabel) {
        totalLabel.innerHTML = `<strong>${done}</strong> / ${totalDays} days`;
    }
}

/**
 * Renderiza Capa, Metas, Overview e Template a partir do Firebase
 */
export function renderGlobalSections(config) {
    // 1. Campos de texto direto (Globals: Capa, Goals, Progress Titles)
    const globals = config.globals || {};
    const fieldIds = [
        'global-cover-eye', 'global-cover-title', 'global-cover-sub', 
        'global-goal-strong', 'global-goal-text', 'global-sec-overview',
        'global-sec-template', 'global-prog-lbl', 'global-mstat'
    ];
    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && globals[id]) el.innerText = globals[id];
    });

    // 2. Renderizar Overview (Cards de Fase)
    const ovGrid = document.getElementById('dynamic-ov-grid');
    if (ovGrid) {
        const overviewData = config.overview || [
            {title: "PHASE 1", body: "Description of your first phase."},
            {title: "PHASE 2", body: "Description of your second phase."},
            {title: "PHASE 3", body: "Description of your third phase."}
        ];
        ovGrid.innerHTML = overviewData.map((item, idx) => `
            <div class="ov-card c${idx % 3 === 0 ? 'a' : (idx % 3 === 1 ? 'b' : 'g')}">
                <div class="ov-label" id="ov-t-${idx}">${item.title}</div>
                <div class="ov-body" id="ov-b-${idx}">${item.body}</div>
            </div>
        `).join('');
    }

    // 3. Renderizar Daily Template (Lista de tarefas)
    const tplList = document.getElementById('dynamic-tpl-list');
    if (tplList) {
        const templateData = config.dailyTemplate || [
            {time: "Step/Time", act: "Task description"}
        ];
        tplList.innerHTML = templateData.map((item, idx) => `
            <div class="tpl-row">
                <div class="tpl-time" id="tpl-t-${idx}">${item.time}</div>
                <div class="tpl-act" id="tpl-a-${idx}">${item.act}</div>
            </div>
        `).join('');
    }
}

export function renderStructure(plannerConfig, onWeekChange) {
    const monthNav = document.getElementById('monthNav');
    const monthPanels = document.getElementById('monthPanels');
    const addBtn = document.getElementById('addMonthBtn');

    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    const months = [...new Set(Object.keys(plannerConfig)
                   .filter(k => k.includes('-'))
                   .map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.dataset.month = m;
        mBtn.textContent = `Month ${m}`;
        monthNav.insertBefore(mBtn, addBtn);

        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `mp${m}`;
        mPanel.innerHTML = `
            <div class="mheader">
                <h2>Month ${m}</h2>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="edit-m-btn" data-month="${m}">⚙️ Restructure</button>
                    <button class="del-m-btn" data-month="${m}">🗑️ Delete</button>
                </div>
            </div>
            <div class="week-nav"></div>
        `;
        
        const user = window.auth ? window.auth.currentUser : null;
        mPanel.querySelector('.edit-m-btn').onclick = () => {
            if (!user) return;
            import('./planner.js').then(mModule => mModule.editMonthStructure(m, user.uid));
        };
        mPanel.querySelector('.del-m-btn').onclick = () => {
            if (!user) return;
            import('./planner.js').then(mModule => mModule.deleteMonth(m, user.uid));
        };
        
        const wNav = mPanel.querySelector('.week-nav');
        const weeks = Object.keys(plannerConfig)
            .filter(key => key.startsWith(`${m}-`))
            .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

        weeks.forEach((wkKey, wIdx) => {
            const weekNum = wkKey.split('-')[1];
            const wBtn = document.createElement('button');
            wBtn.className = `wbtn ${wIdx === 0 ? 'on' : ''}`;
            wBtn.textContent = plannerConfig[wkKey].label;
            const wPanel = document.createElement('div');
            wPanel.className = `wpanel ${wIdx === 0 ? 'on' : ''}`;
            wPanel.id = `wp${m}-${weekNum}`;
            wBtn.onclick = () => {
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                onWeekChange(m, weekNum);
            };
            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });
        monthPanels.appendChild(mPanel);
    });
}
