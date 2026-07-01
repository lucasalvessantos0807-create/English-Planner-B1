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
export function renderStructure(plannerConfig, isEditMode, onWeekChange, isPreview = false, prefix = "") {
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
        mBtn.textContent = `Month ${m}`;
        
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

        const wNav = mPanel.querySelector('.week-nav');
        
        // Filtrar e ordenar semanas deste mês
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
                    e.stopPropagation();
                    const uid = window.auth.currentUser.uid;
                    import('./planner.js').then(mod => mod.editMonthStructure(m, uid));
                };
            }
           
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    const uid = window.auth.currentUser.uid;
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
