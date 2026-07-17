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
export function renderGlobalSections(config, content, targetPrefix = "", isEditMode = false) {
    const data = content || {};
    
    // 1. Campos de texto direto (Capa, Goals, Títulos)
    const fieldIds = [
        'global-cover-eye', 'global-cover-title', 'global-cover-sub', 
        'global-goal-strong', 'global-goal-text', 'global-sec-overview',
        'global-sec-template', 'global-prog-lbl', 'global-mstat', 'global-sec-monthly'
    ];
    
    fieldIds.forEach(id => {
        const el = document.getElementById(targetPrefix + id);
        if (el && data[id]) el.innerText = data[id];
    });

    // 2. Renderizar Overview (Cards de Fase) - Sincronizado com planner.js
    const ovGrid = document.getElementById(targetPrefix + 'dynamic-ov-grid');
    if (ovGrid) {
        ovGrid.innerHTML = '';
        const blocks = data.dynamicBlocks || [];
        blocks.forEach(blockId => {
            const card = document.createElement('div');
            card.className = 'ov-card cg';
            card.id = `${targetPrefix}container-${blockId}`;
            card.innerHTML = `
                ${(isEditMode && !targetPrefix) ? `<button class="del-ov-btn" data-id="${blockId}" style="display:flex;">✕</button>` : ''}
                <div class="ov-label" id="${targetPrefix}${blockId}-title" contenteditable="${isEditMode && !targetPrefix}">${data[blockId + '-title'] || 'Phase'}</div>
                <div class="ov-body" id="${targetPrefix}${blockId}-body" contenteditable="${isEditMode && !targetPrefix}">${data[blockId + '-body'] || 'Edit details...'}</div>
            `;
            ovGrid.appendChild(card);
        });
    }

    // 3. Renderizar Daily Template - Sincronizado com planner.js
    const tplList = document.getElementById(targetPrefix + 'dynamic-tpl-list');
    if (tplList) {
        tplList.innerHTML = '';
        const rows = data.templateRows || [];
        rows.forEach(rowId => {
            const row = document.createElement('div');
            row.className = 'tpl-row';
            row.id = `${targetPrefix}row-container-${rowId}`;
            row.innerHTML = `
                ${(isEditMode && !targetPrefix) ? `<button class="del-tpl-btn" data-id="${rowId}">✕</button>` : ''}
                <div class="tpl-time" id="${targetPrefix}${rowId}-t" contenteditable="${isEditMode && !targetPrefix}">${data[rowId + '-t'] || '00:00'}</div>
                <div class="tpl-act" id="${targetPrefix}${rowId}-a" contenteditable="${isEditMode && !targetPrefix}">${data[rowId + '-a'] || 'Task description'}</div>
            `;
            tplList.appendChild(row);
        });
    }
}

/**
 * Função placeholder para manter compatibilidade com chamadas antigas no app.js
 */
export function renderOverviewAndTemplate(config) {
    // Função desativada para priorizar o refreshGlobalDOM do app.js
    // Isso evita que o texto padrão do HTML sobrescreva o backup dinâmico.
}

export function renderStructure(plannerConfig, isEditMode, onWeekChange, isPreview = false, prefix = "", lang = 'en') {
    const monthNav = document.getElementById(prefix + 'monthNav');
    const monthPanels = document.getElementById(prefix + 'monthPanels');
    const addBtn = document.getElementById(prefix + 'addMonthBtn');

    if (monthNav) {
        monthNav.querySelectorAll('.mbtn:not(#' + prefix + 'addMonthBtn)').forEach(n => n.remove());
    }
    if (monthPanels) monthPanels.innerHTML = '';

    const months = [...new Set(Object.keys(plannerConfig)
                   .filter(k => k.includes('-'))
                   .map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.dataset.month = m;
        mBtn.textContent = `Month ${m}`;
        if (monthNav && addBtn) monthNav.insertBefore(mBtn, addBtn);

        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `${prefix}mp${m}`;
        mPanel.innerHTML = `
            <div class="mheader">
                <h2>Month ${m}</h2>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    ${!isPreview ? `
                        <button class="edit-m-btn" data-month="${m}">⚙️ Restructure</button>
                        <button class="del-m-btn" data-month="${m}" style="color:red; border-color:#ffcccc;">🗑️ Delete</button>
                    ` : ''}
                </div>
            </div>
            <div class="week-nav" data-month="${m}"></div>
        `;
        
        if (!isPreview) {
            mPanel.querySelector('.edit-m-btn').onclick = () => {
                import('./planner.js').then(mod => mod.editMonthStructure(m, window.auth.currentUser.uid));
            };
            mPanel.querySelector('.del-m-btn').onclick = () => {
                import('./planner.js').then(mod => mod.deleteMonth(m, window.auth.currentUser.uid));
            };
        }
        
        const wNav = mPanel.querySelector('.week-nav');
        const weeks = Object.keys(plannerConfig)
            .filter(key => key.startsWith(`${m}-`))
            .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

        weeks.forEach((wkKey, wIdx) => {
            const weekNum = wkKey.split('-')[1];
            const wBtn = document.createElement('button');
            wBtn.className = `wbtn ${wIdx === 0 ? 'on' : ''}`;
            wBtn.dataset.week = weekNum;
            wBtn.textContent = plannerConfig[wkKey].label;
            const wPanel = document.createElement('div');
            wPanel.className = `wpanel ${wIdx === 0 ? 'on' : ''}`;
            wPanel.id = `${prefix}wp${m}-${weekNum}`;
            
            wBtn.onclick = () => {
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                onWeekChange(m, weekNum, isPreview, prefix);
            };
            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

        if (monthPanels) monthPanels.appendChild(mPanel);

        mBtn.onclick = () => {
            const allBtn = prefix ? document.querySelectorAll(`#${prefix}sandbox-content .mbtn`) : document.querySelectorAll('.month-nav .mbtn');
            const allPanels = prefix ? document.querySelectorAll(`#${prefix}sandbox-content .mpanel`) : document.querySelectorAll('#monthPanels .mpanel');
            
            allBtn.forEach(el => el.classList.remove('on'));
            allPanels.forEach(el => el.classList.remove('on'));
            
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            const firstW = mPanel.querySelector('.wbtn');
            if(firstW) firstW.click();
        };
    });
}
