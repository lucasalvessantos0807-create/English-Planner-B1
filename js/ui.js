export function updateProgressBar() {
    const state = window.appState || {};
    const config = window.plannerConfig || {};
    
    // Conta quantos dias totais existem no seu cronograma atual
    let totalDays = 0;
    Object.values(config).forEach(w => totalDays += w.days.length);
    
    let done = 0;
    Object.keys(state).forEach(key => {
        if (state[key].done) done++;
    });

    const pct = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;
    
    document.getElementById("pbar").style.width = pct + "%";
    document.getElementById("dcnt").textContent = done;
    document.getElementById("pct").textContent = pct + "%";
    
    const totalLabel = document.querySelector('.prog-stats span:first-child');
    if (totalLabel) totalLabel.innerHTML = `<strong>${done}</strong> / ${totalDays} days`;
}

export function setupNavigation(onWeekChange) {
    document.querySelectorAll('.mbtn').forEach(btn => {
        if (btn.id === 'addMonthBtn') return; // Pula o botão de adicionar
        btn.onclick = (e) => {
            const m = e.target.getAttribute('data-month');
            document.querySelectorAll('.mbtn, .mpanel').forEach(el => el.classList.remove('on'));
            e.target.classList.add('on');
            document.getElementById(`mp${m}`).classList.add('on');
            const firstW = document.querySelector(`#mp${m} .wbtn[data-week="1"]`);
            if (firstW) firstW.click();
        };
    });

    document.querySelectorAll('.wbtn').forEach(btn => {
        btn.onclick = (e) => {
            const nav = e.target.closest('.week-nav');
            const m = nav.getAttribute('data-month');
            const w = e.target.getAttribute('data-week');
            document.querySelectorAll(`#mp${m} .wbtn, #mp${m} .wpanel`).forEach(el => el.classList.remove('on'));
            e.target.classList.add('on');
            document.getElementById(`wp${m}-${w}`).classList.add('on');
            onWeekChange(m, w);
        };
    });
}
