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
        
        // --- BOTÕES DA TOPBAR ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);

        // --- LÓGICA DO COVER (CORES E DEGRADÊ) ---
        const cover = document.getElementById('page-cover');
        const colorInput = document.getElementById('coverColorInput');

        document.getElementById('editCoverBtn').onclick = () => {
            colorInput.click();
        };

        colorInput.oninput = (e) => {
            const color = e.target.value;
            cover.style.background = color;
            saveCoverSettings(color);
        };

        document.getElementById('editGradientBtn').onclick = () => {
            const color1 = prompt("Cor 1 (Hex):", "#ff7e5f");
            const color2 = prompt("Cor 2 (Hex):", "#feb47b");
            if (color1 && color2) {
                const gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
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

        // --- OUTROS CONTROLES ---
        document.getElementById('addOverviewBlockBtn').onclick = () => {
            import('./planner.js').then(mod => mod.addOverviewBlock(currentUser));
        };

        document.getElementById('clearHistoryBtn').onclick = async () => {
            if(confirm("Permanently delete ALL history?")){
                await clearAllHistory(currentUser);
                window.location.reload();
            }
        };

        // DRAWERS
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');

        personalizeBtn.onclick = () => { customDrawer.classList.toggle('open'); settingsDrawer.classList.remove('open'); };
        settingsBtn.onclick = () => { settingsDrawer.classList.toggle('open'); customDrawer.classList.remove('open'); };
        document.getElementById('closeDrawer').onclick = () => customDrawer.classList.remove('open');
        document.getElementById('closeSettings').onclick = () => settingsDrawer.classList.remove('open');

        // FONTES E TAMANHO
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const settings = userData.state.settings || {};
        fontSizeSlider.value = settings.fontSize || "15";
        document.documentElement.style.setProperty('--main-font-size', fontSizeSlider.value + "px");

        fontSizeSlider.oninput = (e) => {
            document.getElementById('fontSizeVal').textContent = e.target.value + "px";
            document.documentElement.style.setProperty('--main-font-size', e.target.value + "px");
        };

        fontSizeSlider.onchange = (e) => {
            import('./storage.js').then(store => {
                if (!store.state.settings) store.state.settings = {};
                store.state.settings.fontSize = e.target.value;
                store.saveUserData(currentUser);
            });
        };

        document.getElementById('addMonthBtn').onclick = () => addNewMonth(currentUser);
        updateProgressBar();
        
    } else {
        if (currentUser) window.location.reload();
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        currentUser = null;
    }
});

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
