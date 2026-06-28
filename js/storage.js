import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let themeConfig = {};

export async function loadUserData(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
            const data = snap.data();
            state = data.state || {};
            themeConfig = data.themeConfig || {};
            window.themeConfig = themeConfig;
            // Carrega o cronograma do banco, ou o padrão se for a primeira vez
            plannerConfig = data.plannerConfig || initialWeeksData;
            window.appState = state;
            window.plannerConfig = plannerConfig;
            return { state, plannerConfig, themeConfig };
        }
    } catch (e) {
        console.error("Erro ao carregar:", e);
    }
    state = {};
    plannerConfig = initialWeeksData;
    themeConfig = { mode:'light', accent:'#c85a2a', font:'Georgia, serif', size:'15', width:'900px', radius:'10' };
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.themeConfig = themeConfig;
    return { state, plannerConfig, themeConfig };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            themeConfig: themeConfig,
            plannerConfig: plannerConfig 
        });
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}
