import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let pageContent = {};
export let history = [];

export function resetLocalData() {
    state = {};
    plannerConfig = JSON.parse(JSON.stringify(initialWeeksData));
    pageContent = {};
    history = [];
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
}

export async function loadUserData(uid) {
    resetLocalData();
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
            const data = snap.data();
            state = data.state || {};
            plannerConfig = data.plannerConfig || initialWeeksData;
            pageContent = data.pageContent || {};
            history = data.history || [];

            // Limpeza: Remove itens com mais de 30 dias
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const originalLength = history.length;
            history = history.filter(item => item.timestamp > thirtyDaysAgo);
            
            // Se mudou algo, salva a limpeza no banco
            if (history.length !== originalLength) saveUserData(uid);

            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            Object.keys(pageContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = pageContent[id];
            });

            return { state, plannerConfig, pageContent, history };
        }
    } catch (e) { console.error("Erro ao carregar:", e); }
    return { state, plannerConfig, pageContent, history };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig,
            pageContent: window.pageContent || {},
            history: history
        });
    } catch (e) { console.error("Erro ao salvar:", e); }
}

// Função para adicionar um ponto de restauração no histórico
export function addHistoryEntry(label, config, content) {
    const entry = {
        id: Date.now(),
        timestamp: Date.now(),
        label: label,
        plannerConfig: JSON.parse(JSON.stringify(config)),
        pageContent: JSON.parse(JSON.stringify(content || {}))
    };
    history.unshift(entry); // Adiciona no topo
    if (history.length > 50) history.pop(); // Limite de 50 registros por segurança
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}

export async function deleteHistoryEntry(uid, entryId) {
    history = history.filter(item => item.id !== entryId);
    await saveUserData(uid);
}

export async function clearAllHistory(uid) {
    history = [];
    await saveUserData(uid);
}
