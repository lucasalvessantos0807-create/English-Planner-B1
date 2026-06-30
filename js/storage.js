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
    // Reset global references safely
    window.plannerConfig = JSON.parse(JSON.stringify(newConfig || {}));
    window.pageContent = JSON.parse(JSON.stringify(newContent || {}));
    
    // Sync module variables
    const configVar = window.plannerConfig;
    const contentVar = window.pageContent;

    // This ensures consistency across the app
    console.log("Snapshot applied successfully.");
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
            importHistory = data.importHistory || [];

            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            history = history.filter(item => item.timestamp > thirtyDaysAgo);

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
    } catch (e) { console.error("Error loading user data:", e); }
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
    } catch (e) { console.error("Error saving data:", e); }
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
    // Cópia para limpeza
    const cleanState = JSON.parse(JSON.stringify(window.appState || {}));
    
    // REMOVE IDENTIDADE E HISTÓRICO DE CORES
    delete cleanState.customName;
    delete cleanState.namePrompted;
    delete cleanState.colorHistory; // O histórico de cores não vai no arquivo

    const dataToExport = {
        state: cleanState,
        plannerConfig: window.plannerConfig,
        pageContent: window.pageContent,
        history: history,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planner_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importData(fileOrData, uid, isRestore = false) {
    let imported;
    if (fileOrData instanceof File || fileOrData instanceof Blob) {
        const text = await fileOrData.text();
        imported = JSON.parse(text);
    } else {
        imported = fileOrData;
    }

    if (!imported.plannerConfig || !imported.state) throw new Error("Invalid format");

    if (!isRestore) {
        const backup = {
            id: "imp_" + Date.now(),
            timestamp: Date.now(),
            filename: fileOrData.name || "System Backup",
            state: JSON.parse(JSON.stringify(state)),
            plannerConfig: JSON.parse(JSON.stringify(plannerConfig)),
            pageContent: JSON.parse(JSON.stringify(pageContent))
        };
        importHistory.unshift(backup);
    }

    // PRESERVAR IDENTIDADE E HISTÓRICO DE CORES LOCAL
    const localName = state.customName;
    const localPrompted = state.namePrompted;
    const localColorHistory = state.colorHistory; // Salva o seu histórico de cores

    state = imported.state;
    plannerConfig = imported.plannerConfig;
    pageContent = imported.pageContent || {};

    // Restaurar dados locais após a importação do estado
    if (localName) state.customName = localName;
    state.namePrompted = localPrompted || false;
    if (localColorHistory) state.colorHistory = localColorHistory; // Devolve o seu histórico

    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;

    await saveUserData(uid);
    return true;
}
