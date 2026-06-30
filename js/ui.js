// --- PROGRESS FUNCTIONS ---
// Esta função calcula e desenha a barra de progresso.
// Ela aceita prefixo (ex: "sb-") para atualizar a Sandbox sem mexer na tela principal.
export function updateProgressBar(prefix = "", customConfig = null, customState = null) {
    // Escolhe entre os dados passados (Preview) ou os dados globais (App Principal)
    const state = customState || window.appState || {};
    const config = customConfig || window.plannerConfig || {};
    
    let totalDays = 0;
    Object.values(config).forEach(w => {
        if (w.days) totalDays += w.days.length;
    });
    
    let done = 0;
    // Contamos apenas dias que existem na configuração que está sendo visualizada
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
    
    // Atualiza a largura da barra (pbar ou sb-pbar)
    const pbar = document.getElementById(prefix + "pbar");
    if (pbar) pbar.style.width = pctValue + "%";
    
    // Atualiza o contador numérico (dcnt ou sb-dcnt)
    const dcntEl = document.getElementById(prefix + "dcnt");
    if (dcntEl) dcntEl.textContent = done;

    // Atualiza o texto estatístico "X / Y days"
    // Procuramos pelo span que contém o dcnt específico (da main ou da sandbox)
    const statsContainer = document.querySelector(`#${prefix}dcnt`)?.parentElement;
    if (statsContainer) {
        statsContainer.innerHTML = `<strong id="${prefix}dcnt">${done}</strong> / ${totalDays} days`;
    }

    // Atualiza a porcentagem (pct ou sb-pct)
    const pctEl = document.getElementById(prefix + "pct");
    if (pctEl) pctEl.textContent = pctValue + "%";
}

// --- STRUCTURE RENDERING FUNCTION ---
// Reconstrói os botões de meses e as abas de semanas.
export function renderStructure(plannerConfig, isEditMode, onWeekChange, isPreview = false, prefix = "") {
    const monthNav = document.getElementById(prefix + 'monthNav');
    const monthPanels = document.getElementById(prefix + 'monthPanels');
    const addBtn = document.getElementById(prefix + 'addMonthBtn');

    if (!monthNav || !monthPanels) return;

    // Limpa os botões antigos, mas preserva o botão de "Adicionar Mês" se ele existir
    monthNav.querySelectorAll('.mbtn').forEach(n => {
        if (n.id !== (prefix + 'addMonthBtn')) n.remove();
    });
    monthPanels.innerHTML = '';

    // Obtém a lista de meses únicos e ordena
    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        // 1. Cria o Botão do Mês na navegação superior
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.textContent = `Month ${m}`;
        
        // Insere o botão antes do botão de "Add" ou apenas anexa se for preview
        if (addBtn && !isPreview) {
            monthNav.insertBefore(mBtn, addBtn);
        } else {
            monthNav.appendChild(mBtn);
        }

        // 2. Cria o Painel do Mês (mp1, mp2, etc)
        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `${prefix}mp${m}`;
        
        mPanel.innerHTML = `
            <div class="mheader">
                <h2>Month ${m}</h2>
                <p class="${isPreview ? '' : 'editable-global'}" id="${prefix}m-desc-${m}" contenteditable="${isEditMode && !isPreview}">English Study Plan — Continuous Progress</p>
                <div style="display: ${isPreview ? 'none' : 'flex'}; gap: 10px;">
                    <button class="edit-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid var(--border); border-radius:4px; cursor:pointer;">⚙️ Restructure Month</button>
                    <button class="del-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid #ffcccc; color: #cc0000; border-radius:4px; cursor:pointer;">🗑️ Delete Month</button>
                </div>
            </div>
            <div class="week-nav"></div>
        `;

        // 3. Cria a navegação de semanas dentro do mês
        const wNav = mPanel.querySelector('.week-nav');
        const weeks = Object.keys(plannerConfig)
            .filter(key => key.startsWith(`${m}-`))
            .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

        weeks.forEach((wkKey, wIdx) => {
            const weekNum = wkKey.split('-')[1];
            
            const wBtn = document.createElement('button');
            wBtn.className = `wbtn ${wIdx === 0 ? 'on' : ''}`;
            wBtn.textContent = plannerConfig[wkKey].label;
            
            // Container onde os cards dos dias da semana serão injetados
            const wPanel = document.createElement('div');
            wPanel.className = `wpanel ${wIdx === 0 ? 'on' : ''}`;
            wPanel.id = `${prefix}wp${m}-${weekNum}`;

            wBtn.onclick = (e) => {
                e.stopPropagation();
                // Alterna visualmente os botões de semana
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                // Dispara o carregamento dos dias daquela semana
                onWeekChange(m, weekNum, isPreview, prefix);
            };

            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

        // 4. Listeners para botões de gestão (Escondidos no Preview)
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

        // Lógica de clique no botão do mês principal
        mBtn.onclick = () => {
            monthNav.querySelectorAll('.mbtn').forEach(el => el.classList.remove('on'));
            monthPanels.querySelectorAll('.mpanel').forEach(el => el.classList.remove('on'));
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            // Ao clicar no mês, ativa automaticamente a primeira semana dele
            const firstW = mPanel.querySelector('.wbtn');
            if(firstW) firstW.click();
        };
    });
}
