import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory, exportData, importData, importHistory, deleteImportBackup, applySnapshot } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

// Função para atualizar textos globais (Metas, Títulos, Overview) no DOM
function refreshGlobalDOM(content) {
    const data = content || {};
    
    // Default contents for Daily Template if not present in backup
    const defaults = {
        "tpl-t1": "0–15 min", 
        "tpl-a1": "📚 <strong>Vocabulary</strong> — Review yesterday's words. Add 5 new ones from today's reading.",
        "tpl-t2": "15–35 min", 
        "tpl-a2": "📖 <strong>Reading</strong> — Read 4–7 pages. Circle unknown words, keep your flow, look up after.",
        "tpl-t3": "35–55 min", 
        "tpl-a3": "🎙️ <strong>Shadowing</strong> — Listen once → shadow line by line → full shadow without pausing.",
        "tpl-t4": "55–75 min", 
        "tpl-a4": "🎧 <strong>Listening</strong> — Short clip. Tuesday & Friday: dictation exercise.",
        "tpl-t5": "75–95 min", 
        "tpl-a5": "📐 <strong>Grammar</strong> (Mon/Wed/Fri) or ✍️ <strong>Writing</strong> (Tue/Thu/Sat)",
        "tpl-t6": "95–115 min", 
        "tpl-a6": "🗣️ <strong>Speaking</strong> — Same topic as writing. Record yourself once a week.",
        "tpl-t7": "Sunday", 
        "tpl-a7": "🔁 <strong>Review Day</strong> — Grammar review · vocabulary test · listen back · set goals."
    };

    document.querySelectorAll(".editable-global").forEach(el => {
        const backupValue = data[el.id];
        const defaultValue = defaults[el.id];

        if (backupValue !== undefined && backupValue !== null && backupValue !== "") {
            // Use value from backup
            el.innerHTML = backupValue;
        } else if (defaultValue) {
            // Use default system value if backup is empty
            el.innerHTML = defaultValue;
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
                    const coverEl = document.getElementById('page-cover');
                    
                    // Save current session to allow exit
                    sessionSnapshot = { 
                        config: JSON.parse(JSON.stringify(window.plannerConfig)), 
                        content: JSON.parse(JSON.stringify(window.pageContent)),
                        state: JSON.parse(JSON.stringify(window.appState || {})),
                        cover: coverEl ? coverEl.style.background : "#f4f1ea"
                    };
                    
                    document.body.classList.add('preview-mode');
                    
                    // 1. Load data from backup file
                    applySnapshot(backup.plannerConfig, backup.pageContent);
                    window.appState = JSON.parse(JSON.stringify(backup.state || {}));
                    
                    // 2. Update Header/Cover Color
                    if (coverEl) {
                        coverEl.style.background = backup.state?.settings?.coverColor || "#f4f1ea";
                    }

                    // 3. Force update on all texts (Template, Goals, etc)
                    refreshGlobalDOM(backup.pageContent);
                    
                    // 4. Rebuild structure for Preview
                    renderStructure(window.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser, [], true), true);
                    
                    // 5. Update Overview blocks and Progress Bar
                    import('./planner.js').then(mod => mod.renderDynamicOverviewBlocks(currentUser));
                    import('./ui.js').then(mod => mod.updateProgressBar());
                    
                    historyModal.style.display = 'none';
                    previewBar.style.display = 'block';
                    window.scrollTo(0, 0);
                };
                    // Refresh progress bar based on backup 'state'
                    import('./ui.js').then(mod => {
                        window.appState = backup.state || {};
                        mod.updateProgressBar();
                    });
                    
                    historyModal.style.display = 'none';
                    previewBar.style.display = 'block';
                    window.scrollTo(0, 0);

                    document.getElementById('restorePreviewBtn').onclick = async () => {
                        if (confirm("Restore this version?")) {
                            document.body.classList.remove('preview-mode');
                            await importData(backup, currentUser); 
                            window.location.reload();
                        }
                    };
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
            previewBar.style.display = 'none';
            document.body.classList.remove('preview-mode');
            
            // Restaura tudo para o que era antes do preview
            applySnapshot(sessionSnapshot.config, sessionSnapshot.content);
            window.appState = sessionSnapshot.state;
            document.getElementById('page-cover').style.background = sessionSnapshot.cover;
            
            refreshGlobalDOM(sessionSnapshot.content);
            renderStructure(window.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser));
            import('./planner.js').then(mod => mod.renderDynamicOverviewBlocks(currentUser));
            import('./ui.js').then(mod => mod.updateProgressBar());
        };
        
        // --- LÓGICA DO COLOR PICKER (COMPLETA) ---
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
