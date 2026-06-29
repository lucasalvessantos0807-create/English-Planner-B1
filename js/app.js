import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        const userData = await loadUserData(currentUser);

        // --- LÓGICA DE NOME DE USUÁRIO (STUDYING AS...) ---
        if (!userData.state.customName && !userData.state.namePrompted) {
            const nameInput = prompt("Como você gostaria de ser chamado?");
            userData.state.customName = (nameInput && nameInput.trim() !== "") ? nameInput : user.email;
            userData.state.namePrompted = true;
            import('./storage.js').then(store => store.saveUserData(currentUser));
        }
        document.getElementById("topbarName").textContent = userData.state.customName || user.email;

        document.getElementById('changeNameBtn').onclick = () => {
            const currentDisplayName = document.getElementById("topbarName").textContent;
            const newName = prompt("Digite o novo nome de exibição:", currentDisplayName);
            if (newName && newName.trim() !== "") {
                userData.state.customName = newName;
                document.getElementById("topbarName").textContent = newName;
                import('./storage.js').then(store => store.saveUserData(currentUser));
            }
        };

        import('./planner.js').then(mod => mod.renderDynamicOverviewBlocks(currentUser));
        renderStructure(userData.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser));
        
        // --- BOTÕES DA TOPBAR ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);
        
        const cover = document.getElementById('page-cover');
        const editCoverBtn = document.getElementById('editCoverBtn');
        const menu = document.getElementById('colorChoiceMenu');
        
        // --- LÓGICA DE CORES PERSONALIZADA ---
        let colorHistory = userData.state.colorHistory || {
            solids: [],
            gradients: [],
            pinned: []
        };

        const iroPicker = new iro.ColorPicker("#iroPicker", {
            width: 180,
            layout: [
                { component: iro.ui.Wheel },
                { component: iro.ui.Slider, options: { sliderType: 'value' } },
            ]
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
            document.getElementById('pickerActionTitle').textContent = "Select Cover Color";
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

        document.getElementById('choiceCancel').onclick = () => { menu.style.display = 'none'; };
        
        // FECHAR MENUS AO CLICAR FORA
        document.addEventListener('click', (e) => {
            if (menu && !menu.contains(e.target) && e.target !== editCoverBtn) {
                menu.style.display = 'none';
            }
            // Fecha seletor de ícones de atividade ao clicar fora
            if (!e.target.closest('.aico-wrapper')) {
                document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions'));
            }
        });

        // FECHAR MENUS AO ROLAR A PÁGINA
        window.addEventListener('scroll', () => {
            if (menu) menu.style.display = 'none';
            // Fecha seletor de ícones de atividade ao rolar
            document.querySelectorAll('.aico-wrapper').forEach(w => w.classList.remove('show-suggestions'));
        }, { passive: true });

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
        document.getElementById('pickerOverlay').onclick = closePicker;

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
                div.style = "width:22px; height:22px; border-radius:50%; background:" + color + "; cursor:pointer; border:1.5px solid #eee; box-shadow:0 1px 3px rgba(0,0,0,0.2);";
                div.onclick = () => applySolid(color);
                solidContainer.appendChild(div);
            });
            gradContainer.innerHTML = '';
            colorHistory.gradients.forEach((g) => {
                const row = document.createElement('div');
                row.style = "display:flex; align-items:center; gap:8px; margin-bottom:4px;";
                row.innerHTML = `<div style="flex:1; height:18px; border-radius:4px; background:linear-gradient(90deg, ${g.c1}, ${g.c2}); cursor:pointer; border:1px solid #ddd;"></div><span title="Pin" style="cursor:pointer; font-size:12px;">📌</span>`;
                row.querySelector('div').onclick = () => applyGradient(g.c1, g.c2);
                row.querySelector('span').onclick = () => pinGradient(g);
                gradContainer.appendChild(row);
            });
            pinnedContainer.innerHTML = '';
            colorHistory.pinned.forEach((g, idx) => {
                const row = document.createElement('div');
                row.style = "display:flex; align-items:center; gap:8px; margin-bottom:4px;";
                row.innerHTML = `<div style="flex:1; height:18px; border-radius:4px; background:linear-gradient(90deg, ${g.c1}, ${g.c2}); cursor:pointer; border:1.5px solid var(--accent);"></div><span title="Unpin" style="cursor:pointer; font-size:12px; color:#cc0000;">✕</span>`;
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
            const isPinned = colorHistory.pinned.some(p => p.c1 === g.c1 && p.c2 === g.c2);
            if (!isPinned && colorHistory.pinned.length < 2) {
                colorHistory.pinned.push(g);
                saveAllColorData(cover.style.background);
                renderHistoryUI();
            } else if (colorHistory.pinned.length >= 2) {
                alert("Maximum of 2 pinned gradients. Remove one to add a new one.");
            }
        }

        if(userData.state.settings && userData.state.settings.coverColor) {
            cover.style.background = userData.state.settings.coverColor;
        }

        // --- RESTO DAS FUNÇÕES ORIGINAIS ---
        document.getElementById('addOverviewBlockBtn').onclick = () => {
            import('./planner.js').then(mod => mod.addOverviewBlock(currentUser));
        };
        document.getElementById('clearHistoryBtn').onclick = async () => {
            if(confirm("Permanently delete ALL history? This cannot be undone.")){
                await clearAllHistory(currentUser);
                renderHistory();
            }
        };

        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');
        const closeSettings = document.getElementById('closeSettings');
        personalizeBtn.onclick = () => { settingsDrawer.classList.remove('open'); customDrawer.classList.toggle('open'); };
        settingsBtn.onclick = () => { customDrawer.classList.remove('open'); settingsDrawer.classList.toggle('open'); renderHistory(); };
        closeDrawer.onclick = () => customDrawer.classList.remove('open');
        closeSettings.onclick = () => settingsDrawer.classList.remove('open');

        function renderHistory() {
            const container = document.getElementById('historyList');
            import('./storage.js').then(store => {
                container.innerHTML = store.history.length === 0 ? '<p style="font-size:0.7rem; color:var(--muted); padding:10px;">No history.</p>' : '';
                store.history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    const date = new Date(item.timestamp).toLocaleString();
                    div.innerHTML = `<span class="history-date">${date}</span><strong style="font-size:0.8rem">${item.label}</strong><div style="display:flex; gap:5px; margin-top:5px;"><button class="history-restore" style="flex:1; cursor:pointer;">Restore</button><button class="history-del" style="color:#cc0000; background:none; border:1px solid #ffcccc; border-radius:4px; padding:2px 5px; cursor:pointer;">✕</button></div>`;
                    div.querySelector('.history-restore').onclick = async () => {
                        if(confirm("Restore this version? This will overwrite your current months and texts.")){
                            store.applySnapshot(item.plannerConfig, item.pageContent);
                            await store.saveUserData(currentUser);
                            window.location.reload();
                        }
                    };
                    div.querySelector('.history-del').onclick = async () => {
                        if(confirm("Delete this entry?")){
                            await deleteHistoryEntry(currentUser, item.id);
                            renderHistory();
                        }
                    };
                    container.appendChild(div);
                });
            });
        }

        const googleFonts = ["Arial", "Verdana", "Georgia", "Bebas Neue", "Montserrat", "Open Sans", "Roboto", "Jost", "Playfair Display", "Dancing Script", "Pacifico"];
        const fontListContainer = document.getElementById('fontList');
        const fontSearchInput = document.getElementById('fontSearchInput');

        function loadGoogleFont(fontName) {
            if (["Arial", "Verdana", "Georgia"].includes(fontName)) return;
            const id = `font-${fontName.replace(/\s+/g, '-')}`;
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id; link.rel = 'stylesheet';
                link.href = "https://fonts.googleapis.com/css2?family=" + fontName.replace(/ /g, '+') + "&display=swap";
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
                div.style.fontFamily = '"' + font + '", sans-serif';
                div.onclick = () => {
                    document.documentElement.style.setProperty('--main-font', '"' + font + '", sans-serif');
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
        const settings = userData.state.settings || {};
        if (settings.font) {
            loadGoogleFont(settings.font);
            document.documentElement.style.setProperty('--main-font', '"' + settings.font + '", sans-serif');
        }
        fontSizeSlider.value = settings.fontSize || "15";
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
