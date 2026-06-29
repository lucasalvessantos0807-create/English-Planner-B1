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

// FUNÇÃO CRUCIAL PARA A RESTAURAÇÃO FUNCIONAR
export function applySnapshot(newConfig, newContent) {
    plannerConfig = JSON.parse(JSON.stringify(newConfig));
    pageContent = JSON.parse(JSON.stringify(newContent));
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
            // Garante que o array de blocos dinâmicos exista se não houver dados
            if(!pageContent.dynamicBlocks) pageContent.dynamicBlocks = [];

            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const initialLength = history.length;
            history = history.filter(item => item.timestamp > thirtyDaysAgo);
            
            if (history.length !== initialLength) saveUserData(uid);

            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            Object.keys(pageContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = pageContent[id];
            });

            return { state, plannerConfig, pageContent, history };
        }
    } catch (e) {
        console.error("Erro ao carregar dados individuais:", e);
    }
    return { state, plannerConfig, pageContent, history };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig, // Salva a variável interna do módulo
            pageContent: pageContent,     // Salva a variável interna do módulo
            history: history 
        });
    } catch (e) {
        console.error("Erro ao salvar dados individuais:", e);
    }
}

export function addHistoryEntry(label, config, content) {
    const entry = {
        id: Date.now(),
        timestamp: Date.now(),
        label: label,
        plannerConfig: JSON.parse(JSON.stringify(config)),
        pageContent: JSON.parse(JSON.stringify(content || {}))
    };
    history.unshift(entry);
    if (history.length > 50) history.pop();
}

export async function deleteHistoryEntry(uid, entryId) {
    history = history.filter(item => item.id !== entryId);
    await saveUserData(uid);
}

export async function clearAllHistory(uid) {
    history = [];
    await saveUserData(uid);
}

export function updateState(dayKey, data) {
    state[dayKey] = { ...state[dayKey], ...data };
}

export function exportData() {
    const dataToExport = {
        state: window.appState,
        plannerConfig: window.plannerConfig,
        pageContent: window.pageContent,
        history: history,
        exportDate: new Date().toISOString(),
        version: "1.0"
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planner_backup_${new Date().toLocaleDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importData(file, uid) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!imported.plannerConfig || !imported.state) {
                    throw new Error("Invalid planner data file.");
                }
                
                // Aplicar aos dados locais
                state = imported.state;
                plannerConfig = imported.plannerConfig;
                pageContent = imported.pageContent || {};
                history = imported.history || [];
                
                window.appState = state;
                window.plannerConfig = plannerConfig;
                window.pageContent = pageContent;

                // Salvar no Firebase
                await saveUserData(uid);
                resolve(true);
            } catch (err) {
                console.error("Import error:", err);
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}
