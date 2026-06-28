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
