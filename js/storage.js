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
    pageContent = {
        "global-cover-eye": "Personal Study Planner",
        "global-cover-title": "Your Roadmap",
        "global-cover-sub": "Custom Duration · Daily Goals · Your Focus",
        "global-goal-strong": "🎯 Your Goal",
        "global-goal-text": "Enter your main goal here — describe what you want to achieve.",
        "global-sec-overview": "Overview",
        "global-sec-template": "Daily Template",
        "dynamicBlocks": [],
        "templateRows": []
    };
    history = [];
    importHistory = [];
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
}

export function applySnapshot(newConfig, newContent) {
    // Sobrescreve os objetos globais para garantir visibilidade em todos os módulos
    window.plannerConfig = JSON.parse(JSON.stringify(newConfig || {}));
    window.pageContent = JSON.parse(JSON.stringify(newContent || {}));
    
    // Sincroniza as variáveis locais do módulo storage.js para corresponderem
    plannerConfig = window.plannerConfig;
    pageContent = window.pageContent;

    console.log("Global data synchronized for Preview.");
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

export function updateState(month, dayKey, data) {
    const fullKey = month ? `m${month}-${dayKey}` : dayKey;
    state[fullKey] = { ...state[fullKey], ...data };
}

export function exportData() {
    const cleanState = JSON.parse(JSON.stringify(window.appState || {}));
    delete cleanState.customName;
    delete cleanState.namePrompted;
    delete cleanState.colorHistory;

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
    try {
        if (fileOrData instanceof File || fileOrData instanceof Blob) {
            const text = await fileOrData.text();
            imported = JSON.parse(text);
        } else {
            imported = fileOrData;
        }
    } catch (err) {
        console.error("Failed to parse import file:", err);
        throw new Error("Invalid JSON format");
    }

    if (!imported.plannerConfig || !imported.state) {
        throw new Error("Invalid planner data structure");
    }

    // Create a backup of the current state before overwriting, unless we are already restoring from a backup
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

    // Preserve critical local identity settings if they exist in the current state
    const localName = state.customName;
    const localPrompted = state.namePrompted;
    const localColorHistory = state.colorHistory;

    // Overwrite module variables with imported data
    state = JSON.parse(JSON.stringify(imported.state));
    plannerConfig = JSON.parse(JSON.stringify(imported.plannerConfig));
    pageContent = JSON.parse(JSON.stringify(imported.pageContent || {}));
    
    // Import history if it exists in the file, otherwise keep current
    if (imported.history && Array.isArray(imported.history)) {
        history = JSON.parse(JSON.stringify(imported.history));
    }

    // Restore preserved local settings into the newly imported state
    if (localName) state.customName = localName;
    if (localPrompted !== undefined) state.namePrompted = localPrompted;
    if (localColorHistory) state.colorHistory = localColorHistory;

    // Synchronize global window objects immediately
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;

    // Persist the imported data to Firebase
    await saveUserData(uid);
    return true;
}
