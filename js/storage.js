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
            pageContent = data.pageContent || {}; // Carrega textos globais
            
            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            // Aplica os textos carregados na UI
            Object.keys(pageContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = pageContent[id];
            });

            return { state, plannerConfig, pageContent };
        }
    } catch (e) {
        console.error("Erro ao carregar:", e);
    }

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        // Removido { merge: true } para permitir deleções reais no Firebase
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig,
            pageContent: window.pageContent || {} // Salva textos globais
        });
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}
