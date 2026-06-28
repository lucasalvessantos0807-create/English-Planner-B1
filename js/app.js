import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

let currentUser = null;

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("topbarName").textContent = user.displayName;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        const userData = await loadUserData(currentUser);
        
        // Renderiza a estrutura de botões e painéis dinamicamente
        renderStructure(userData.plannerConfig, (m, w) => buildWeek(m, w, currentUser));
        
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);

        // --- LÓGICA DE PERSONALIZAÇÃO ---
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        const fontSearchInput = document.getElementById('fontSearchInput');
        const fontListContainer = document.getElementById('fontList');
        const fontToggle = document.getElementById('fontStyleToggle');
        const fontWrapper = document.getElementById('fontPickerWrapper');
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeVal = document.getElementById('fontSizeVal');

        if (fontToggle && fontWrapper) {
            fontToggle.onclick = (e) => {
                // Força a detecção do estado atual independente de como foi iniciado
                const isCurrentlyHidden = window.getComputedStyle(fontWrapper).display === 'none';
                
                if (isCurrentlyHidden) {
                    fontWrapper.style.setProperty('display', 'block', 'important');
                    fontToggle.classList.add('expanded');
                } else {
                    fontWrapper.style.setProperty('display', 'none', 'important');
                    fontToggle.classList.remove('expanded');
                }
            };
        }

        const googleFonts = [
            "Abel", "Abril Fatface", "Aclonica", "Acme", "Actor", "Adamina", "Advent Pro", "Aguafina Script", "Akronim", "Aladin", "Aldrich", "Alef", "Alegreya", "Alex Brush", "Alfa Slab One", "Alice", "Alike", "Allan", "Allerta", "Allura", "Almendra", "Amarante", "Amaranth", "Amatic SC", "Amethysta", "Amiri", "Amita", "Anaheim", "Andada", "Andika", "Angkor", "Annie Use Your Telescope", "Anonymous Pro", "Antic", "Anton", "Arapey", "Arbutus", "Architects Daughter", "Archivo Black", "Are You Serious", "Arial", "Arima Madurai", "Arimo", "Arizonia", "Armata", "Artifika", "Arvo", "Arya", "Asap", "Asar", "Asset", "Assistant", "Astloch", "Asul", "Athiti", "Atma", "Atomic Age", "Aubrey", "Audiowide", "Autour One", "Average", "Averia Libre", "Bangers", "Barlow", "Baskervville", "Bebas Neue", "Belgrano", "Belleza", "BenchNine", "Bentham", "Berkshire Swash", "Bevan", "Bigelow Rules", "Bigshot One", "Bilbo", "BioRhyme", "Biryani", "Bitter", "Black Ops One", "Bokor", "Bonbon", "Boogaloo", "Bowlby One", "Brawler", "Bree Serif", "Bubblegum Sans", "Buda", "Cabin", "Calligraffitti", "Candal", "Cantarell", "Cardo", "Carme", "Caveat", "Chakra Petch", "Changa One", "Charm", "Chivo", "Cinzel", "Comfortaa", "Cookie", "Cormorant", "Courgette", "Crimson Text", "Dancing Script", "Domine", "Doshesis", "Droid Sans", "Eczar", "Exo", "Fahkwang", "Fira Sans", "Frank Ruhl Libre", "Gloria Hallelujah", "Great Vibes", "Heebo", "Hind", "Inconsolata", "Indie Flower", "Inter", "Josefin Sans", "Jost", "Kanit", "Karla", "Lato", "Libre Baskerville", "Lobster", "Lora", "Mali", "Manuscript", "Merriweather", "Montserrat", "Mukta", "Nanum Gothic", "Noto Sans", "Nunito", "Open Sans", "Oswald", "Oxygen", "Pacifico", "PT Sans", "PT Serif", "Playfair Display", "Poppins", "Quicksand", "Raleway", "Roboto", "Rubik", "Saira", "Shadows Into Light", "Slabo 27px", "Source Sans Pro", "Spectral", "Titillium Web", "Ubuntu", "Varela Round", "Work Sans", "Zilla Slab"
        ];

        function loadGoogleFont(fontName) {
            if (!fontName || fontName === "Georgia, serif" || fontName === "system-ui") return;
            const fontId = `font-${fontName.replace(/\s+/g, '-')}`;
            if (document.getElementById(fontId)) return;
            
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
            document.head.appendChild(link);
        }

        function renderFonts(filter = "") {
            fontListContainer.innerHTML = "";
            const filteredFonts = googleFonts.filter(f => f.toLowerCase().includes(filter.toLowerCase()));
            
            filteredFonts.forEach(font => {
                const div = document.createElement('div');
                div.className = 'font-item';
                div.textContent = font;
                
                // Carrega a fonte para o preview individual
                loadGoogleFont(font);
                div.style.fontFamily = `"${font}", sans-serif`;

                div.onclick = () => {
                    const fontValue = `"${font}", sans-serif`;
                    document.documentElement.style.setProperty('--main-font', fontValue);
                    
                    // Salva na "state" do usuário para ser persistente e individual
                    import('./storage.js').then(store => {
                        store.updateState('settings', { font: font });
                        store.saveUserData(currentUser);
                    });

                    fontWrapper.style.setProperty('display', 'none', 'important');
                    fontToggle.classList.remove('expanded');
                    document.querySelectorAll('.font-item').forEach(i => i.classList.remove('active'));
                    div.classList.add('active');
                };
                fontListContainer.appendChild(div);
            });
        }

        personalizeBtn.onclick = () => customDrawer.classList.toggle('open');
        closeDrawer.onclick = () => customDrawer.classList.remove('open');
        fontSearchInput.oninput = (e) => renderFonts(e.target.value);

        // Carrega a fonte vinda do banco de dados do usuário
        // Carrega as configurações salvas no Firebase
        const userSettings = userData.state.settings || {};
        
        // Aplica a Fonte
        const savedFont = userSettings.font || "Georgia, serif";
        if (savedFont !== "Georgia, serif") {
            loadGoogleFont(savedFont);
            document.documentElement.style.setProperty('--main-font', `"${savedFont}", sans-serif`);
        } else {
            document.documentElement.style.setProperty('--main-font', "Georgia, serif");
        }

        // Aplica o Tamanho da Fonte individual
        const savedSize = userSettings.fontSize || "15";
        fontSizeSlider.value = savedSize;
        fontSizeVal.textContent = savedSize + "px";
        document.documentElement.style.setProperty('--main-font-size', savedSize + "px");
        
        renderFonts();
       // Lógica do Slider de Tamanho de Fonte
        fontSizeSlider.oninput = (e) => {
            const size = e.target.value + "px";
            fontSizeVal.textContent = size;
            // Altera o tamanho base do HTML para que o 'rem' funcione
            document.documentElement.style.setProperty('--main-font-size', size);
        };

        fontSizeSlider.onchange = (e) => {
            const size = e.target.value;
            import('./storage.js').then(store => {
                store.updateState('settings', { fontSize: size });
                store.saveUserData(currentUser);
            });
        };

        // --- BOTÕES DE AÇÃO ---
        document.getElementById('addMonthBtn').onclick = () => {
            if(confirm("Deseja criar um novo mês (4 semanas) no seu cronograma?")) {
                addNewMonth(currentUser);
            }
        };

        // Carrega automaticamente a primeira semana disponível
        const firstKey = Object.keys(userData.plannerConfig).sort()[0];
        if (firstKey) {
            const [m, w] = firstKey.split('-');
            buildWeek(m, w, currentUser);
        }
        updateProgressBar();
    } else {
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
    }
});
