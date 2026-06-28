// --- FUNÇÕES DE INTERFACE (PROGRESSO E RENDER) ---

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
        statsContainer.innerHTML = `<strong id="dcnt">${done}</strong> / ${totalDays} days`;
    }

    const pctEl = document.getElementById("pct");
    if (pctEl) pctEl.textContent = pctValue + "%";
}

export function renderStructure(plannerConfig, onWeekChange) {
    const monthNav = document.getElementById('monthNav');
    const monthPanels = document.getElementById('monthPanels');
    const addBtn = document.getElementById('addMonthBtn');

    // 1. Limpeza total de segurança
    monthNav.querySelectorAll('.mbtn:not(#addMonthBtn)').forEach(n => n.remove());
    monthPanels.innerHTML = '';

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("planner").style.display = "block";

    const months = [...new Set(Object.keys(plannerConfig).map(key => key.split('-')[0]))]
                   .sort((a, b) => Number(a) - Number(b));

    months.forEach((m, idx) => {
        const mBtn = document.createElement('button');
        mBtn.className = `mbtn ${idx === 0 ? 'on' : ''}`;
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
        mPanel.querySelector('.edit-m-btn').onclick = (e) => { e.stopPropagation(); if (user) import('./planner.js').then(mod => mod.editMonthStructure(m, user.uid)); };
        mPanel.querySelector('.del-m-btn').onclick = (e) => { e.stopPropagation(); if (user) import('./planner.js').then(mod => mod.deleteMonth(m, user.uid)); };
        
        const wNav = mPanel.querySelector('.week-nav');
        const weeks = Object.keys(plannerConfig).filter(key => key.startsWith(`${m}-`)).sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

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

// --- LOGICA DE CORES E TEMAS (REATIVIDADE TOTAL) ---

function getContrastYIQ(hexcolor){
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

function getOppositeColor(hex) {
    hex = hex.replace('#', '');
    let r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16).padStart(2, '0');
    let g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16).padStart(2, '0');
    let b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16).padStart(2, '0');
    return '#' + r + g + b;
}

export function applyTheme(config) {
    const root = document.documentElement;
    if (!config || Object.keys(config).length === 0) return;

    root.setAttribute('data-theme', config.mode);
    
    const isDark = config.mode === 'dark';
    
    if (config.mode === 'gradient') {
        const g1 = config.grad1 || '#c85a2a';
        const g2 = config.grad2 || '#2a4f8a';
        root.style.setProperty('--bg', `linear-gradient(135deg, ${g1}, ${g2})`);
        root.style.setProperty('--accent', g1);
        root.style.setProperty('--accent-text', getContrastYIQ(g1));
        root.style.setProperty('--accent-opposite', g2);
        
        // Ajuste inteligente de visibilidade para textos "muted" e "ink" em gradientes
        const brightness = getContrastYIQ(g1);
        root.style.setProperty('--ink', brightness === '#ffffff' ? '#ffffff' : '#1a1814');
        root.style.setProperty('--muted', brightness === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)');
    } else {
        const acc = config.accent || '#c85a2a';
        root.style.setProperty('--accent', acc);
        root.style.setProperty('--accent-text', getContrastYIQ(acc));
        root.style.setProperty('--accent-opposite', getOppositeColor(acc));
        root.style.setProperty('--bg', isDark ? '#121212' : '#f7f5f0');
        root.style.setProperty('--ink', isDark ? '#ffffff' : '#1a1814');
        root.style.setProperty('--muted', isDark ? '#a0a0a0' : '#7a7570');
    }

    if (config.font) root.style.setProperty('--font-family', config.font);
    if (config.size) root.style.setProperty('--font-size', config.size + 'px');
    if (config.width) root.style.setProperty('--content-width', config.width);
    if (config.radius) root.style.setProperty('--radius', config.radius + 'px');
}

// --- CONFIGURAÇÕES DO MODAL ---

document.getElementById('settingsBtn').onclick = () => {
    const cfg = window.themeConfig || {};
    if(cfg.mode) document.getElementById('themeMode').value = cfg.mode;
    document.getElementById('themeMode').dispatchEvent(new Event('change'));
    if(cfg.accent) document.getElementById('accentColor').value = cfg.accent;
    if(cfg.grad1) document.getElementById('gradColor1').value = cfg.grad1;
    if(cfg.grad2) document.getElementById('gradColor2').value = cfg.grad2;
    if(cfg.font) document.getElementById('fontFamily').value = cfg.font;
    if(cfg.size) document.getElementById('fontSize').value = cfg.size;
    if(cfg.width) document.getElementById('contentWidth').value = cfg.width;
    if(cfg.radius) document.getElementById('borderRadius').value = cfg.radius;
    document.getElementById('settingsModal').style.display = 'flex';
};

document.getElementById('themeMode').onchange = (e) => {
    const isGrad = e.target.value === 'gradient';
    document.getElementById('singleColorArea').style.display = isGrad ? 'none' : 'block';
    document.getElementById('gradientColorArea').style.display = isGrad ? 'grid' : 'none';
};

document.getElementById('closeSettingsBtn').onclick = () => {
    document.getElementById('settingsModal').style.display = 'none';
};

document.getElementById('saveThemeBtn').onclick = async () => {
    const newTheme = {
        mode: document.getElementById('themeMode').value,
        accent: document.getElementById('accentColor').value,
        grad1: document.getElementById('gradColor1').value,
        grad2: document.getElementById('gradColor2').value,
        font: document.getElementById('fontFamily').value,
        size: document.getElementById('fontSize').value,
        width: document.getElementById('contentWidth').value,
        radius: document.getElementById('borderRadius').value
    };
    applyTheme(newTheme);
    const user = window.auth.currentUser;
    if (user) {
        const storage = await import('./storage.js');
        Object.assign(window.themeConfig, newTheme);
        storage.saveUserData(user.uid);
    }
    document.getElementById('settingsModal').style.display = 'none';
};

document.getElementById('resetThemeBtn').onclick = () => {
    if(confirm("Restaurar padrões?")) {
        const def = { mode:'light', accent:'#c85a2a', font:'Georgia, serif', size:'15', width:'900px', radius:'10' };
        applyTheme(def);
        document.getElementById('saveThemeBtn').click();
    }
};
