// --- PROGRESS FUNCTIONS ---
export function updateProgressBar(targetPrefix = "", customConfig = null, customState = null) {
    // Utiliza os parâmetros passados (Sandbox) ou os globais (Planner Principal)
    const state = customState || window.appState || {};
    const config = customConfig || window.plannerConfig || {};
    
    let totalDays = 0;
    Object.values(config).forEach(w => {
        if (w.days) totalDays += w.days.length;
    });
    
    let done = 0;
    Object.keys(state).forEach(key => {
        if (state[key] && state[key].done) {
            const dayNum = parseInt(key.replace('d', ''));
            const dayExists = Object.values(config).some(week => 
                week.days.some(d => d.n === dayNum)
            );
            if (dayExists) done++;
        }
    });

    const pctValue = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    const pbar = document.getElementById(targetPrefix + "pbar");
    if (pbar) pbar.style.width = pctValue + "%";
    
    const dcntEl = document.getElementById(targetPrefix + "dcnt");
    if (dcntEl) dcntEl.textContent = done;

    // Atualiza o texto do progresso (ex: 0 / 115 days)
    const statsContainer = document.getElementById(targetPrefix + "dcnt-text");
    if (statsContainer) {
        statsContainer.innerHTML = `<strong>${done}</strong> / ${totalDays} days`;
    }

    const pctEl = document.getElementById(targetPrefix + "pct");
    if (pctEl) pctEl.textContent = pctValue + "%";
}

// --- STRUCTURE RENDERING FUNCTION ---
export function renderStructure(plannerConfig, isEditMode, onWeekChange, isPreview = false, targetPrefix = "") {
    const navId = targetPrefix ? `${targetPrefix}monthNav` : 'monthNav';
    const panelsId = targetPrefix ? `${targetPrefix}monthPanels` : 'monthPanels';
    
    const monthNav = document.getElementById(navId);
    const monthPanels = document.getElementById(panelsId);
    const addBtn = document.getElementById('addMonthBtn');

    if (!monthNav || !monthPanels) return;

    // Limpa navegação e painéis (preservando o addBtn no planner principal)
    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.textContent = `Month ${m}`;
        
        if (targetPrefix || !addBtn) {
            monthNav.appendChild(mBtn);
        } else {
            monthNav.insertBefore(mBtn, addBtn);
        }

        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `${targetPrefix}mp${m}`;
        
        mPanel.innerHTML = `
            <div class="mheader">
                <h2>Month ${m}</h2>
                <p class="editable-global" id="${targetPrefix}m-desc-${m}" contenteditable="${isEditMode && !isPreview}">English Study Plan — Continuous Progress</p>
                <div style="display: ${isPreview ? 'none' : 'flex'}; gap: 10px;">
                    <button class="edit-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid var(--border); border-radius:4px; cursor:pointer;">⚙️ Restructure Month</button>
                    <button class="del-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid #ffcccc; color: #cc0000; border-radius:4px; cursor:pointer;">🗑️ Delete Month</button>
                </div>
            </div>
        `;

        const wNav = document.createElement('div');
        wNav.className = "week-nav";
        mPanel.appendChild(wNav); 
        
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
            wPanel.id = `${targetPrefix}wp${m}-${weekNum}`;

            wBtn.onclick = (e) => {
                e.stopPropagation();
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                onWeekChange(m, weekNum, isPreview, targetPrefix);
            };

            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

        if (!isPreview) {
            mPanel.querySelector('.edit-m-btn').onclick = (e) => {
                e.stopPropagation();
                const uid = window.auth.currentUser.uid;
                import('./planner.js').then(mod => mod.editMonthStructure(m, uid));
            };
            mPanel.querySelector('.del-m-btn').onclick = (e) => {
                e.stopPropagation();
                const uid = window.auth.currentUser.uid;
                import('./planner.js').then(mod => mod.deleteMonth(m, uid));
            };
        }

        monthPanels.appendChild(mPanel);

        mBtn.onclick = () => {
            monthNav.querySelectorAll('.mbtn').forEach(el => el.classList.remove('on'));
            monthPanels.querySelectorAll('.mpanel').forEach(el => el.classList.remove('on'));
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            const firstW = mPanel.querySelector('.wbtn');
            if(firstW) firstW.click();
        };
    });
}
