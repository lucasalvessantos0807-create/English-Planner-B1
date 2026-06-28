import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let pageContent = {};

// Função para limpar a memória local ao trocar de usuário
export function resetLocalData() {
    state = {};
    plannerConfig = JSON.parse(JSON.stringify(initialWeeksData)); // Cópia limpa do padrão
    pageContent = {};
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
}

export async function loadUserData(uid) {
    resetLocalData(); // Limpa antes de carregar o novo
    try {
        const snap = await getDoc(doc(db, "users", uid));
        
        if (snap.exists()) {
            const data = snap.data();
            state = data.state || {};
            plannerConfig = data.plannerConfig || initialWeeksData;
            pageContent = data.pageContent || {}; 
            
            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            // Aplica os textos personalizados do usuário na UI
            Object.keys(pageContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = pageContent[id];
            });

            return { state, plannerConfig, pageContent };
        }
    } catch (e) {
        console.error("Erro ao carregar:", e);
    }
    return { state, plannerConfig, pageContent };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig,
            pageContent: window.pageContent || {} 
        });
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}
