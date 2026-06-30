// --- PROGRESS FUNCTIONS ---
export function updateProgressBar(prefix = "", customConfig = null, customState = null) {
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
    
    // IDs dinâmicos baseados no prefixo (vazio ou "sb-")
    const pbar = document.getElementById(prefix + "pbar");
    if (pbar) pbar.style.width = pctValue + "%";
    
    const dcntEl = document.getElementById(prefix + "dcnt");
    if (dcntEl) dcntEl.textContent = done;

    const pctEl = document.getElementById(prefix + "pct");
    if (pctEl) pctEl.textContent = pctValue + "%";
}

// --- STRUCTURE RENDERING FUNCTION ---
export function renderStructure(plannerConfig, isEditMode, onWeekChange, isPreview = false, prefix = "") {
    const monthNav = document.getElementById(prefix + 'monthNav');
    const monthPanels = document.getElementById(prefix + 'monthPanels');
    const addBtn = document.getElementById(prefix + 'addMonthBtn');

    if(!monthNav || !monthPanels) return;

    // Clear navigation (mantendo o botão de add se não for preview)
    const selector = isPreview ? '.mbtn' : '.mbtn:not(#' + prefix + 'addMonthBtn)';
    monthNav.querySelectorAll(selector).forEach(n => n.remove());
    monthPanels.innerHTML = '';

    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.textContent = `Month ${m}`;
        
        if (isPreview || !addBtn) {
            monthNav.appendChild(mBtn);
        } else {
            monthNav.insertBefore(mBtn, addBtn);
        }

        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `${prefix}mp${m}`;
        
        mPanel.innerHTML = `
            <div class="mheader">
                <h2>Month ${m}</h2>
                <p class="${isPreview ? '' : 'editable-global'}" id="${prefix}m-desc-${m}" contenteditable="${isEditMode && !isPreview}">English Study Plan</p>
                <div style="display: ${isPreview ? 'none' : 'flex'}; gap: 10px;">
                    <button class="edit-m-btn" data-month="${m}">⚙️ Restructure</button>
                    <button class="del-m-btn" data-month="${m}">🗑️ Delete</button>
                </div>
            </div>
            <div class="week-nav"></div>
        `;

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
            wPanel.id = `${prefix}wp${m}-${weekNum}`;

            wBtn.onclick = (e) => {
                e.stopPropagation();
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                onWeekChange(m, weekNum, isPreview, prefix);
            };

            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

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

        // --- WEEK NAVIGATION BAR ---
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
            wPanel.id = `wp${m}-${weekNum}`;

            wBtn.onclick = (e) => {
                e.stopPropagation();
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                onWeekChange(m, weekNum, isPreview);
            };

            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

        // Event listeners for month management (hidden in Preview)
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
            document.querySelectorAll('.mbtn, .mpanel').forEach(el => el.classList.remove('on'));
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            const firstW = mPanel.querySelector('.wbtn');
            if(firstW) firstW.click();
        };
    });
}
