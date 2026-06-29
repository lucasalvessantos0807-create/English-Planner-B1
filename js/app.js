import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData, saveUserData, deleteHistoryEntry, clearAllHistory } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("topbarName").textContent = user.displayName;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        const userData = await loadUserData(currentUser);
        renderStructure(userData.plannerConfig, (m, w) => buildWeek(m, w, currentUser));
        
        // --- TOPBAR CONTROLS ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);

        // --- COVER LÓGICA (SOLID & GRADIENT) ---
        const cover = document.getElementById('page-cover');
        const colorInput = document.getElementById('coverColorInput');

        document.getElementById('editCoverBtn').onclick = () => colorInput.click();
        
        colorInput.oninput = (e) => {
            const color = e.target.value;
            cover.style.background = color;
            saveCoverSettings(color);
        };

        document.getElementById('editGradientBtn').onclick = () => {
            const c1 = prompt("Cor 1 (Hex):", "#ff7e5f");
            const c2 = prompt("Cor 2 (Hex):", "#feb47b");
            if (c1 && c2) {
                const gradient = `linear-gradient(135deg, ${c1}, ${c2})`;
                cover.style.background = gradient;
                saveCoverSettings(gradient);
            }
        };

        function saveCoverSettings(value) {
            import('./storage.js').then(store => {
                if(!store.state.settings) store.state.settings = {};
                store.state.settings.coverColor = value;
                store.saveUserData(currentUser);
            });
        }

        if(userData.state.settings && userData.state.settings.coverColor) {
            cover.style.background = userData.state.settings.coverColor;
        }

        // --- DRAWERS & HISTORY ---
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');

        personalizeBtn.onclick = () => { settingsDrawer.classList.remove('open'); customDrawer.classList.toggle('open'); };
        settingsBtn.onclick = () => { customDrawer.classList.remove('open'); settingsDrawer.classList.toggle('open'); renderHistory(); };
        document.getElementById('closeDrawer').onclick = () => customDrawer.classList.remove('open');
        document.getElementById('closeSettings').onclick = () => settingsDrawer.classList.remove('open');

        function renderHistory() {
            const container = document.getElementById('historyList');
            import('./storage.js').then(store => {
                container.innerHTML = store.history.length === 0 ? '<p style="font-size:0.7rem; color:var(--muted); padding:10px;">No history.</p>' : '';
                store.history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `<span style="font-size:0.7rem; color:var(--muted);">${new Date(item.timestamp).toLocaleString()}</span><br><strong>${item.label}</strong><br><button class="history-restore" style="cursor:pointer; padding:2px 8px; font-size:10px; margin-top:5px;">Restore</button>`;
                    div.querySelector('.history-restore').onclick = async () => {
                        if(confirm("Restore this version?")){
                            store.applySnapshot(item.plannerConfig, item.pageContent);
                            await store.saveUserData(currentUser);
                            window.location.reload();
                        }
                    };
                    container.appendChild(div);
                });
            });
        }

        // --- FONTES ---
        const googleFonts = ["Arial", "Verdana", "Georgia", "Montserrat", "Open Sans", "Roboto", "Jost", "Pacifico"];
        const fontListContainer = document.getElementById('fontList');
        const fontSearchInput = document.getElementById('fontSearchInput');

        function renderFonts(filter = "") {
            fontListContainer.innerHTML = "";
            googleFonts.filter(f => f.toLowerCase().includes(filter.toLowerCase())).forEach(font => {
                const div = document.createElement('div');
                div.className = 'font-item';
                div.textContent = font;
                div.style.fontFamily = `"${font}", sans-serif`;
                div.onclick = () => {
                    document.documentElement.style.setProperty('--main-font', `"${font}", sans-serif`);
                    import('./storage.js').then(store => {
                        if (!store.state.settings) store.state.settings = {};
                        store.state.settings.font = font;
                        store.saveUserData(currentUser);
