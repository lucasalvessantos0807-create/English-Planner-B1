import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let pageContent = {};

export async function loadUserData(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        
        if (snap.exists()) {
            const data = snap.data();
            state = data.state || {};
            plannerConfig = data.plannerConfig || initialWeeksData;
            pageContent = data.pageContent || {}; // Carrega os títulos editáveis
            
            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            // Esta parte aplica os textos personalizados na tela assim que o usuário loga
            Object.keys(pageContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = pageContent[id];
            });

            return { state, plannerConfig, pageContent };
        }
    } catch (e) {
        console.error("Erro ao carregar dados do Firebase:", e);
    }

    // Fallback: Se o usuário for novo ou der erro, carrega o padrão
    state = {};
    plannerConfig = initialWeeksData;
    pageContent = {};
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
    return { state, plannerConfig, pageContent };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        // Salva tudo no Firebase: progresso (state), estrutura (plannerConfig) e títulos (pageContent)
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig,
            pageContent: window.pageContent || {} 
        });
    } catch (e) {
        console.error("Erro ao salvar no Firebase:", e);
    }
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}
