import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData, saveUserData } from './storage.js';
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
        
        // --- BOTÕES TOPBAR ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);

        // --- LÓGICA DA CAPA (SÓLIDO OU GRADIENTE) ---
        const cover = document.getElementById('page-cover');
        const editCoverBtn = document.getElementById('editCoverBtn');
        const colorPicker = document.getElementById('colorPicker');
        
        editCoverBtn.onclick = () => {
            const mode = confirm("Clique em OK para abrir o SELETOR (Sólido) ou CANCELAR para criar GRADIENTE.");
            if (mode) {
                colorPicker.oninput = (e) => {
                    const color = e.target.value;
                    cover.style.background = color;
                    saveSetting('coverColor', color);
                };
                colorPicker.click();
            } else {
                const c1 = prompt("Cor Inicial (Hex):", "#c85a2a");
                const c2 = prompt("Cor Final (Hex):", "#f7f5f0");
                if(c1 && c2) {
                    const grad = `linear-gradient(135deg, ${c1}, ${c2})`;
                    cover.style.background = grad;
                    saveSetting('coverColor', grad);
                }
            }
        };

        function saveSetting(key, value) {
            import('./storage.js').then(store => {
                if(!store.state.settings) store.state.settings = {};
                store.state.settings[key] = value;
                store.saveUserData(currentUser);
            });
        }

        if(userData.state.settings && userData.state.settings.coverColor) {
            cover.style.background = userData.state.settings.coverColor;
        }

        // --- OVERVIEW DINÂMICO ---
        document.getElementById('addOverviewBlockBtn').onclick = () => {
            import('./planner.js').then(mod => mod.addOverviewBlock(currentUser));
        };

        // --- DRAWERS ---
        const personalizeBtn = document.getElementById('personalizeBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const customDrawer = document.getElementById('customDrawer');
        const settingsDrawer = document.getElementById('settingsDrawer');

        personalizeBtn.onclick = () => { settingsDrawer.classList.remove('open'); customDrawer.classList.toggle('open'); };
        settingsBtn.onclick = () => { customDrawer.classList.remove('open'); settingsDrawer.classList.toggle('open'); };
        document.getElementById('closeDrawer').onclick = () => customDrawer.classList.remove('open');
        document.getElementById('closeSettings').onclick = () => settingsDrawer.classList.remove('open');

        document.getElementById('addMonthBtn').onclick = () => addNewMonth(currentUser);
        updateProgressBar();
    } else {
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        currentUser = null;
    }
});

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
