export function updateProgressBar() {
    const state = window.appState || {};
    const config = window.plannerConfig || {};
    
    let totalDays = 0;
    // Conta os dias baseando-se no plannerConfig atual (dinâmico)
    Object.values(config).forEach(w => {
        if (w.days) totalDays += w.days.length;
    });
    
    let done = 0;
    Object.keys(state).forEach(key => {
        if (state[key] && state[key].done) done++;
    });

    const pctValue = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    // Atualiza a barra visual
    const pbar = document.getElementById("pbar");
    if (pbar) pbar.style.width = pctValue + "%";
    
    // Atualiza o texto de progresso (Recriando o strong com o ID para não perdê-lo)
    const statsContainer = document.querySelector('.prog-stats span:first-child');
    if (statsContainer) {
        statsContainer.innerHTML = `<strong id="dcnt">${done}</strong> / ${totalDays} days`;
    }

    // Atualiza a porcentagem
    const pctEl = document.getElementById("pct");
    if (pctEl) pctEl.textContent = pctValue + "%";
    
    const totalLabel = document.querySelector('.prog-stats span:first-child');
    if (totalLabel) totalLabel.innerHTML = `<strong>${done}</strong> / ${totalDays} days`;
}

// Função para aplicar as customizações visualmente
export function applyTheme(config) {
    const root = document.documentElement;
    if (!config || Object.keys(config).length === 0) return;

    if (config.mode) root.setAttribute('data-theme', config.mode);
    if (config.accent) {
        root.style.setProperty('--accent', config.accent);
        // Cria uma versão clara da cor de destaque para os fundos
        root.style.setProperty('--accent-light', config.accent + '22'); 
    }
    if (config.font) root.style.setProperty('--font-family', config.font);
    if (config.size) root.style.setProperty('--font-size', config.size + 'px');
    if (config.width) root.style.setProperty('--content-width', config.width);
    if (config.radius) root.style.setProperty('--radius', config.radius + 'px');
}

export function renderStructure(plannerConfig, onWeekChange) {
    const monthNav = document.getElementById('monthNav');
    const monthPanels = document.getElementById('monthPanels');
    const addBtn = document.getElementById('addMonthBtn');

    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    // Garante que o planner continue visível e o login escondido
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("planner").style.display = "block";

    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
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
                <p>English Study Plan — Continuous Progress</p>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="edit-m-btn" style="font-size:10px; opacity:0.6; background:none; border:1px solid var(--border); border-radius:4px; cursor:pointer; padding: 4px 8px;">⚙️ Restructure</button>
                    <button class="del-m-btn" style="font-size:10px; opacity:0.6; background:none; border:1px solid #ffcccc; color:#cc0000; border-radius:4px; cursor:pointer; padding: 4px 8px;">🗑️ Delete Month</button>
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

        mBtn.onclick = () => {
            document.querySelectorAll('.mbtn, .mpanel').forEach(el => el.classList.remove('on'));
            mBtn.classList.add('on');
            mPanel.classList.add('on');
            const firstW = mPanel.querySelector('.wbtn');
            if(firstW) firstW.click();
        };
    });
}

// --- LOGICA DO PAINEL DE CONFIGURAÇÕES ---

// Abrir Modal
document.getElementById('settingsBtn').onclick = () => {
    const cfg = window.themeConfig || {};
    if(cfg.mode) document.getElementById('themeMode').value = cfg.mode;
    if(cfg.accent) document.getElementById('accentColor').value = cfg.accent;
    if(cfg.font) document.getElementById('fontFamily').value = cfg.font;
    if(cfg.size) document.getElementById('fontSize').value = cfg.size;
    if(cfg.width) document.getElementById('contentWidth').value = cfg.width;
    if(cfg.radius) document.getElementById('borderRadius').value = cfg.radius;
    document.getElementById('settingsModal').style.display = 'flex';
};

// Fechar Modal
document.getElementById('closeSettingsBtn').onclick = () => {
    document.getElementById('settingsModal').style.display = 'none';
};

// Botão Salvar
document.getElementById('saveThemeBtn').onclick = async () => {
    const newTheme = {
        mode: document.getElementById('themeMode').value,
        accent: document.getElementById('accentColor').value,
        font: document.getElementById('fontFamily').value,
        size: document.getElementById('fontSize').value,
        width: document.getElementById('contentWidth').value,
        radius: document.getElementById('borderRadius').value
    };
    
    applyTheme(newTheme);
    
    const user = window.auth.currentUser;
    if (user) {
        const storage = await import('./storage.js');
        // Atualiza a referência global
        Object.assign(window.themeConfig, newTheme);
        storage.saveUserData(user.uid);
    }
    document.getElementById('settingsModal').style.display = 'none';
};

// Botão Resetar
document.getElementById('resetThemeBtn').onclick = () => {
    if(confirm("Restaurar todas as configurações para o padrão?")) {
        const defaultTheme = { mode: 'light', accent: '#c85a2a', font: 'Georgia, serif', size: '15', width: '900px', radius: '10' };
        applyTheme(defaultTheme);
        document.getElementById('saveThemeBtn').click();
    }
};
