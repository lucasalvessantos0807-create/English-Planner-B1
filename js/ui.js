export function updateProgressBar() {
    const state = window.appState || {};
    let done = 0;
    for (let i = 1; i <= 84; i++) {
        if (state[`d${i}`] && state[`d${i}`].done) done++;
    }
    const pct = Math.round((done / 84) * 100);
    const pbar = document.getElementById("pbar");
    if (pbar) pbar.style.width = pct + "%";
    const dcnt = document.getElementById("dcnt");
    if (dcnt) dcnt.textContent = done;
    const pctLabel = document.getElementById("pct");
    if (pctLabel) pctLabel.textContent = pct + "%";
}

export function setupNavigation(onWeekChange) {
    document.querySelectorAll('.mbtn').forEach(btn => {
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
