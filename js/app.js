import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo } from './planner.js';
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
        document.getElementById('undoBtn').onclick = () => performUndo(currentUser);
        document.getElementById('logoutBtn').onclick = () => signOut(auth);

        // --- DRAWERS (Personalize e Settings) ---
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');
        const closeSettings = document.getElementById('closeSettings');

        personalizeBtn.onclick = () => { settingsDrawer.classList.remove('open'); customDrawer.classList.toggle('open'); };
        settingsBtn.onclick = () => { 
            customDrawer.classList.remove('open'); 
            settingsDrawer.classList.toggle('open'); 
            renderHistory(); 
        };
        closeDrawer.onclick = () => customDrawer.classList.remove('open');
        closeSettings.onclick = () => settingsDrawer.classList.remove('open');

        // --- LÓGICA DE HISTÓRICO ---
        function renderHistory() {
            const container = document.getElementById('historyList');
            import('./storage.js').then(store => {
                container.innerHTML = store.history.length === 0 ? '<p style="font-size:0.7rem; color:var(--muted); padding:10px;">No history yet.</p>' : '';
                store.history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    const date = new Date(item.timestamp).toLocaleString();
                    div.innerHTML = `
                        <span class="history-date">${date}</span>
                        <strong>${item.label}</strong>
                        <button class="history-restore" data-id="${item.id}">Restore This Version</button>
                    `;
                    div.querySelector('.history-restore').onclick = () => {
                        if(confirm("Restore this version? Current changes will be overwritten.")){
                            window.plannerConfig = item.plannerConfig;
                            window.pageContent = item.pageContent;
                            // Salva no banco e recarrega
                            store.saveUserData(currentUser).then(() => window.location.reload());
                        }
                    };
                    container.appendChild(div);
                });
            });
        }

        // --- LÓGICA DE FONTES (Mantida) ---
        const googleFonts = ["Arial", "Verdana", "Times New Roman", "Georgia", "Abel", "Abril Fatface", "Acme", "Aladin", "Amatic SC", "Anton", "Architects Daughter", "Bebas Neue", "Bitter", "Caveat", "Comfortaa", "Cookie", "Dancing Script", "Great Vibes", "Indie Flower", "Josefin Sans", "Jost", "Lobster", "Montserrat", "Pacifico", "Playfair Display", "Poppins", "Quicksand", "Raleway", "Roboto", "Shadows Into Light"];
        const fontListContainer = document.getElementById('fontList');
        const fontSearchInput = document.getElementById('fontSearchInput');

        function loadGoogleFont(fontName) {
            const sys = ["Arial", "Verdana", "Times New Roman", "Georgia"];
            if (!fontName || sys.includes(fontName)) return;
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
        const fontSizeVal = document.getElementById('fontSizeVal');
        const settings = userData.state.settings || {};
        if (settings.font) {
            loadGoogleFont(settings.font);
            document.documentElement.style.setProperty('--main-font', `"${settings.font}", sans-serif`);
        }
        fontSizeSlider.value = settings.fontSize || "15";
        fontSizeVal.textContent = fontSizeSlider.value + "px";
        document.documentElement.style.setProperty('--main-font-size', fontSizeSlider.value + "px");

        fontSizeSlider.oninput = (e) => {
            fontSizeVal.textContent = e.target.value + "px";
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
            wrapper.style.display = wrapper.style.display === 'none' ? 'block' : 'none';
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
