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
    window.plannerConfig = JSON.parse(JSON.stringify(newConfig || {}));
    window.pageContent = JSON.parse(JSON.stringify(newContent || {}));
    plannerConfig = window.plannerConfig;
    pageContent = window.pageContent;
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
            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;
            return { state, plannerConfig, pageContent, history, importHistory };
        }
    } catch (e) { console.error(e); }
    return { state, plannerConfig, pageContent, history, importHistory };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: window.appState,
            plannerConfig: window.plannerConfig,
            pageContent: window.pageContent,
            history: history,
            importHistory: importHistory
        });
    } catch (e) { console.error(e); }
}

export function addHistoryEntry(label, config, content) {
    history.unshift({ id: Date.now(), timestamp: Date.now(), label, plannerConfig: JSON.parse(JSON.stringify(config)), pageContent: JSON.parse(JSON.stringify(content || {})) });
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

export function updateState(month, dayKey, data) {
    const fullKey = month ? `m${month}-${dayKey}` : dayKey;
    if (!window.appState[fullKey]) window.appState[fullKey] = {};
    window.appState[fullKey] = { ...window.appState[fullKey], ...data };
}

export function exportData() {
    const data = { state: window.appState, plannerConfig: window.plannerConfig, pageContent: window.pageContent, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `planner_backup.json`;
    a.click();
}

export async function importData(fileOrData, uid, isRestore = false) {
    let imported;
    try {
        if (fileOrData instanceof File || fileOrData instanceof Blob) imported = JSON.parse(await fileOrData.text());
        else imported = fileOrData;
    } catch (err) { throw new Error("Invalid format"); }

    if (!isRestore) {
        importHistory.unshift({ id: "imp_" + Date.now(), timestamp: Date.now(), filename: fileOrData.name || "Backup", state: JSON.parse(JSON.stringify(window.appState)), plannerConfig: JSON.parse(JSON.stringify(window.plannerConfig)), pageContent: JSON.parse(JSON.stringify(window.pageContent)) });
    }

    window.appState = JSON.parse(JSON.stringify(imported.state));
    window.plannerConfig = JSON.parse(JSON.stringify(imported.plannerConfig));
    window.pageContent = JSON.parse(JSON.stringify(imported.pageContent || {}));
    
    state = window.appState;
    plannerConfig = window.plannerConfig;
    pageContent = window.pageContent;

    await saveUserData(uid);
    return true;
}
