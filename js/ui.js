// --- PROGRESS FUNCTIONS ---
/**
 * Atualiza a barra de progresso e as estatísticas de dias.
 * @param {string} prefix - Prefixo para IDs (ex: "" para principal, "sb-" para sandbox)
 * @param {object} customConfig - Configuração do planner (opcional para preview)
 * @param {object} customState - Estado de conclusão (opcional para preview)
 */
export function updateProgressBar(prefix = "", customConfig = null, customState = null) {
    // Garante que estamos usando o estado mais atual ou o fornecido pelo backup
    const state = customState || window.appState || {};
    const config = customConfig || window.plannerConfig || {};
    
    let totalDays = 0;
    Object.values(config).forEach(w => {
        if (w.days) totalDays += w.days.length;
    });
    
    let done = 0;
    // Percorremos a configuração do planner para verificar o status de cada dia no banco de dados
    Object.keys(config).forEach(wkKey => {
        const mNum = wkKey.split('-')[0];
        if (config[wkKey].days) {
            config[wkKey].days.forEach(day => {
                const dayKey = `d${day.n}`;
                const fullKey = `m${mNum}-${dayKey}`;
                
                // Um dia é considerado concluído se estiver marcado no formato novo (m1-d1)
                // OU no formato legado (d1) para garantir a migração sem perda de dados
                const isDone = (state[fullKey] && state[fullKey].done) || (state[dayKey] && state[dayKey].done);
                
                if (isDone) done++;
            });
        }
    });

    const pctValue = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    // Atualiza Elementos no DOM usando o prefixo (Ex: pbar ou sb-pbar)
    const pbar = document.getElementById(prefix + "pbar");
    if (pbar) pbar.style.width = pctValue + "%";
    
    const dcntEl = document.getElementById(prefix + "dcnt");
    if (dcntEl) dcntEl.textContent = done;

    const pctEl = document.getElementById(prefix + "pct");
    if (pctEl) pctEl.textContent = pctValue + "%";

    // Atualiza a frase estatística: "X / Y days"
    const statsSelector = prefix ? `#sb-dcnt` : `#dcnt`;
    const dcntSpan = document.querySelector(statsSelector);
    if (dcntSpan && dcntSpan.parentElement) {
        dcntSpan.parentElement.innerHTML = `<strong id="${prefix}dcnt">${done}</strong> / ${totalDays} days`;
    }
}

// --- STRUCTURE RENDERING FUNCTION ---
/**
 * Renderiza os botões de meses e painéis de semanas.
 */
export function renderStructure(plannerConfig, isEditMode, onWeekChange, isPreview = false, prefix = "", lang = 'en') {
    const monthNav = document.getElementById(prefix + 'monthNav');
    const monthPanels = document.getElementById(prefix + 'monthPanels');
    const addBtn = document.getElementById(prefix + 'addMonthBtn');

    if (!monthNav || !monthPanels) return;

    // Limpa a navegação e os painéis
    // No modo normal, não remove o botão "+ Add Month"
    const buttonsToRemove = isPreview ? '.mbtn' : '.mbtn:not(#addMonthBtn)';
    monthNav.querySelectorAll(buttonsToRemove).forEach(n => n.remove());
    monthPanels.innerHTML = '';

    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        // --- Criar Botão do Mês ---
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        const monthLabel = (lang === 'pt' ? 'Mês' : lang === 'es' ? 'Mes' : lang === 'fr' ? 'Mois' : 'Month');
        mBtn.textContent = `${monthLabel} ${m}`;
        
        if (isPreview || !addBtn) {
            monthNav.appendChild(mBtn);
        } else {
            monthNav.insertBefore(mBtn, addBtn);
        }

        // --- Criar Painel do Mês ---
        const mPanel = document.createElement('div');
        mPanel.className = `mpanel ${idx === 0 ? 'on' : ''}`;
        mPanel.id = `${prefix}mp${m}`;
        
        // Cabeçalho do Mês
        const mLabelHeader = (lang === 'pt' ? 'Mês' : lang === 'es' ? 'Mes' : lang === 'fr' ? 'Mois' : 'Month');
        mPanel.innerHTML = `
            <div class="mheader">
                <h2>${mLabelHeader} ${m}</h2>
                <p class="${isPreview ? '' : 'editable-global'}" id="${prefix}m-desc-${m}" contenteditable="${isEditMode && !isPreview}">English Study Plan — Continuous Progress</p>
                <div style="display: ${isPreview ? 'none' : 'flex'}; gap: 10px;">
                    <button class="edit-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid var(--border); border-radius:4px; cursor:pointer;">⚙️ Restructure Month</button>
                    <button class="del-m-btn" data-month="${m}" style="margin-top:10px; font-size:10px; opacity:0.5; background:none; border:1px solid #ffcccc; color: #cc0000; border-radius:4px; cursor:pointer;">🗑️ Delete Month</button>
                </div>
            </div>
            <div class="week-nav"></div>
        `;

        const wNav = mPanel.querySelector('.week-nav');
        
        // Filtrar e ordenar semanas deste mês
        const weeks = Object.keys(plannerConfig)
            .filter(key => key.startsWith(`${m}-`))
            .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

        weeks.forEach((wkKey, wIdx) => {
            const weekNum = wkKey.split('-')[1];
            
            const wBtn = document.createElement('button');
            wBtn.className = `wbtn ${wIdx === 0 ? 'on' : ''}`;
            
            let label = plannerConfig[wkKey].label;
            const weekLabel = (lang === 'pt' ? 'Semana' : lang === 'es' ? 'Semana' : lang === 'fr' ? 'Semaine' : 'Week');
            if (label.toLowerCase().startsWith('week')) {
                label = label.replace(/week/i, weekLabel);
            }
            wBtn.textContent = label;
            
            const wPanel = document.createElement('div');
            wPanel.className = `wpanel ${wIdx === 0 ? 'on' : ''}`;
            wPanel.id = `${prefix}wp${m}-${weekNum}`;

            wBtn.onclick = (e) => {
                e.stopPropagation();
                mPanel.querySelectorAll('.wbtn, .wpanel').forEach(el => el.classList.remove('on'));
                wBtn.classList.add('on');
                wPanel.classList.add('on');
                // Dispara a função para construir o conteúdo da semana
                onWeekChange(m, weekNum, isPreview, prefix);
            };

            wNav.appendChild(wBtn);
            mPanel.appendChild(wPanel);
        });

        // Event listeners para gestão de meses (escondidos em Preview)
        if (!isPreview) {
            const editBtn = mPanel.querySelector('.edit-m-btn');
            const delBtn = mPanel.querySelector('.del-m-btn');

            if (editBtn) {
                editBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const uid = window.auth.currentUser.uid;
                    // Importação dinâmica para garantir acesso à função exportada
                    import('./planner.js').then(mod => mod.editMonthStructure(m, uid));
                };
            }
           
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const uid = window.auth.currentUser.uid;
                    // Importação dinâmica para garantir acesso à função exportada
                    import('./planner.js').then(mod => mod.deleteMonth(m, uid));
                };
            }
        }

        monthPanels.appendChild(mPanel);

        // Clique no Botão do Mês
        mBtn.onclick = () => {
            monthNav.querySelectorAll('.mbtn').forEach(el => el.classList.remove('on'));
            monthPanels.querySelectorAll('.mpanel').forEach(el => el.classList.remove('on'));
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            // Clica automaticamente na primeira semana do mês selecionado
            const firstW = mPanel.querySelector('.wbtn');
            if (firstW) firstW.click();
        };
    });
}

/**
 * Atualiza a barra de progresso e as estatísticas de dias
 */
export function updateProgressBar() {
    const state = window.appState || {};
    const config = window.plannerConfig || {};
    
    let totalDays = 0;
    // Conta todos os dias configurados em todas as semanas
    Object.values(config).forEach(item => {
        if (item && item.days) {
            totalDays += item.days.length;
        }
    });
    
    let done = 0;
    // Conta quantos dias estão marcados como done no estado do usuário
    Object.keys(state).forEach(key => {
        if (state[key] && state[key].done === true) {
            done++;
        }
    });

    const pct = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    const pbar = document.getElementById("pbar");
    if (pbar) pbar.style.width = pct + "%";
    
    const dcntEl = document.getElementById("dcnt");
    const pctEl = document.getElementById("pct");
    if (dcntEl) dcntEl.textContent = done;
    if (pctEl) pctEl.textContent = pct + "%";
    
    const totalLabel = document.querySelector('.prog-stats span:first-child');
    if (totalLabel) {
        totalLabel.innerHTML = `<strong>${done}</strong> / ${totalDays} dias`;
    }
}

/**
 * Renderiza as seções estáticas: Overview e Daily Template
 */
export function renderOverviewAndTemplate(config) {
    // 1. Renderizar os 3 Cards do Overview
    for (let i = 1; i <= 3; i++) {
        const titleEl = document.getElementById(`ov-t${i}`);
        const bodyEl = document.getElementById(`ov-b${i}`);
        
        if (config.overview && config.overview[`m${i}`]) {
            titleEl.innerText = config.overview[`m${i}`].title || `Month ${i}`;
            bodyEl.innerText = config.overview[`m${i}`].body || "Clique em Edit Mode para adicionar a descrição deste mês.";
        } else {
            titleEl.innerText = `Month ${i}`;
            bodyEl.innerText = "Clique em Edit Mode para adicionar a descrição deste mês.";
        }
    }

    // 2. Renderizar o Daily Template
    const tplContainer = document.getElementById('dailyTemplateContainer');
    // Dados padrão caso não existam no banco
    const defaultTemplate = [
        { time: "0–15 min", act: "Vocabulary — Review words, add 5 new ones." },
        { time: "15–35 min", act: "Reading — Read 4–7 pages, circle unknown words." },
        { time: "35–55 min", act: "Shadowing — Listen once, shadow line by line." },
        { time: "55–75 min", act: "Listening — Short clip, dictation on Tue/Fri." },
        { time: "75–95 min", act: "Grammar (Mon/Wed/Fri) or Writing (Tue/Thu/Sat)" },
        { time: "95–115 min", act: "Speaking — Talk about the writing topic." },
        { time: "Sunday", act: "Review Day — Grammar review, vocab test." }
    ];

    const templateData = config.dailyTemplate || defaultTemplate;
    
    tplContainer.innerHTML = templateData.map((item, idx) => `
        <div class="tpl-row">
            <div class="tpl-time" id="tpl-t${idx}">${item.time}</div>
            <div class="tpl-act" id="tpl-a${idx}">${item.act}</div>
        </div>
    `).join('');
}

/**
 * Renderiza a estrutura de botões de meses e semanas
 */
export function renderStructure(plannerConfig, onWeekChange) {
    const monthNav = document.getElementById('monthNav');
    const monthPanels = document.getElementById('monthPanels');
    const addBtn = document.getElementById('addMonthBtn');

    // Limpa navegação anterior mantendo o botão de adicionar
    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    // Filtra as chaves que são semanas (formato X-Y)
    const monthKeys = Object.keys(plannerConfig)
        .filter(k => k.includes('-'))
        .map(k => k.split('-')[0]);
    
    const months = [...new Set(monthKeys)].sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        // Criar Botão do Mês
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
        mBtn.dataset.month = m;
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
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="edit-m-btn" data-month="${m}" style="font-size:10px; opacity:0.6; background:none; border:1px solid var(--border); border-radius:4px; cursor:pointer; padding: 4px 8px;">⚙️ Restructure</button>
                    <button class="del-m-btn" data-month="${m}" style="font-size:10px; opacity:0.6; background:none; border:1px solid #ffcccc; color:#cc0000; border-radius:4px; cursor:pointer; padding: 4px 8px;">🗑️ Delete Month</button>
                </div>
            </div>
            <div class="week-nav"></div>
        `;
        
        const user = window.auth ? window.auth.currentUser : null;

        // Botão Reestruturar
        mPanel.querySelector('.edit-m-btn').onclick = () => {
            if (!user) return;
            import('./planner.js').then(m => m.editMonthStructure(m, user.uid));
        };

        // Botão Deletar
        mPanel.querySelector('.del-m-btn').onclick = () => {
            if (!user) return;
            import('./planner.js').then(m => m.deleteMonth(m, user.uid));
        };
        
        // Criar Semanas
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

        mBtn.onclick = () => {
            document.querySelectorAll('.mbtn, .mpanel').forEach(el => el.classList.remove('on'));
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            const firstW = mPanel.querySelector('.wbtn');
            if (firstW) firstW.click();
        };
    });
}
