import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth } from './planner.js';
import { renderStructure, updateProgressBar, renderOverviewAndTemplate } from './ui.js';

let currentUser = null;

// Botões de Login/Logout
document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => signOut(auth);

/**
 * Monitor de Estado de Autenticação
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("topbarName").textContent = user.displayName;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        // Carrega os dados do Firebase (State e PlannerConfig)
        const userData = await loadUserData(currentUser);
        
        // 1. Renderiza Visão Geral e Template (Seções estáticas agora dinâmicas)
        renderOverviewAndTemplate(userData.plannerConfig);

        // 2. Renderiza estrutura de meses e semanas
        renderStructure(userData.plannerConfig, (m, w) => buildWeek(m, w, currentUser));
        
        // 3. Configura botões globais
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('addMonthBtn').onclick = () => {
            if (confirm("Deseja criar um novo mês no seu cronograma?")) {
                addNewMonth(currentUser);
            }
        };

        // 4. Carrega a primeira semana disponível automaticamente
        const weekKeys = Object.keys(userData.plannerConfig).filter(k => k.includes('-')).sort();
        if (weekKeys.length > 0) {
            const [m, w] = weekKeys[0].split('-');
            buildWeek(m, w, currentUser);
        }
        
        updateProgressBar();
    } else {
        // Usuário deslogado
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
    }
});
