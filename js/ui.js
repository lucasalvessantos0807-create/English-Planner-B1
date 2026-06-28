// --- FUNÇÕES DE PROGRESSO ---
export function updateProgressBar() {
    const state = window.appState || {};
    const config = window.plannerConfig || {};
    
    let totalDays = 0;
    Object.values(config).forEach(w => {
        if (w.days) totalDays += w.days.length;
    });
    
    let done = 0;
    Object.keys(state).forEach(key => {
        if (state[key] && state[key].done) done++;
    });

    const pctValue = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    const pbar = document.getElementById("pbar");
    if (pbar) pbar.style.width = pctValue + "%";
    
    const dcntEl = document.getElementById("dcnt");
    if (dcntEl) dcntEl.textContent = done;

    const statsContainer = document.querySelector('.prog-stats span:first-child');
    if (statsContainer) {
        statsContainer.innerHTML = `<strong>${done}</strong> / ${totalDays} days`;
    }

    const pctEl = document.getElementById("pct");
    if (pctEl) pctEl.textContent = pctValue + "%";
}

// --- FUNÇÃO DE RENDERIZAÇÃO DA ESTRUTURA ---
export function renderStructure(plannerConfig, onWeekChange) {
    const monthNav = document.getElementById('monthNav');
    const monthPanels = document.getElementById('monthPanels');
    const addBtn = document.getElementById('addMonthBtn');

    // Limpeza
    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        // Criar Botão do Mês
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.textContent = `Month ${m}`;
        monthNav.insertBefore(mBtn, addBtn);

        // Criar Painel do Mês
        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `mp${m}`;
        
       mPanel.innerHTML = `
    <div class="mheader">
        <h2>Month ${m}</h2>
        <p>English Study Plan — Continuous Progress</p>
        <div style="display: flex; gap: 10px;">
            <button class="edit-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid var(--border); border-radius:4px; cursor:pointer;">⚙️ Restructure</button>
            <button class="del-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid #ffcccc; color: #cc0000; border-radius:4px; cursor:pointer;">🗑️ Delete Month</button>
        </div>
    </div>
`;

        // --- BARRA DE NAVEGAÇÃO DE SEMANAS (Sempre no topo) ---
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
                onWeekChange(m, weekNum);
            };

            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

        // Evento do botão de reestruturar
        mPanel.querySelector('.edit-m-btn').onclick = (e) => {
            e.stopPropagation();
            const uid = window.auth.currentUser.uid;
            import('./planner.js').then(mod => mod.editMonthStructure(m, uid));
        };
       
        // Evento do botão de deletar
mPanel.querySelector('.del-m-btn').onclick = (e) => {
    e.stopPropagation();
    const uid = window.auth.currentUser.uid;
    import('./planner.js').then(mod => mod.deleteMonth(m, uid));
};

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
