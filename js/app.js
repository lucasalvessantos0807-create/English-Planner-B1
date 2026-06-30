import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory, exportData, importData, importHistory, deleteImportBackup, applySnapshot } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

// Função para atualizar textos globais (Metas, Títulos, Overview) no DOM
function refreshGlobalDOM(content) {
    const data = content || {};
    document.querySelectorAll('.editable-global').forEach(el => {
        if (data[el.id] !== undefined) {
            el.innerHTML = data[el.id];
        }
    });
}

// ── FUNÇÃO DO SANDBOX DE PREVIEW ──
function renderPreviewToSandbox(backup) {
    const data = backup.pageContent || {};
    const config = backup.plannerConfig || {};
    const state = backup.state || {};
    
    // 1. Capa e Cabeçalho
    document.getElementById('pv-page-cover').style.background = state.settings?.coverColor || "#f4f1ea";
    document.getElementById('pv-global-cover-eye').textContent = data['global-cover-eye'] || "Personal English Study Planner";
    document.getElementById('pv-global-cover-title').textContent = data['global-cover-title'] || "A2+ to B1 Roadmap";
    document.getElementById('pv-global-cover-sub').textContent = data['global-cover-sub'] || "3 months · Every day · 1.5–2+ hours";
    
    // 2. Metas
    document.getElementById('pv-global-goal-strong').textContent = data['global-goal-strong'] || "🎯 Your Goal";
    document.getElementById('pv-global-goal-text').textContent = data['global-goal-text'] || "Reach B1 level...";

    // 3. Template
    for(let i=1; i<=7; i++) {
        document.getElementById(`pv-tpl-t${i}`).textContent = data[`tpl-t${i}`] || "";
        document.getElementById(`pv-tpl-a${i}`).innerHTML = data[`tpl-a${i}`] || "";
    }

    // 4. Progresso
    let total = 0; Object.values(config).forEach(w => total += w.days.length);
    let done = 0; Object.keys(state).forEach(k => { if(state[k] && state[k].done) done++; });
    const pct = total > 0 ? Math.round((done/total)*100) : 0;
    document.getElementById('pv-pbar').style.width = pct + "%";
    document.getElementById('pv-prog-text').textContent = `${done} / ${total} days (${pct}% complete)`;

    // 5. Overview Grid
    const ovGrid = document.getElementById('pv-dynamic-ov-grid');
    ovGrid.innerHTML = '';
    ['ca','cb','cg'].forEach(type => {
        const card = document.createElement('div');
        card.className = `ov-card ${type}`;
        card.innerHTML = `<div class="ov-label">${data[`global-ov-${type}-label`] || ""}</div><div class="ov-body">${data[`global-ov-${type}-body`] || ""}</div>`;
        ovGrid.appendChild(card);
    });

    // 6. Roadmap (Meses e Semanas)
    const mNav = document.getElementById('pv-monthNav');
    const mPanels = document.getElementById('pv-monthPanels');
    mNav.innerHTML = ''; mPanels.innerHTML = '';

    const months = [...new Set(Object.keys(config).map(k => k.split('-')[0]))].sort((a,b)=>Number(a)-Number(b));
    months.forEach((m, idx) => {
        const btn = document.createElement('button');
        btn.className = `mbtn ${idx===0?'on':''}`;
        btn.textContent = `Month ${m}`;
        const panel = document.createElement('div');
        panel.className = `mpanel ${idx===0?'on':''}`;
        
        const weeks = Object.keys(config).filter(k => k.startsWith(m+'-')).sort();
        weeks.forEach(wkKey => {
            const wk = config[wkKey];
            const wkDiv = document.createElement('div');
            wkDiv.className = "wkbar";
            wkDiv.innerHTML = `<h3>${wk.label}</h3><p>${wk.theme}</p>`;
            panel.appendChild(wkDiv);
        });

        btn.onclick = () => {
            mNav.querySelectorAll('.mbtn').forEach(b => b.classList.remove('on'));
            mPanels.querySelectorAll('.mpanel').forEach(p => p.classList.remove('on'));
            btn.classList.add('on'); panel.classList.add('on');
        };
        mNav.appendChild(btn); mPanels.appendChild(panel);
    });
}

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        const userData = await loadUserData(currentUser);

        // --- LÓGICA DE USERNAME ---
        if (!userData.state.customName && !userData.state.namePrompted) {
            const nameInput = prompt("How would you like to be called?");
            userData.state.customName = (nameInput && nameInput.trim() !== "") ? nameInput : user.email;
            userData.state.namePrompted = true;
            import('./storage.js').then(store => store.saveUserData(currentUser));
        }
        document.getElementById("topbarName").textContent = userData.state.customName || user.email;

        document.getElementById('changeNameBtn').onclick = () => {
            const currentName = document.getElementById("topbarName").textContent;
            const newName = prompt("Enter your new display name:", currentName);
            if (newName && newName.trim() !== "") {
                userData.state.customName = newName;
                document.getElementById("topbarName").textContent = newName;
                import('./storage.js').then(store => store.saveUserData(currentUser));
            }
        };

        // --- ACORDION DE IDIOMA ---
        document.getElementById('langToggle').onclick = () => {
            const wrapper = document.getElementById('langWrapper');
            const arrow = document.getElementById('langArrow');
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        document.querySelectorAll('.lang-opt').forEach(btn => {
            btn.onclick = () => { console.log("Language selected:", btn.textContent); };
        });

        // --- RENDERIZAÇÃO INICIAL ---
        import('./planner.js').then(mod => mod.renderDynamicOverviewBlocks(currentUser));
        renderStructure(userData.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser));
        refreshGlobalDOM(userData.pageContent);
        
        // --- BOTÕES DA TOPBAR ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);

        // --- EXPORT / IMPORT SYSTEM ---
        const cover = document.getElementById('page-cover');
        const importInput = document.getElementById('importFileInput');
        
        document.getElementById('exportDataBtn').onclick = () => exportData();
        document.getElementById('importDataBtn').onclick = () => importInput.click();

        importInput.onchange = async (e) => {
            if (e.target.files.length > 0) {
                if (confirm("Importing will overwrite your current planner. A backup will be saved. Continue?")) {
                    try {
                        await importData(e.target.files[0], currentUser);
                        alert("Data imported successfully!");
                        window.location.reload();
                    } catch (err) { 
                        alert("Import failed: " + err.message); 
                    }
                }
            }
        };

        // --- HISTÓRICO DE IMPORTAÇÕES (PREVIEW / UNDO) ---
        const historyModal = document.getElementById('importHistoryModal');
        const historyList = document.getElementById('importHistoryList');
        const previewBar = document.getElementById('previewBar');
        let sessionSnapshot = null;

        document.getElementById('importHistoryBtn').onclick = () => {
            renderImportHistory();
            historyModal.style.display = 'flex';
        };

        document.getElementById('closeHistoryModal').onclick = () => {
            historyModal.style.display = 'none';
        };

        function renderImportHistory() {
            historyList.innerHTML = importHistory.length === 0 ? 
                '<p style="text-align:center; padding:20px; color:var(--muted); font-size:0.8rem;">No backups found.</p>' : '';
            
            importHistory.forEach(backup => {
                const card = document.createElement('div');
                card.className = 'import-backup-card';
                card.innerHTML = `
                    <div class="backup-info">
                        <span class="backup-date">Backup: ${backup.filename}</span>
                        <span class="backup-meta">${new Date(backup.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="backup-actions">
                        <button class="btn-undo-import">Undo</button>
                        <button class="btn-preview">Preview</button>
                        <button class="btn-delete-backup">✕</button>
                    </div>
                `;
                
                card.querySelector('.btn-undo-import').onclick = async () => {
                    if (confirm("Undo and return to this exact state?")) {
                        applySnapshot(backup.plannerConfig, backup.pageContent);
                        import('./storage.js').then(s => s.saveUserData(currentUser).then(() => window.location.reload()));
                    }
                };

                card.querySelector('.btn-preview').onclick = () => {
                    document.body.classList.add('preview-mode');
                    renderPreviewToSandbox(backup); // CHAMA O SANDBOX
                    historyModal.style.display = 'none';
                    previewBar.style.display = 'block';
                    window.scrollTo(0, 0);
                };

                card.querySelector('.btn-delete-backup').onclick = async () => {
                    if(confirm("Delete backup?")) {
                        await deleteImportBackup(currentUser, backup.id);
                        renderImportHistory();
                    }
                };
                historyList.appendChild(card);
            });
        }

        document.getElementById('exitPreviewBtn').onclick = () => {
            document.body.classList.remove('preview-mode');
            previewBar.style.display = 'none';
        };

        document.getElementById('restorePreviewBtn').onclick = async () => {
            if (confirm("Restore this version to your account?")) {
                alert("Use the 'Undo' button in history list to restore fully.");
            }
        };
        
        // --- LÓGICA DO COLOR PICKER (IRO.JS) ---
        const editCoverBtn = document.getElementById('editCoverBtn');
        const menu = document.getElementById('colorChoiceMenu');
        let colorHistory = userData.state.colorHistory || { solids: [], gradients: [], pinned: [] };
        
        const iroPicker = new iro.ColorPicker("#iroPicker", {
            width: 180,
            layout: [{ component: iro.ui.Wheel }, { component: iro.ui.Slider, options: { sliderType: 'value' } }]
        });

        let pickingGradient = false;
        let color1 = null;

        editCoverBtn.onclick = (e) => {
            e.stopPropagation();
            menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
        };

        document.getElementById('choiceSolid').onclick = () => {
            pickingGradient = false; 
            color1 = null;
            document.getElementById('pickerActionTitle').textContent = "Select Color";
            menu.style.display = 'none'; 
            openPicker();
        };

        document.getElementById('choiceGradient').onclick = () => {
            pickingGradient = true; 
            color1 = null;
            document.getElementById('pickerActionTitle').textContent = "Select Color 1";
            menu.style.display = 'none'; 
            openPicker();
        };

        document.getElementById('choiceCancel').onclick = () => {
            menu.style.display = 'none';
        };
        
        document.addEventListener('click', (e) => {
            if (menu && !menu.contains(e.target) && e.target !== editCoverBtn) menu.style.display = 'none';
            if (!e.target.closest('.aico-wrapper')) {
                document.querySelectorAll('.aico-wrapper.show-suggestions').forEach(w => w.classList.remove('show-suggestions'));
            }
        });

        function openPicker() {
            renderHistoryUI();
            document.getElementById('colorPickerContainer').classList.add('open');
            document.getElementById('pickerOverlay').classList.add('open');
        }

        function closePicker() {
            document.getElementById('colorPickerContainer').classList.remove('open');
            document.getElementById('pickerOverlay').classList.remove('open');
        }

        document.getElementById('btnCancelPicker').onclick = closePicker;

        document.getElementById('btnApplyPicker').onclick = () => {
            const selectedColor = iroPicker.color.hexString;
            if (!pickingGradient) {
                applySolid(selectedColor);
            } else {
                if (color1 === null) {
                    color1 = selectedColor;
                    document.getElementById('pickerActionTitle').textContent = "Select Color 2";
                    cover.style.background = color1;
                } else {
                    applyGradient(color1, selectedColor);
                }
            }
        };

        function applySolid(color) {
            cover.style.background = color;
            if (!colorHistory.solids.includes(color)) {
                colorHistory.solids.unshift(color);
                if (colorHistory.solids.length > 3) colorHistory.solids.pop();
            }
            saveAllColorData(color);
            closePicker();
        }

        function applyGradient(c1, c2) {
            const grad = `linear-gradient(135deg, ${c1}, ${c2})`;
            cover.style.background = grad;
            const exists = colorHistory.gradients.some(g => g.c1 === c1 && g.c2 === c2);
            if (!exists) {
                colorHistory.gradients.unshift({ c1, c2 });
                if (colorHistory.gradients.length > 3) colorHistory.gradients.pop();
            }
            saveAllColorData(grad);
            closePicker();
        }

        function saveAllColorData(lastValue) {
            import('./storage.js').then(store => {
                if(!store.state.settings) store.state.settings = {};
                store.state.settings.coverColor = lastValue;
                store.state.colorHistory = colorHistory;
                store.saveUserData(currentUser);
            });
        }

        function renderHistoryUI() {
            const solidContainer = document.getElementById('historySolids');
            const gradContainer = document.getElementById('historyGradients');
            const pinnedContainer = document.getElementById('pinnedGradients');
            solidContainer.innerHTML = '';
            colorHistory.solids.forEach(color => {
                const div = document.createElement('div');
                div.style.cssText = `width:22px; height:22px; border-radius:50%; background:${color}; cursor:pointer; border:1.5px solid #eee;`;
                div.onclick = () => applySolid(color);
                solidContainer.appendChild(div);
            });
            gradContainer.innerHTML = '';
            colorHistory.gradients.forEach((g) => {
                const row = document.createElement('div');
                row.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:4px;";
                row.innerHTML = `<div style="flex:1; height:18px; border-radius:4px; background:linear-gradient(90deg, ${g.c1}, ${g.c2}); cursor:pointer; border:1px solid #ddd;"></div><span title="Pin" style="cursor:pointer; font-size:12px;">📌</span>`;
                row.querySelector('div').onclick = () => applyGradient(g.c1, g.c2);
                row.querySelector('span').onclick = () => pinGradient(g);
                gradContainer.appendChild(row);
            });
            pinnedContainer.innerHTML = '';
            colorHistory.pinned.forEach((g, idx) => {
                const row = document.createElement('div');
                row.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:4px;";
                row.innerHTML = `<div style="flex:1; height:18px; border-radius:4px; background:linear-gradient(90deg, ${g.c1}, ${g.c2}); cursor:pointer; border:1px solid var(--accent);"></div><span title="Unpin" style="cursor:pointer; font-size:12px; color:#cc0000;">✕</span>`;
                row.querySelector('div').onclick = () => applyGradient(g.c1, g.c2);
                row.querySelector('span').onclick = () => {
                    colorHistory.pinned.splice(idx, 1);
                    saveAllColorData(cover.style.background);
                    renderHistoryUI();
                };
                pinnedContainer.appendChild(row);
            });
        }

        function pinGradient(g) {
            if (!colorHistory.pinned.some(p => p.c1 === g.c1 && p.c2 === g.c2) && colorHistory.pinned.length < 2) {
                colorHistory.pinned.push(g);
                saveAllColorData(cover.style.background);
                renderHistoryUI();
            }
        }

        if(userData.state.settings && userData.state.settings.coverColor) {
            cover.style.background = userData.state.settings.coverColor;
        }

        // --- GAVETAS E PERSONALIZAÇÃO ---
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');
        const closeSettings = document.getElementById('closeSettings');

        personalizeBtn.onclick = () => {
            if (!document.body.classList.contains('preview-mode')) {
                settingsDrawer.classList.remove('open');
                customDrawer.classList.add('open');
            }
        };

        settingsBtn.onclick = () => {
            if (!document.body.classList.contains('preview-mode')) {
                customDrawer.classList.remove('open');
                settingsDrawer.classList.add('open');
                renderHistory();
            }
        };

        closeDrawer.onclick = () => customDrawer.classList.remove('open');
        closeSettings.onclick = () => settingsDrawer.classList.remove('open');

        const googleFonts = ["Arial", "Verdana", "Georgia", "Bebas Neue", "Montserrat", "Open Sans", "Roboto", "Jost", "Playfair Display", "Dancing Script", "Pacifico"];
        const fontListContainer = document.getElementById('fontList');
        const fontSearchInput = document.getElementById('fontSearchInput');

        function loadGoogleFont(fontName) {
            if (["Arial", "Verdana", "Georgia"].includes(fontName)) return;
            const id = `font-${fontName.replace(/\s+/g, '-')}`;
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id; 
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
                document.head.appendChild(link);
            }
        }

        function renderFonts(filter = "") {
            fontListContainer.innerHTML = "";
            googleFonts.filter(f => f.toLowerCase().includes(filter.toLowerCase())).forEach(font => {
                const div = document.createElement('div');
                div.className = 'font-item';
                div.textContent = font;
                loadGoogleFont(font);
                div.style.fontFamily = `"${font}", sans-serif`;
                div.onclick = () => {
                    document.documentElement.style.setProperty('--main-font', `"${font}", sans-serif`);
                    import('./storage.js').then(store => {
                        if (!store.state.settings) store.state.settings = {};
                        store.state.settings.font = font;
                        store.saveUserData(currentUser);
                    });
                };
                fontListContainer.appendChild(div);
            });
        }
        fontSearchInput.oninput = (e) => renderFonts(e.target.value);
        renderFonts();

        const fontSizeSlider = document.getElementById('fontSizeSlider');
        if (userData.state.settings?.font) {
            loadGoogleFont(userData.state.settings.font);
            document.documentElement.style.setProperty('--main-font', `"${userData.state.settings.font}", sans-serif`);
        }
        fontSizeSlider.value = userData.state.settings?.fontSize || "15";
        document.getElementById('fontSizeVal').textContent = fontSizeSlider.value + "px";
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

        document.getElementById('fontStyleToggle').onclick = () => {
            const wrapper = document.getElementById('fontPickerWrapper');
            const arrow = document.getElementById('fontArrow');
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        // --- FINALIZAÇÃO E HISTÓRICO COMUM ---
        function renderHistory() {
            const container = document.getElementById('historyList');
            import('./storage.js').then(store => {
                container.innerHTML = store.history.length === 0 ? '<p style="font-size:0.7rem; color:var(--muted); padding:10px;">No history.</p>' : '';
                store.history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <span class="history-date">${new Date(item.timestamp).toLocaleString()}</span>
                        <strong style="font-size:0.8rem">${item.label}</strong>
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <button class="history-restore" style="flex:1; cursor:pointer;">Restore</button>
                            <button class="history-del">✕</button>
                        </div>`;
                    div.querySelector('.history-restore').onclick = async () => { if(confirm("Restore?")) { store.applySnapshot(item.plannerConfig, item.pageContent); await store.saveUserData(currentUser); window.location.reload(); } };
                    div.querySelector('.history-del').onclick = async () => { if(confirm("Delete?")) { await deleteHistoryEntry(currentUser, item.id); renderHistory(); } };
                    container.appendChild(div);
                });
            });
        }

        document.getElementById('addMonthBtn').onclick = () => addNewMonth(currentUser);
        document.getElementById('addOverviewBlockBtn').onclick = () => import('./planner.js').then(mod => mod.addOverviewBlock(currentUser));
        document.getElementById('clearHistoryBtn').onclick = async () => {
            if(confirm("Permanently delete ALL history?")) {
                await clearAllHistory(currentUser);
                renderHistory();
            }
        };

        updateProgressBar();
        
    } else {
        if (currentUser) window.location.reload();
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        currentUser = null;
    }
});

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
