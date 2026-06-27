import { db, doc, getDoc, setDoc } from './firebase.js';

export let state = {};

export async function loadUserProgress(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
            state = snap.data().state || {};
            window.appState = state;
            return state;
        }
    } catch (e) {
        console.error("Erro ao carregar:", e);
    }
    state = {};
    window.appState = state;
    return state;
}

export async function saveUserProgress(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { state }, { merge: true });
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}
