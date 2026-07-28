import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let pageContent = {};
export let history = [];
export let importHistory = [];
export const library = { folders: [], documents: [] };

export function resetLocalData() {
    state = { language: 'en' };
    const starterConfig = {};
    
    // Gerar 3 meses automáticos no primeiro acesso (30 dias cada)
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (let m = 1; m <= 3; m++) {
        let currentDay = 1;
        for (let w = 1; w <= 5; w++) {
            const daysInW = (w === 5) ? 2 : 7; // Semana 5 com 2 dias para totalizar 30
            starterConfig[`${m}-${w}`] = {
                label: `Week ${w}`,
                theme: "Month Plans",
                days: Array.from({length: daysInW}, (_, i) => {
                    const d = currentDay++;
                    return { 
                        n: d, 
                        name: dayNames[i % 7], 
                        tag: "Daily Activity", 
                        activities: [{t:"grammar", i:"📝", title:"Study Topic", desc:"Edit details", time: "20m"}]
                    };
                })
            };
        }
    }

    plannerConfig = starterConfig;
    pageContent = {
        "global-cover-eye": "Personal Study Planner",
        "global-cover-title": "Your Roadmap",
        "global-cover-sub": "Custom Duration · Daily Goals · Your Focus",
        "global-goal-strong": "🎯 Your Goal",
        "global-goal-text": "Enter your main goal here — describe what you want to achieve.",
        "global-sec-overview": "Overview",
        "global-sec-template": "Daily Template",
        "dynamicBlocks": ["ov-first-1", "ov-first-2", "ov-first-3"],
        "ov-first-1-title": "Phase 1",
        "ov-first-1-body": "Edit focus...",
        "ov-first-2-title": "Phase 2",
        "ov-first-2-body": "Edit focus...",
        "ov-first-3-title": "Phase 3",
        "ov-first-3-body": "Edit focus...",
        "templateRows": ["tpl-first-1"],
        "tpl-first-1-t": "00:00",
        "tpl-first-1-a": "Edit task description..."
    };
    history = [];
    importHistory = [];
    
    // Resetando a biblioteca sem quebrar a referência constante
    library.folders = [];
    library.documents = [];

    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
}

export function applySnapshot(newConfig, newContent) {
    window.plannerConfig = JSON.parse(JSON.stringify(newConfig || {}));
    window.pageContent = JSON.parse(JSON.stringify(newContent || {}));
    
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
            
            // Sincronizando a biblioteca do banco com o objeto constante
            if (data.library) {
                library.folders = data.library.folders || [];
                library.documents = data.library.documents || [];
            } else {
                library.folders = [];
                library.documents = [];
            }

            state = data.state || {};
            plannerConfig = data.plannerConfig || plannerConfig;
            pageContent = data.pageContent || pageContent;
            history = data.history || [];
            importHistory = data.importHistory || [];

            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            history = history.filter(item => item.timestamp > thirtyDaysAgo);

            const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
            importHistory = importHistory.filter(item => item.timestamp > sixMonthsAgo);

            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            return { state, plannerConfig, pageContent, history, importHistory, library };
        } else {
            await saveUserData(uid);
        }
    } catch (e) { console.error("Error loading user data:", e); }
    return { state, plannerConfig, pageContent, history, importHistory, library };
}

export async function saveUserData(uid) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { 
            state: state,
            plannerConfig: plannerConfig,
            pageContent: pageContent,
            history: history,
            importHistory: importHistory,
            library: library
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
    // Reduzido drasticamente de 50 para 10 para não estourar o limite de 1MB do Firestore
    if (history.length > 10) history.pop();
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
        // Limita a apenas 3 backups de importação para economizar espaço no documento
        if (importHistory.length > 3) importHistory.pop();
    }
    
    const localName = state.customName;
    const localPrompted = state.namePrompted;
    const localColorHistory = state.colorHistory;

    state = JSON.parse(JSON.stringify(imported.state));
    plannerConfig = JSON.parse(JSON.stringify(imported.plannerConfig));
    pageContent = JSON.parse(JSON.stringify(imported.pageContent || {}));
    
    if (imported.history && Array.isArray(imported.history)) {
        history = JSON.parse(JSON.stringify(imported.history));
    }

    if (localName) state.customName = localName;
    if (localPrompted !== undefined) state.namePrompted = localPrompted;
    if (localColorHistory) state.colorHistory = localColorHistory;

    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;

    await saveUserData(uid);
    return true;
}
