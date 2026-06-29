import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let pageContent = {};
export let history = [];
export let importHistory = [];

export function resetLocalData() {
    state = {};
    plannerConfig = JSON.parse(JSON.stringify(initialWeeksData));
    pageContent = {};
    history = [];
    importHistory = [];
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
}

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
            
            // Histórico comum (30 dias)
            history = data.history || [];
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            history = history.filter(item => item.timestamp > thirtyDaysAgo);

            // Histórico de Importação (6 meses / 180 dias)
            importHistory = data.importHistory || [];
            const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
            importHistory = importHistory.filter(item => item.timestamp > sixMonthsAgo);

            if (!pageContent.dynamicBlocks) pageContent.dynamicBlocks = [];

            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            Object.keys(pageContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = pageContent[id];
            });

            return { state, plannerConfig, pageContent, history, importHistory };
        }
    } catch (e) {
        console.error("Error loading user data:", e);
    }
    return { state, plannerConfig, pageContent, history, importHistory };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig,
            pageContent: pageContent,
            history: history,
            importHistory: importHistory
        });
    } catch (e) {
        console.error("Error saving user data:", e);
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

export async function deleteImportBackup(uid, backupId) {
    importHistory = importHistory.filter(b => b.id !== backupId);
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
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planner_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importData(file, uid, isRestore = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!imported.plannerConfig || !imported.state) throw new Error("Invalid file");

                // SE NÃO FOR UMA RESTAURAÇÃO DE BACKUP, SALVA O ESTADO ATUAL NO HISTÓRICO DE IMPORTAÇÃO
                if (!isRestore) {
                    const backup = {
                        id: "imp_" + Date.now(),
                        timestamp: Date.now(),
                        filename: file.name || "Manual Import",
                        state: JSON.parse(JSON.stringify(state)),
                        plannerConfig: JSON.parse(JSON.stringify(plannerConfig)),
                        pageContent: JSON.parse(JSON.stringify(pageContent))
                    };
                    importHistory.unshift(backup);
                }

                state = imported.state;
                plannerConfig = imported.plannerConfig;
                pageContent = imported.pageContent || {};
                
                window.appState = state;
                window.plannerConfig = plannerConfig;
                window.pageContent = pageContent;

                await saveUserData(uid);
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}
