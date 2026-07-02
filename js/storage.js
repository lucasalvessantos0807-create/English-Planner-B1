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
    if (fileOrData instanceof File || fileOrData instanceof Blob) {
        const text = await fileOrData.text();
        imported = JSON.parse(text);
    } else {
        imported = fileOrData;
    }

    if (!imported.plannerConfig || !imported.state) throw new Error("Invalid format");

    // Backup do estado atual antes da sobreposição (apenas se não for uma restauração de backup)
    if (!isRestore) {
        const backup = {
            id: "imp_" + Date.now(),
            timestamp: Date.now(),
            filename: fileOrData.name || "System Backup",
            state: JSON.parse(JSON.stringify(state)),
            plannerConfig: JSON.parse(JSON.stringify(plannerConfig)),
            pageContent: JSON.parse(JSON.stringify(pageContent)),
            history: JSON.parse(JSON.stringify(history))
        };
        importHistory.unshift(backup);
    }

    // Preservar dados locais sensíveis do usuário que não devem ser sobrescritos
    const localName = state.customName;
    const localPrompted = state.namePrompted;
    const localColorHistory = JSON.parse(JSON.stringify(state.colorHistory || { solids: [], gradients: [], pinned: [] }));
    const localSettings = JSON.parse(JSON.stringify(state.settings || {}));

    // Limpar e atualizar os objetos mantendo as referências originais para outros módulos
    for (let key in state) delete state[key];
    Object.assign(state, imported.state);

    for (let key in plannerConfig) delete plannerConfig[key];
    Object.assign(plannerConfig, imported.plannerConfig);

    for (let key in pageContent) delete pageContent[key];
    Object.assign(pageContent, imported.pageContent || {});

    // Atualizar histórico de edições (Undo/Redo) se presente no arquivo
    if (imported.history) {
        history.length = 0;
        imported.history.forEach(item => history.push(item));
    }

    // Restaurar os dados locais preservados
    if (localName) state.customName = localName;
    if (localPrompted !== undefined) state.namePrompted = localPrompted;
    state.colorHistory = localColorHistory;
    
    // Mesclar configurações de estilo (fonte/tamanho) se o importado não possuir
    if (!state.settings) {
        state.settings = localSettings;
    } else {
        state.settings = { ...localSettings, ...state.settings };
    }

    // Sincronizar referências globais do window
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;

    // Persistir no Firebase e retornar
    await saveUserData(uid);
    return true;
}
