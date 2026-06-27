export function updateProgressBar() {
    const state = window.appState || {};
    const config = window.plannerConfig || {};
    
    let totalDays = 0;
    Object.values(config).forEach(w => totalDays += w.days.length);
    
    let done = 0;
    Object.keys(state).forEach(key => {
        if (state[key] && state[key].done) done++;
    });

    const pct = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    const pbar = document.getElementById("pbar");
    if(pbar) pbar.style.width = pct + "%";
    
    document.getElementById("dcnt").textContent = done;
    document.getElementById("pct").textContent = pct + "%";
    
    const totalLabel = document.querySelector('.prog-stats span:first-child');
    if (totalLabel) totalLabel.innerHTML = `<strong>${done}</strong> / ${totalDays} days`;
}

export function renderStructure(plannerConfig, onWeekChange) {
    const monthNav = document.getElementById('monthNav');
    const monthPanels = document.getElementById('monthPanels');
    const addBtn = document.getElementById('addMonthBtn');

    // Limpa a navegação antiga (preservando apenas o botão de adicionar)
    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    // Mapeia quais meses existem no config (ex: 1, 2, 3...)
    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        // Criar Botão do Mês no Menu
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.dataset.month = m;
        mBtn.textContent = `Month ${m}`;
        monthNav.insertBefore(mBtn, addBtn);

        // Criar Painel de Conteúdo do Mês
        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `mp${m}`;
        mPanel.innerHTML = `<div class="mheader"><h2>Month ${m}</h2><p>English Study Plan — Continuous Progress</p></div>`;

        // Criar Navegação de Semanas dentro deste mês
        const wNav = document.createElement('div');
        wNav.className = "week-nav";
        
        const weeks = Object.keys(plannerConfig)
            .filter(key => key.startsWith(`${m}-`))
            .sort((a, b) => {
                return parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]);
            });

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
            mPanel.appendChild(wNav);
            mPanel.appendChild(wPanel);
        });

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
