import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, deleteDoc, doc, db, deleteUser } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory, exportData, importData, importHistory, deleteImportBackup, applySnapshot, saveUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit, renderDynamicOverviewBlocks, renderDailyTemplate } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

function refreshGlobalDOM(content, targetPrefix = "") {
    const data = content || {};
    const defaults = {
        "global-cover-eye": "Personal Study Planner",
        "global-cover-title": "Your Roadmap",
        "global-cover-sub": "Custom Duration · Daily Goals · Your Focus",
        "global-goal-strong": "🎯 Your Goal",
        "global-goal-text": "Enter your main goal here — describe what you want to achieve.",
        "global-sec-overview": "Overview",
        "global-sec-template": "Daily Template",
    };

    const parent = targetPrefix ? document.getElementById('previewSandbox') : document;
    parent.querySelectorAll(".editable-global, .cover-eye, .cover-title, .cover-sub, .tpl-time, .tpl-act").forEach(el => {
        const cleanId = el.id.replace(targetPrefix, '');
        const val = data[cleanId];
        if (val !== undefined && val !== null && val !== "" && val !== "undefined") {
            el.innerHTML = val;
        } else if (defaults[cleanId]) {
            el.innerHTML = defaults[cleanId];
        }
    });

    // CORREÇÃO: Forçar renderização do backup/estado atual
    const user = auth.currentUser;
    if (user) {
        renderDynamicOverviewBlocks(user.uid, targetPrefix, data);
        renderDailyTemplate(user.uid, targetPrefix, data);
    }
}

let currentUser = null;
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        const userData = await loadUserData(currentUser);
        if (!userData.state.customName && !userData.state.namePrompted) {
            const nameInput = prompt("Your name?");
            userData.state.customName = (nameInput && nameInput.trim() !== "") ? nameInput : user.email;
            userData.state.namePrompted = true;
            saveUserData(currentUser);
        }
        document.getElementById("topbarName").textContent = userData.state.customName || user.email;
        document.getElementById('changeNameBtn').onclick = () => {
            const currentName = document.getElementById("topbarName").textContent;
            const newName = prompt("New name:", currentName);
            if (newName && newName.trim() !== "") { userData.state.customName = newName; document.getElementById("topbarName").textContent = newName; saveUserData(currentUser); }
        };
        const accountModal = document.getElementById('accountManagementModal');
        document.getElementById('manageAccountBtn').onclick = () => { document.getElementById('settingsDrawer').classList.remove('open'); accountModal.style.display = 'flex'; };
        document.getElementById('closeAccountModal').onclick = () => { accountModal.style.display = 'none'; };
        document.getElementById('deleteAccountBtn').onclick = async () => {
            if (confirm("DELETE ACCOUNT PERMANENTLY?")) {
                if (prompt("Type 'DELETE':") === "DELETE") {
                    try { await deleteDoc(doc(db, "users", currentUser)); await deleteUser(auth.currentUser); window.location.reload(); } catch (e) { alert(e.message); }
                }
            }
        };
        document.getElementById('langToggle').onclick = () => {
            const wrapper = document.getElementById('langWrapper');
            const arrow = document.getElementById('langArrow');
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };
        renderStructure(userData.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser));
        refreshGlobalDOM(userData.pageContent);
        
        const fabWrapper = document.getElementById('fabWrapper');
        document.getElementById('fabMain').onclick = (e) => { e.stopPropagation(); fabWrapper.classList.toggle('open'); };
        document.addEventListener('click', (e) => { if (fabWrapper.classList.contains('open') && !fabWrapper.contains(e.target)) fabWrapper.classList.remove('open'); });
        
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('saveChangesBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);
        document.getElementById('switchAccountBtn').onclick = () => { provider.setCustomParameters({ prompt: 'select_account' }); signInWithPopup(auth, provider); };

        const importInput = document.getElementById('importFileInput');
        document.getElementById('exportDataBtn').onclick = () => exportData();
        document.getElementById('importDataBtn').onclick = () => importInput.click();
        importInput.onchange = async (e) => {
            if (e.target.files.length > 0) {
                if (confirm("Import backup?")) {
                    await importData(e.target.files[0], currentUser);
                    window.location.reload();
                }
            }
        };
        document.getElementById('importHistoryBtn').onclick = () => { renderImportHistory(); document.getElementById('importHistoryModal').style.display = 'flex'; };
        document.getElementById('closeHistoryModal').onclick = () => { document.getElementById('importHistoryModal').style.display = 'none'; };

        function renderImportHistory() {
            const list = document.getElementById('importHistoryList');
            list.innerHTML = importHistory.length === 0 ? '<p>No backups.</p>' : '';
            importHistory.forEach(backup => {
                const card = document.createElement('div');
                card.className = 'import-backup-card';
                card.innerHTML = `<div class="backup-info"><span>${backup.filename}</span></div><div class="backup-actions"><button class="btn-undo-import">Restore</button><button class="btn-preview">Preview</button><button class="btn-delete-backup">✕</button></div>`;
                card.querySelector('.btn-undo-import').onclick = async () => { if (confirm("Restore?")) { await importData(backup, currentUser, true); window.location.reload(); } };
                card.querySelector('.btn-preview').onclick = () => {
                    const sb = document.getElementById('previewSandbox');
                    document.getElementById('sandboxTitle').textContent = `Preview: ${backup.filename}`;
                    refreshGlobalDOM(backup.pageContent, "sb-");
                    const sbCover = document.getElementById('sb-page-cover');
                    if (sbCover) sbCover.style.background = backup.state?.settings?.coverColor || "#f4f1ea";
                    updateProgressBar("sb-", backup.plannerConfig, backup.state);
                    renderStructure(backup.plannerConfig, false, (m, w, isPrev, prefix) => {
                        import('./planner.js').then(mod => mod.buildWeek(m, w, currentUser, [], true, prefix, backup.plannerConfig, backup.state));
                    }, true, "sb-");
                    document.getElementById('importHistoryModal').style.display = 'none';
                    sb.style.display = 'flex';
                    document.getElementById('restoreSandboxBtn').onclick = async () => { if(confirm("Restore?")) { await importData(backup, currentUser, true); window.location.reload(); } };
                };
                card.querySelector('.btn-delete-backup').onclick = async () => { if(confirm("Delete?")) { await deleteImportBackup(currentUser, backup.id); renderImportHistory(); } };
                list.appendChild(card);
            });
        }
        document.getElementById('closeSandboxBtn').onclick = () => { document.getElementById('previewSandbox').style.display = 'none'; document.getElementById('importHistoryModal').style.display = 'flex'; };

        const cover = document.getElementById('page-cover');
        const colorMenu = document.getElementById('colorChoiceMenu');
        document.getElementById('editCoverBtn').onclick = (e) => { e.stopPropagation(); colorMenu.style.display = colorMenu.style.display === 'flex' ? 'none' : 'flex'; };
        let colorHistory = userData.state.colorHistory || { solids: [], gradients: [], pinned: [] };
        const iroPicker = new iro.ColorPicker("#iroPicker", { width: 180, layout: [{ component: iro.ui.Wheel }, { component: iro.ui.Slider, options: { sliderType: 'value' } }] });
        let pickingGradient = false; let color1 = null;
        document.getElementById('choiceSolid').onclick = () => { pickingGradient = false; color1 = null; document.getElementById('pickerActionTitle').textContent = "Select Color"; colorMenu.style.display = 'none'; openPicker(); };
        document.getElementById('choiceGradient').onclick = () => { pickingGradient = true; color1 = null; document.getElementById('pickerActionTitle').textContent = "Select Color 1"; colorMenu.style.display = 'none'; openPicker(); };
        document.getElementById('choiceCancel').onclick = () => { colorMenu.style.display = 'none'; };
        function openPicker() { renderHistoryUI(); document.getElementById('colorPickerContainer').classList.add('open'); document.getElementById('pickerOverlay').classList.add('open'); }
        function closePicker() { document.getElementById('colorPickerContainer').classList.remove('open'); document.getElementById('pickerOverlay').classList.remove('open'); }
        document.getElementById('btnCancelPicker').onclick = closePicker;
        document.getElementById('btnApplyPicker').onclick = () => {
            const sel = iroPicker.color.hexString;
            if (!pickingGradient) { applySolid(sel); } else {
                if (color1 === null) { color1 = sel; document.getElementById('pickerActionTitle').textContent = "Select Color 2"; cover.style.background = color1; } else { applyGradient(color1, sel); }
            }
        };
        function applySolid(c) {
            cover.style.background = c;
            if (!colorHistory.solids.includes(c)) { colorHistory.solids.unshift(c); if (colorHistory.solids.length > 3) colorHistory.solids.pop(); }
            saveAllColorData(c); closePicker();
        }
        function applyGradient(c1, c2) {
            const g = `linear-gradient(135deg, ${c1}, ${c2})`; cover.style.background = g;
            if (!colorHistory.gradients.some(x => x.c1 === c1 && x.c2 === c2)) { colorHistory.gradients.unshift({c1, c2}); if (colorHistory.gradients.length > 3) colorHistory.gradients.pop(); }
            saveAllColorData(g); closePicker();
        }
        function saveAllColorData(v) { if(!userData.state.settings) userData.state.settings = {}; userData.state.settings.coverColor = v; userData.state.colorHistory = colorHistory; saveUserData(currentUser); }
        function renderHistoryUI() {
            const sc = document.getElementById('historySolids'); const gc = document.getElementById('historyGradients'); const pc = document.getElementById('pinnedGradients');
            sc.innerHTML = ''; colorHistory.solids.forEach(c => { const d = document.createElement('div'); d.style.cssText = `width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;border:1.5px solid #eee;`; d.onclick = () => applySolid(c); sc.appendChild(d); });
            gc.innerHTML = ''; colorHistory.gradients.forEach(g => { const r = document.createElement('div'); r.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:4px;"; r.innerHTML = `<div style="flex:1;height:18px;border-radius:4px;background:linear-gradient(90deg, ${g.c1}, ${g.c2});cursor:pointer;border:1px solid #ddd;"></div><span style="cursor:pointer;font-size:12px;">📌</span>`; r.querySelector('div').onclick = () => applyGradient(g.c1, g.c2); r.querySelector('span').onclick = () => { if(colorHistory.pinned.length < 2) { colorHistory.pinned.push(g); saveAllColorData(cover.style.background); renderHistoryUI(); } }; gc.appendChild(r); });
            pc.innerHTML = ''; colorHistory.pinned.forEach((g, i) => { const r = document.createElement('div'); r.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:4px;"; r.innerHTML = `<div style="flex:1;height:18px;border-radius:4px;background:linear-gradient(90deg, ${g.c1}, ${g.c2});cursor:pointer;border:1px solid var(--accent);"></div><span style="cursor:pointer;font-size:12px;color:#cc0000;">✕</span>`; r.querySelector('div').onclick = () => applyGradient(g.c1, g.c2); r.querySelector('span').onclick = () => { colorHistory.pinned.splice(i, 1); saveAllColorData(cover.style.background); renderHistoryUI(); }; pc.appendChild(r); });
        }
        if(userData.state.settings?.coverColor) cover.style.background = userData.state.settings.coverColor;

        const customDrawer = document.getElementById('customDrawer');
        document.getElementById('personalizeBtn').onclick = () => { customDrawer.classList.add('open'); fabWrapper.classList.add('fab-hidden'); };
        document.getElementById('closeDrawer').onclick = () => { customDrawer.classList.remove('open'); fabWrapper.classList.remove('fab-hidden'); };
        document.getElementById('settingsBtn').onclick = () => { document.getElementById('settingsDrawer').classList.add('open'); fabWrapper.classList.add('fab-hidden'); renderHistory(); };
        document.getElementById('closeSettings').onclick = () => { document.getElementById('settingsDrawer').classList.remove('open'); fabWrapper.classList.remove('fab-hidden'); };

        const googleFonts = ["Arial", "Verdana", "Georgia", "Bebas Neue", "Montserrat", "Open Sans", "Roboto", "Jost", "Playfair Display", "Dancing Script", "Pacifico"];
        const fontList = document.getElementById('fontList');
        function renderFonts(filter = "") {
            fontList.innerHTML = "";
            googleFonts.filter(f => f.toLowerCase().includes(filter.toLowerCase())).forEach(font => {
                const d = document.createElement('div'); d.className = 'font-item'; d.textContent = font;
                if (!["Arial", "Verdana", "Georgia"].includes(font)) { const l = document.createElement('link'); l.rel='stylesheet'; l.href=`https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap`; document.head.appendChild(l); }
                d.style.fontFamily = `"${font}", sans-serif`;
                d.onclick = () => { document.documentElement.style.setProperty('--main-font', `"${font}", sans-serif`); if (!userData.state.settings) userData.state.settings = {}; userData.state.settings.font = font; saveUserData(currentUser); };
                fontList.appendChild(d);
            });
        }
        document.getElementById('fontSearchInput').oninput = (e) => renderFonts(e.target.value);
        renderFonts();

        const fSlider = document.getElementById('fontSizeSlider');
        if (userData.state.settings?.font) { document.documentElement.style.setProperty('--main-font', `"${userData.state.settings.font}", sans-serif`); }
        fSlider.value = userData.state.settings?.fontSize || "15";
        document.getElementById('fontSizeVal').textContent = fSlider.value + "px";
        document.documentElement.style.setProperty('--main-font-size', fSlider.value + "px");
        fSlider.oninput = (e) => { document.getElementById('fontSizeVal').textContent = e.target.value + "px"; document.documentElement.style.setProperty('--main-font-size', e.target.value + "px"); };
        fSlider.onchange = (e) => { if (!userData.state.settings) userData.state.settings = {}; userData.state.settings.fontSize = e.target.value; saveUserData(currentUser); };

        function renderHistory() {
            const c = document.getElementById('historyList');
            c.innerHTML = history.length === 0 ? '<p>No history.</p>' : '';
            history.forEach(item => {
                const d = document.createElement('div'); d.className = 'history-item';
                d.innerHTML = `<span class="history-date">${new Date(item.timestamp).toLocaleString()}</span><strong>${item.label}</strong><div style="display:flex;gap:5px;margin-top:5px;"><button class="history-restore" style="flex:1;">Restore</button><button class="history-del">✕</button></div>`;
                d.querySelector('.history-restore').onclick = async () => { if(confirm("Restore?")) { applySnapshot(item.plannerConfig, item.pageContent); await saveUserData(currentUser); window.location.reload(); } };
                d.querySelector('.history-del').onclick = async () => { if(confirm("Delete?")) { await deleteHistoryEntry(currentUser, item.id); renderHistory(); } };
                c.appendChild(d);
            });
        }
        updateProgressBar();
    } else { document.getElementById("planner").style.display = "none"; document.getElementById("login-screen").style.display = "flex"; currentUser = null; }
});
document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
