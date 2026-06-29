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
        import('./planner.js').then(mod => mod.renderDynamicOverviewBlocks(currentUser));
        renderStructure(userData.plannerConfig, (m, w) => buildWeek(m, w, currentUser));
        
        // --- BOTÕES DA TOPBAR ---
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('cancelEditBtn').onclick = () => cancelEdit(currentUser);
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);
        
        const cover = document.getElementById('page-cover');
        const editCoverBtn = document.getElementById('editCoverBtn');
        
        editCoverBtn.onclick = () => {
            const isSolid = confirm("Clique em OK para Cor Sólida ou CANCELAR para Degradê (Gradient)");
            const colorInput1 = document.getElementById('coverColorInput');
            const colorInput2 = document.getElementById('coverColorInput2');

            if (isSolid) {
                colorInput1.onchange = (e) => {
                    const color = e.target.value;
                    cover.style.background = color;
                    saveCoverSettings(color);
                };
                colorInput1.click();
            } else {
                alert("Escolha a Cor 1 e, em seguida, feche o seletor. Abriremos a Cor 2 logo depois.");
                colorInput1.onchange = () => {
                    const c1 = colorInput1.value;
                    setTimeout(() => {
                        colorInput2.onchange = () => {
                            const c2 = colorInput2.value;
                            const grad = `linear-gradient(135deg, ${c1}, ${c2})`;
                            cover.style.background = grad;
                            saveCoverSettings(grad);
                        };
                        colorInput2.click();
                    }, 500);
                };
                colorInput1.click();
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

        personalizeBtn.onclick = () => { 
            settingsDrawer.classList.remove('open'); 
            customDrawer.classList.toggle('open'); 
        };
        
        settingsBtn.onclick = () => { 
            customDrawer.classList.remove('open'); 
            settingsDrawer.classList.toggle('open'); 
            renderHistory(); 
        };
        
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
                    div.innerHTML = `
                        <span class="history-date">${date}</span>
                        <strong style="font-size:0.8rem">${item.label}</strong>
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <button class="history-restore" style="flex:1; cursor:pointer;">Restore</button>
                            <button class="history-del" style="color:#cc0000; background:none; border:1px solid #ffcccc; border-radius:4px; padding:2px 5px; cursor:pointer;">✕</button>
                        </div>
                    `;
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
        const settings = userData.state.settings || {};
        if (settings.font) {
            loadGoogleFont(settings.font);
            document.documentElement.style.setProperty('--main-font', `"${settings.font}", sans-serif`);
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
