import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, deleteDoc, doc, db, deleteUser } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory, exportData, importData, importHistory, deleteImportBackup, applySnapshot, saveUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

// Função para atualizar textos globais (Metas, Títulos, Overview) no DOM
function refreshGlobalDOM(content, targetPrefix = "") {
    const data = content || window.pageContent || {};
    
    const defaults = {
        "global-cover-eye": "Personal Study Planner",
        "global-cover-title": "My Roadmap",
        "global-cover-sub": "Custom Duration · Daily Goals · Focused Learning",
        "global-goal-strong": "🎯 My Goal",
        "global-goal-text": "Reach B1 level — understand the main points of clear input on familiar topics, handle travel situations, produce connected text, and describe experiences, events, and plans with detail.",
        "global-sec-overview": "Phases Overview",
        "global-sec-template": "Daily Template",
    };

    const parent = targetPrefix ? document.getElementById('previewSandbox') : document;
    
    parent.querySelectorAll(".editable-global, .cover-eye, .cover-title, .cover-sub, .tpl-time, .tpl-act").forEach(el => {
        const cleanId = el.id.replace(targetPrefix, '');
        // PRIORIDADE ABSOLUTA: Se existir no 'data' (backup/banco), usa ele.
        if (data[cleanId] !== undefined && data[cleanId] !== null && data[cleanId] !== "") {
            el.innerHTML = data[cleanId];
        } else if (defaults[cleanId]) {
            el.innerHTML = defaults[cleanId];
        }
    });
}

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        const userData = await loadUserData(currentUser);

        // --- USERNAME ---
        if (!userData.state.customName && !userData.state.namePrompted) {
            const nameInput = prompt("How would you like to be called?");
            userData.state.customName = (nameInput && nameInput.trim() !== "") ? nameInput : user.email;
            userData.state.namePrompted = true;
            saveUserData(currentUser);
        }
        document.getElementById("topbarName").textContent = userData.state.customName || user.email;

        // --- ACCOUNT MANAGEMENT ---
        const accountModal = document.getElementById('accountManagementModal');
        document.getElementById('manageAccountBtn').onclick = () => {
            document.getElementById('settingsDrawer').classList.remove('open');
            accountModal.style.display = 'flex';
        };
        document.getElementById('closeAccountModal').onclick = () => accountModal.style.display = 'none';
        document.getElementById('deleteAccountBtn').onclick = async () => {
            if (confirm("Permanently delete account and all data?")) {
                const check = prompt("Type DELETE to confirm:");
                if (check === "DELETE") {
                    try {
                        await deleteDoc(doc(db, "users", currentUser));
                        await deleteUser(auth.currentUser);
                        window.location.reload();
                    } catch (e) { alert("Please login again to perform this action."); }
                }
            }
        };

        // --- RENDERIZAÇÃO INICIAL ---
        import('./planner.js').then(mod => {
            mod.renderDynamicOverviewBlocks(currentUser);
            mod.renderDailyTemplate(currentUser);
        });
        renderStructure(userData.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser));
        refreshGlobalDOM(userData.pageContent);
        
        // --- BOTÕES TOPBAR ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('saveChangesBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);
        document.getElementById('switchAccountBtn').onclick = () => {
            provider.setCustomParameters({ prompt: 'select_account' });
            signInWithPopup(auth, provider);
        };

        // --- FAB ---
        const fabWrapper = document.getElementById('fabWrapper');
        document.getElementById('fabMain').onclick = (e) => { e.stopPropagation(); fabWrapper.classList.toggle('open'); };
        document.addEventListener('click', (e) => { if (!fabWrapper.contains(e.target)) fabWrapper.classList.remove('open'); });

        // --- IMPORT / EXPORT ---
        const importInput = document.getElementById('importFileInput');
        document.getElementById('exportDataBtn').onclick = () => exportData();
        document.getElementById('importDataBtn').onclick = () => importInput.click();
        importInput.onchange = async (e) => {
            if (e.target.files.length > 0) {
                if (confirm("Import will overwrite all data. Continue?")) {
                    const success = await importData(e.target.files[0], currentUser);
                    if (success) window.location.reload();
                }
            }
        };

        // --- IMPORT HISTORY ---
        document.getElementById('importHistoryBtn').onclick = () => { renderImportHistory(); document.getElementById('importHistoryModal').style.display = 'flex'; };
        document.getElementById('closeHistoryModal').onclick = () => document.getElementById('importHistoryModal').style.display = 'none';

        function renderImportHistory() {
            const hList = document.getElementById('importHistoryList');
            hList.innerHTML = importHistory.length === 0 ? '<p>No backups.</p>' : '';
            importHistory.forEach(backup => {
                const card = document.createElement('div');
                card.className = 'import-backup-card';
                card.innerHTML = `<div><strong>${backup.filename}</strong><br>${new Date(backup.timestamp).toLocaleString()}</div><button class="btn-undo-import">Restore</button>`;
                card.querySelector('.btn-undo-import').onclick = async () => {
                    if (confirm("Restore this state?")) {
                        await importData(backup, currentUser, true);
                        window.location.reload();
                    }
                };
                hList.appendChild(card);
            });
        }

        // --- COLOR PICKER ---
        const cover = document.getElementById('page-cover');
        const iroPicker = new iro.ColorPicker("#iroPicker", { width: 180 });
        let colorHistory = userData.state.colorHistory || { solids: [], gradients: [], pinned: [] };
        
        document.getElementById('editCoverBtn').onclick = () => document.getElementById('colorChoiceMenu').style.display = 'flex';
        document.getElementById('choiceSolid').onclick = () => { 
            document.getElementById('colorChoiceMenu').style.display = 'none';
            document.getElementById('colorPickerContainer').classList.add('open');
            document.getElementById('pickerOverlay').classList.add('open');
        };
        document.getElementById('btnCancelPicker').onclick = () => {
            document.getElementById('colorPickerContainer').classList.remove('open');
            document.getElementById('pickerOverlay').classList.remove('open');
        };
        document.getElementById('btnApplyPicker').onclick = () => {
            const hex = iroPicker.color.hexString;
            cover.style.background = hex;
            if(!colorHistory.solids.includes(hex)) colorHistory.solids.unshift(hex);
            userData.state.settings.coverColor = hex;
            userData.state.colorHistory = colorHistory;
            saveUserData(currentUser);
            document.getElementById('colorPickerContainer').classList.remove('open');
            document.getElementById('pickerOverlay').classList.remove('open');
        };

        if(userData.state.settings?.coverColor) cover.style.background = userData.state.settings.coverColor;

        // --- DRAWERS ---
        const customDrawer = document.getElementById('customDrawer');
        const settingsDrawer = document.getElementById('settingsDrawer');
        document.getElementById('personalizeBtn').onclick = () => { settingsDrawer.classList.remove('open'); customDrawer.classList.add('open'); };
        document.getElementById('settingsBtn').onclick = () => { customDrawer.classList.remove('open'); settingsDrawer.classList.add('open'); renderHistory(); };
        document.getElementById('closeDrawer').onclick = () => customDrawer.classList.remove('open');
        document.getElementById('closeSettings').onclick = () => settingsDrawer.classList.remove('open');

        // Font settings
        const fonts = ["Arial", "Verdana", "Georgia", "Montserrat", "Roboto", "Pacifico"];
        const fontList = document.getElementById('fontList');
        fonts.forEach(f => {
            const d = document.createElement('div');
            d.className = 'font-item';
            d.textContent = f;
            d.style.fontFamily = f;
            d.onclick = () => {
                document.documentElement.style.setProperty('--main-font', f);
                userData.state.settings.font = f;
                saveUserData(currentUser);
            };
            fontList.appendChild(d);
        });

        const slider = document.getElementById('fontSizeSlider');
        slider.oninput = (e) => {
            document.getElementById('fontSizeVal').textContent = e.target.value + "px";
            document.documentElement.style.setProperty('--main-font-size', e.target.value + "px");
        };
        slider.onchange = (e) => { userData.state.settings.fontSize = e.target.value; saveUserData(currentUser); };

        function renderHistory() {
            const list = document.getElementById('historyList');
            list.innerHTML = userData.history?.length === 0 ? '<p>No history.</p>' : '';
            userData.history?.forEach(h => {
                const d = document.createElement('div');
                d.className = 'history-item';
                d.innerHTML = `<span>${new Date(h.timestamp).toLocaleString()}</span><strong>${h.label}</strong><button class="hist-res">Restore</button>`;
                d.querySelector('.hist-res').onclick = async () => {
                    applySnapshot(h.plannerConfig, h.pageContent);
                    await saveUserData(currentUser);
                    window.location.reload();
                };
                list.appendChild(d);
            });
        }

        document.getElementById('addMonthBtn').onclick = () => addNewMonth(currentUser);
        document.getElementById('clearHistoryBtn').onclick = async () => { if(confirm("Clear history?")) { await clearAllHistory(currentUser); renderHistory(); } };
        updateProgressBar();
        
    } else {
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
    }
});

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
