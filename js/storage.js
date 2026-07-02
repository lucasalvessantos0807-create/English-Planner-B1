import { db, doc, getDoc, setDoc } from './firebase.js';
import { weeksData as initialWeeksData } from './weeks.js';

export let state = {};
export let plannerConfig = {};
export let pageContent = {};
export let history = [];
export let importHistory = [];

export function resetLocalData() {
    // Limpeza mantendo as referências originais dos objetos
    for (let key in state) delete state[key];
    for (let key in plannerConfig) delete plannerConfig[key];
    for (let key in pageContent) delete pageContent[key];
    
    // Resetar arrays
    history.length = 0;
    importHistory.length = 0;

    // Preencher com dados iniciais
    Object.assign(plannerConfig, JSON.parse(JSON.stringify(initialWeeksData)));
    
    window.appState = state;
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;
}

export function applySnapshot(newConfig, newContent) {
    // Sobrescreve os objetos globais para garantir visibilidade em todos os módulos
    for (let key in plannerConfig) delete plannerConfig[key];
    Object.assign(plannerConfig, JSON.parse(JSON.stringify(newConfig || {})));

    for (let key in pageContent) delete pageContent[key];
    Object.assign(pageContent, JSON.parse(JSON.stringify(newContent || {})));
    
    window.plannerConfig = plannerConfig;
    window.pageContent = pageContent;

    console.log("Global data synchronized for Preview.");
}

export async function loadUserData(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
            const data = snap.data();
            
            // Sincronizar State
            for (let key in state) delete state[key];
            Object.assign(state, data.state || {});

            // Sincronizar Planner Config
            for (let key in plannerConfig) delete plannerConfig[key];
            Object.assign(plannerConfig, data.plannerConfig || JSON.parse(JSON.stringify(initialWeeksData)));

            // Sincronizar Page Content
            for (let key in pageContent) delete pageContent[key];
            Object.assign(pageContent, data.pageContent || {});

            // Sincronizar Históricos (Arrays)
            history.length = 0;
            if (data.history) {
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                data.history.filter(item => item.timestamp > thirtyDaysAgo).forEach(item => history.push(item));
            }

            importHistory.length = 0;
            if (data.importHistory) {
                const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
                data.importHistory.filter(item => item.timestamp > sixMonthsAgo).forEach(item => importHistory.push(item));
            }

            if (!pageContent.dynamicBlocks) pageContent.dynamicBlocks = [];

            window.appState = state;
            window.plannerConfig = plannerConfig;
            window.pageContent = pageContent;

            return { state, plannerConfig, pageContent, history, importHistory };
        } else {
            resetLocalData();
        }
    } catch (e) { 
        console.error("Error loading user data:", e); 
        resetLocalData();
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
    const idx = history.findIndex(item => item.id === entryId);
    if (idx !== -1) {
        history.splice(idx, 1);
        await saveUserData(uid);
    }
}

export async function clearAllHistory(uid) {
    history.length = 0;
    await saveUserData(uid);
}

export async function deleteImportBackup(uid, backupId) {
    const idx = importHistory.findIndex(b => b.id === backupId);
    if (idx !== -1) {
        importHistory.splice(idx, 1);
        await saveUserData(uid);
    }
}

export function updateState(month, dayKey, data) {
    const fullKey = month ? `m${month}-${dayKey}` : dayKey;
    state[fullKey] = { ...state[fullKey], ...data };
}

export function exportData() {
    const cleanState = JSON.parse(JSON.stringify(window.appState || {}));
    // Não exportamos dados sensíveis de conta ou nome para evitar conflitos em outras contas
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

        if (!imported.plannerConfig || !imported.state) throw new Error("Invalid format");

        // 1. Criar backup do estado ATUAL antes de importar
        if (!isRestore) {
            const backupEntry = {
                id: "imp_" + Date.now(),
                timestamp: Date.now(),
                filename: fileOrData.name || "System Backup",
                state: JSON.parse(JSON.stringify(state)),
                plannerConfig: JSON.parse(JSON.stringify(plannerConfig)),
                pageContent: JSON.parse(JSON.stringify(pageContent))
            };
            importHistory.unshift(backupEntry);
            // Manter apenas 20 backups de importação
            if (importHistory.length > 20) importHistory.pop();
        }

        // 2. Preservar dados de identidade local que não devem vir do arquivo importado
        const currentName = state.customName;
        const currentPrompted = state.namePrompted;
        const currentColorHistory = JSON.parse(JSON.stringify(state.colorHistory || { solids: [], gradients: [], pinned: [] }));
        const currentSettings = JSON.parse(JSON.stringify(state.settings || {}));

        // 3. Atualizar Planner Config (Mantendo a referência do objeto)
        for (let key in plannerConfig) delete plannerConfig[key];
        Object.assign(plannerConfig, imported.plannerConfig);

        // 4. Atualizar Page Content (Mantendo a referência do objeto)
        for (let key in pageContent) delete pageContent[key];
        Object.assign(pageContent, imported.pageContent || {});

        // 5. Atualizar State (Mantendo a referência do objeto)
        for (let key in state) delete state[key];
        Object.assign(state, imported.state);

        // 6. Restaurar dados de identidade preservados
        if (currentName) state.customName = currentName;
        state.namePrompted = currentPrompted || false;
        state.colorHistory = currentColorHistory;
        
        // Mesclar configurações visuais (prioriza as do arquivo, mas mantém as locais se faltarem)
        state.settings = { ...currentSettings, ...imported.state.settings };

        // 7. Sincronizar referências globais
        window.appState = state;
        window.plannerConfig = plannerConfig;
        window.pageContent = pageContent;

        // 8. Salvar no Firebase IMEDIATAMENTE
        await saveUserData(uid);
        return true;
    } catch (err) {
        console.error("Import error:", err);
        throw err;
    }
}
