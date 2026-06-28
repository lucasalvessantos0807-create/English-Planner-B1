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
        // Personalization Logic
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        const fontSelect = document.getElementById('fontFamilySelect');

        personalizeBtn.onclick = () => customDrawer.classList.add('open');
        closeDrawer.onclick = () => customDrawer.classList.remove('open');

        fontSelect.onchange = (e) => {
            const font = e.target.value;
            document.documentElement.style.setProperty('--main-font', font);
            localStorage.setItem('plannerFont', font);
        };

        // Carrega fonte salva ao iniciar
        const savedFont = localStorage.getItem('plannerFont');
        if (savedFont) {
            document.documentElement.style.setProperty('--main-font', savedFont);
            fontSelect.value = savedFont;
        }
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
