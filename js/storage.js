import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};

export async function loadUserData(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
            const data = snap.data();
            state = data.state || {};
            // Carrega o cronograma do banco, ou o padrão se for a primeira vez
            plannerConfig = data.plannerConfig || initialWeeksData;
            window.appState = state;
            window.plannerConfig = plannerConfig;
            return { state, plannerConfig };
        }
    } catch (e) {
        console.error("Erro ao carregar:", e);
    }
    state = {};
    plannerConfig = initialWeeksData;
    window.appState = state;
    window.plannerConfig = plannerConfig;
    return { state, plannerConfig };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig 
        });
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}
