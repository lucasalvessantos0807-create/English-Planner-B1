import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory } from './storage.js';
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

        // --- LÓGICA DA CAPA (BANNER) ---
        const cover = document.getElementById('page-cover');
        const editCoverBtn = document.getElementById('editCoverBtn');
        
        editCoverBtn.onclick = () => {
            const mode = confirm("Clique em OK para COR SÓLIDA ou CANCELAR para GRADIENTE.");
            const picker = document.getElementById('colorPicker');
            
            if (mode) {
                picker.oninput = (e) => {
                    const color = e.target.value;
                    cover.style.background = color;
                    saveCover(color);
                };
                picker.click();
            } else {
                const color1 = prompt("Cor 1 (Ex: #c85a2a):", "#c85a2a");
                const color2 = prompt("Cor 2 (Ex: #f7f5f0):", "#f7f5f0");
                if(color1 && color2) {
                    const gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
                    cover.style.background = gradient;
                    saveCover(gradient);
                }
            }
        };

        function saveCover(style) {
            import('./storage.js').then(store => {
                if(!store.state.settings) store.state.settings = {};
                store.state.settings.coverColor = style;
                store.saveUserData(currentUser);
            });
        }

        if(userData.state.settings && userData.state.settings.coverColor) {
            cover.style.background = userData.state.settings.coverColor;
        }

        document.getElementById('addOverviewBlockBtn').onclick = () => {
            import('./planner.js').then(mod => mod.addOverviewBlock(currentUser));
        };
        
        // --- CONFIGURAÇÕES E HISTÓRICO ---
        document.getElementById('clearHistoryBtn').onclick = async () => {
            if(confirm("Permanently delete ALL history?")){
                await clearAllHistory(currentUser);
                renderHistory();
            }
        };

        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');

        personalizeBtn.onclick = () => { settingsDrawer.classList.remove('open'); customDrawer.classList.toggle('open'); };
        settingsBtn.onclick = () => { customDrawer.classList.remove('open'); settingsDrawer.classList.toggle('open'); renderHistory(); };
        closeDrawer.onclick = () => customDrawer.classList.remove('open');
        document.getElementById('closeSettings').onclick = () => settingsDrawer.classList.remove('open');

        // --- INICIALIZAÇÃO FINAL ---
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
