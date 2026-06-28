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
        renderStructure(userData.plannerConfig, (m, w) => buildWeek(m, w, currentUser));
        
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);

        // --- PERSONALIZAÇÃO ---
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
            fontToggle.onclick = () => {
                const isHidden = window.getComputedStyle(fontWrapper).display === 'none';
                fontWrapper.style.display = isHidden ? 'block' : 'none';
                fontToggle.classList.toggle('expanded', isHidden);
            };
        }

        const googleFonts = [
            "Abel", "Abril Fatface", "Aclonica", "Acme", "Actor", "Adamina", "Advent Pro", "Aguafina Script", "Akronim", "Aladin", "Aldrich", "Alef", "Alegreya", "Alex Brush", "Alfa Slab One", "Alice", "Alike", "Allan", "Allerta", "Allura", "Almendra", "Amarante", "Amaranth", "Amatic SC", "Amethysta", "Amiri", "Amita", "Anaheim", "Andada", "Andika", "Angkor", "Annie Use Your Telescope", "Anonymous Pro", "Antic", "Anton", "Arapey", "Arbutus", "Architects Daughter", "Archivo Black", "Are You Serious", "Arima Madurai", "Arimo", "Arizonia", "Armata", "Artifika", "Arvo", "Arya", "Asap", "Asar", "Asset", "Assistant", "Astloch", "Asul", "Athiti", "Atma", "Atomic Age", "Aubrey", "Audiowide", "Autour One", "Average", "Averia Libre", "Bangers", "Barlow", "Baskervville", "Bebas Neue", "Belgrano", "Belleza", "BenchNine", "Bentham", "Berkshire Swash", "Bevan", "Bigelow Rules", "Bigshot One", "Bilbo", "BioRhyme", "Biryani", "Bitter", "Black Ops One", "Bokor", "Bonbon", "Boogaloo", "Bowlby One", "Brawler", "Bree Serif", "Bubblegum Sans", "Buda", "Cabin", "Calligraffitti", "Candal", "Cantarell", "Cardo", "Carme", "Caveat", "Chakra Petch", "Changa One", "Charm", "Chivo", "Cinzel", "Comfortaa", "Cookie", "Cormorant", "Courgette", "Crimson Text", "Dancing Script", "Domine", "Dosis", "Droid Sans", "Eczar", "Exo", "Fahkwang", "Fira Sans", "Frank Ruhl Libre", "Gloria Hallelujah", "Great Vibes", "Heebo", "Hind", "Inconsolata", "Indie Flower", "Inter", "Josefin Sans", "Jost", "Kanit", "Karla", "Lato", "Libre Baskerville", "Lobster", "Lora", "Mali", "Merriweather", "Montserrat", "Mukta", "Nanum Gothic", "Noto Sans", "Nunito", "Open Sans", "Oswald", "Oxygen", "Pacifico", "PT Sans", "PT Serif", "Playfair Display", "Poppins", "Quicksand", "Raleway", "Roboto", "Rubik", "Saira", "Shadows Into Light", "Slabo 27px", "Source Sans Pro", "Spectral", "Titillium Web", "Ubuntu", "Varela Round", "Work Sans", "Zilla Slab"
        ];

        function loadGoogleFont(fontName) {
            if (!fontName || fontName === "Georgia, serif") return;
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

        personalizeBtn.onclick = () => customDrawer.classList.toggle('open');
        closeDrawer.onclick = () => customDrawer.classList.remove('open');
        fontSearchInput.oninput = (e) => renderFonts(e.target.value);

        const settings = userData.state.settings || {};
        if (settings.font) {
            loadGoogleFont(settings.font);
            document.documentElement.style.setProperty('--main-font', `"${settings.font}", sans-serif`);
        }
        
        const savedSize = settings.fontSize || "15";
        fontSizeSlider.value = savedSize;
        fontSizeVal.textContent = savedSize + "px";
        document.documentElement.style.setProperty('--main-font-size', savedSize + "px");

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

        renderFonts();
        document.getElementById('addMonthBtn').onclick = () => addNewMonth(currentUser);
        updateProgressBar();

    } else {
        if (currentUser) window.location.reload();
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        currentUser = null;
    }
});
