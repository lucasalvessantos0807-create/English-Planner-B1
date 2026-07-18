import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, deleteDoc, doc, db, deleteUser } from './firebase.js';
import { loadUserData, deleteHistoryEntry, clearAllHistory, exportData, importData, importHistory, deleteImportBackup, applySnapshot, saveUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth, performUndo, cancelEdit, renderDynamicOverviewBlocks, renderDailyTemplate, addOverviewBlock } from './planner.js';
import { renderStructure, updateProgressBar, renderOverviewAndTemplate } from './ui.js';
import { renderLibrary } from './notes.js';
let currentUser = null;

// --- LANGUAGE DICTIONARY SYSTEM ---
export const translations = {
    en: {
        confirmMsg: "Change system language to English? Custom texts will be preserved.",
        month: "Month", week: "Week", activity: "Activity", dailyAct: "Daily Activity",
        studyTopic: "Study Topic", editDetails: "Edit details", phase: "Phase", 
        editFocus: "Edit focus...", editTask: "Edit task description...",
        personalPlanner: "Personal Study Planner", roadmap: "Your Roadmap",
        roadmapSub: "Custom Duration · Daily Goals · Your Focus", yourGoal: "🎯 Your Goal",
        goalHint: "Enter your main goal here — describe what you want to achieve.",
        overview: "3-Month Overview", dailyTemplate: "Daily Template (1.5–2 hours)",
        progress: "Your Progress", daysCompleted: "Days completed", learningProg: "Learning Progress",
        monthlyPlans: "Monthly Plans", addMonth: "+ Add Month", addBlock: "+ Add Overview Block",
        addTask: "+ Add Task", documents: "Documents", favorites: "Favorites", shared: "Shared Documents",
        new: "+ New", selectItems: "Select Items", grid: "Grid", list: "List",
        creationDate: "Creation Date", lastModified: "Last Modified", name: "Name", type: "Type",
        promptDays: "How many days for this new month?", promptMonthDays: "How many days should Month {m} have?",
        promptRestructure: "Reducing days will delete data on extra days. Proceed?",
        untitledNB: "Untitled Notebook", notebook: "Notebook", textDoc: "Text Document"
    },
    pt: {
        confirmMsg: "Alterar o idioma para Português? Textos personalizados serão mantidos.",
        month: "Mês", week: "Semana", activity: "Atividade", dailyAct: "Atividade Diária",
        studyTopic: "Tópico de Estudo", editDetails: "Editar detalhes", phase: "Fase", 
        editFocus: "Editar foco...", editTask: "Editar descrição da tarefa...",
        personalPlanner: "Planejador de Estudos Pessoal", roadmap: "Seu Roteiro",
        roadmapSub: "Duração Personalizada · Metas Diárias · Seu Foco", yourGoal: "🎯 Sua Meta",
        goalHint: "Insira sua meta principal aqui — descreva o que deseja alcançar.",
        overview: "Visão Geral de 3 Meses", dailyTemplate: "Modelo Diário (1.5–2 horas)",
        progress: "Seu Progresso", daysCompleted: "Dias concluídos", learningProg: "Progresso de Aprendizado",
        monthlyPlans: "Planos Mensais", addMonth: "+ Adicionar Mês", addBlock: "+ Adicionar Bloco de Visão Geral",
        addTask: "+ Adicionar Tarefa", documents: "Documentos", favorites: "Favoritos", shared: "Documentos Compartilhados",
        new: "+ Novo", selectItems: "Selecionar Itens", grid: "Grade", list: "Lista",
        creationDate: "Data de Criação", lastModified: "Última Modificação", name: "Nome", type: "Tipo",
        promptDays: "Quantos dias para este novo mês?", promptMonthDays: "Quantos dias o Mês {m} deve ter?",
        promptRestructure: "Reduzir dias excluirá dados dos dias extras. Prosseguir?",
        untitledNB: "Caderno sem Título", notebook: "Caderno", textDoc: "Documento de Texto"
    },
    es: {
        confirmMsg: "¿Cambiar el idioma a Español? Los textos personalizados se mantendrán.",
        month: "Mes", week: "Semana", activity: "Actividad", dailyAct: "Actividad Diaria",
        studyTopic: "Tema de Estudio", editDetails: "Editar detalles", phase: "Fase", 
        editFocus: "Editar enfoque...", editTask: "Editar descripción de tarea...",
        personalPlanner: "Planificador de Estudios Personal", roadmap: "Tu Hoja de Ruta",
        roadmapSub: "Duración Personalizada · Metas Diarias · Tu Enfoque", yourGoal: "🎯 Tu Meta",
        goalHint: "Ingresa tu meta principal aquí — describe lo que quieres lograr.",
        overview: "Resumen de 3 Meses", dailyTemplate: "Plantilla Diaria (1.5–2 horas)",
        progress: "Tu Progreso", daysCompleted: "Días completados", learningProg: "Progreso de Aprendizaje",
        monthlyPlans: "Planes Mensuales", addMonth: "+ Añadir Mes", addBlock: "+ Añadir Bloque de Resumen",
        addTask: "+ Añadir Tarea", documents: "Documentos", favorites: "Favoritos", shared: "Documentos Compartidos",
        new: "+ Nuevo", selectItems: "Seleccionar Ítems", grid: "Cuadrícula", list: "Lista",
        creationDate: "Fecha de Creación", lastModified: "Última Modificación", name: "Nombre", type: "Tipo",
        promptDays: "¿Cuántos días para este nuevo mes?", promptMonthDays: "¿Cuántos días deve tener el Mes {m}?",
        promptRestructure: "Reducir días eliminará datos de los días extras. ¿Continuar?",
        untitledNB: "Cuaderno sin Título", notebook: "Cuaderno", textDoc: "Documento de Texto"
    },
    fr: {
        confirmMsg: "Changer la langue en Français ? Les textes personnalisés seront conservés.",
        month: "Mois", week: "Semaine", activity: "Activité", dailyAct: "Activité Quotidienne",
        studyTopic: "Sujet d'Étude", editDetails: "Modifier les détails", phase: "Phase", 
        editFocus: "Modifier le focus...", editTask: "Modifier la description...",
        personalPlanner: "Planificateur d'Études Personnel", roadmap: "Votre Feuille de Route",
        roadmapSub: "Durée Personnalisée · Objectifs Quotidiens · Votre Focus", yourGoal: "🎯 Votre Objectif",
        goalHint: "Entrez votre objectif principal ici — décrivez ce que vous voulez accomplir.",
        overview: "Aperçu de 3 Mois", dailyTemplate: "Modèle Quotidien (1.5–2 heures)",
        progress: "Votre Progrès", daysCompleted: "Jours complétés", learningProg: "Progrès d'Apprentissage",
        monthlyPlans: "Plans Mensuels", addMonth: "+ Ajouter Mois", addBlock: "+ Ajouter un bloc d'aperçu",
        addTask: "+ Ajouter une tâche", documents: "Documents", favorites: "Favoris", shared: "Documents Partagés",
        new: "+ Nouveau", selectItems: "Sélectionner des éléments", grid: "Grille", list: "Liste",
        creationDate: "Date de Création", lastModified: "Dernière Modification", name: "Nom", type: "Type",
        promptDays: "Combien de jours para ce nouveau mois?", promptMonthDays: "Combien de jours le Mois {m} doit-il avoir?",
        promptRestructure: "Réduire les jours supprimera les données des jours supplémentaires. Continuer?",
        untitledNB: "Carnet sans titre", notebook: "Carnet", textDoc: "Document Texte"
    }
};
// Torna o dicionário acessível globalmente para outros arquivos
window.translations = translations;
window.isNativeText = isNativeText;


function isNativeText(text) {
    // Se o valor for nulo, indefinido ou NÃO for uma string (como os arrays de IDs), ignoramos.
    if (!text || typeof text !== 'string') return false; 
    
    const flat = [];
    Object.values(translations).forEach(l => Object.values(l).forEach(v => {
        if (typeof v === 'string') flat.push(v.toLowerCase());
    }));

    const extraDefaults = [
        "personal study planner", "planejador de estudos pessoal", "planificador de estudios personal", "planificateur d'études personnel",
        "your roadmap", "seu roteiro", "tu hoja de ruta", "votre feuille de route",
        "overview", "visão geral", "resumen", "aperçu",
        "phase 1", "phase 2", "phase 3", "phase x",
        "fase 1", "fase 2", "fase 3", "fase x",
        "edit focus...", "editar foco...", "editar enfoque...", "modifier le focus...",
        "edit task description...", "editar descrição da tarefa...", "editar descripción de tarea...", "modifier la description..."
    ];
    
    return flat.includes(text.toLowerCase()) || extraDefaults.includes(text.toLowerCase());
}

// --- MOBILE MENU SYSTEM ---
function toggleMobileMenu() {
    const sidebar = document.getElementById('notes-sidebar');
    const overlay = document.getElementById('sidebar-mobile-overlay');
    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('mobile-open');
    overlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
    overlay.classList.toggle('active');
}

function closeMobileMenu() {
    const sidebar = document.getElementById('notes-sidebar');
    const overlay = document.getElementById('sidebar-mobile-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
    }
}

// Função para atualizar textos globais (Metas, Títulos, Overview) no DOM
function refreshGlobalDOM(content, targetPrefix = "", langCode = 'en') {
    const data = content || {};
    const t = translations[langCode] || translations.en;
    
    const mapping = {
        "global-cover-eye": t.personalPlanner,
        "global-cover-title": t.roadmap,
        "global-cover-sub": t.roadmapSub,
        "global-goal-strong": t.yourGoal,
        "global-goal-text": t.goalHint,
        "global-sec-overview": t.overview,
        "global-sec-template": t.dailyTemplate,
        "global-sec-progress": t.progress,
        "global-prog-lbl": t.daysCompleted,
        "global-mstat": t.learningProg,
        "global-sec-monthly": t.monthlyPlans,
        "addMonthBtn": t.addMonth,
        "addOverviewBlockBtn": t.addBlock,
        "addTemplateRowBtn": t.addTask,
        "main-new-btn": t.new
    };

    const parent = targetPrefix ? document.getElementById('previewSandbox') : document;
    if (!parent) return;

    Object.keys(mapping).forEach(id => {
        const el = parent.querySelector(`#${targetPrefix}${id}`);
        if (el) {
            const cleanId = id.replace('global-', '');
            const val = data[cleanId];
            if (isNativeText(val) || !val || id.includes('Btn') || id.includes('sec-')) {
                el.innerHTML = mapping[id];
            }
        }
    });

    const uid = auth.currentUser ? auth.currentUser.uid : "preview-user";
    // Passamos o langCode para as funções de renderização
    renderDynamicOverviewBlocks(uid, targetPrefix, data, langCode);
    renderDailyTemplate(uid, targetPrefix, data, langCode);
}
async function applyLanguage(langCode, uid, userData) {
    const dict = translations[langCode];
    if (!dict) return;
    userData.state.language = langCode;
    await saveUserData(uid);
    forceTranslateAll(langCode); // Isso garante que os dados salvos também sejam traduzidos
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen) loginScreen.style.display = "none";
        const plannerEl = document.getElementById("planner");
        if (plannerEl) plannerEl.style.display = "flex";
        
        const userData = await loadUserData(currentUser);

        // --- LÓGICA DE USERNAME ---
        const savedLang = userData.state.language || 'en';
        // We don't call applyLanguage here to avoid loop, 
        // static UI elements will be handled by the initial renderStructure if needed,
        // but since applyLanguage reloads the page, the HTML will be translated once.
        if (!userData.state.customName && !userData.state.namePrompted) {
            const nameInput = prompt("How would you like to be called?");
            userData.state.customName = (nameInput && nameInput.trim() !== "") ? nameInput : user.email;
            userData.state.namePrompted = true;
            saveUserData(currentUser);
        }
        
        const topbarNameEl = document.getElementById("topbarName");
        if (topbarNameEl) topbarNameEl.textContent = userData.state.customName || user.email;

        const changeNameBtn = document.getElementById('changeNameBtn');
        if (changeNameBtn) {
            changeNameBtn.onclick = () => {
                const currentName = topbarNameEl ? topbarNameEl.textContent : (userData.state.customName || user.email);
                const newName = prompt("Enter your new display name:", currentName);
                if (newName && newName.trim() !== "") {
                    userData.state.customName = newName;
                    if (topbarNameEl) topbarNameEl.textContent = newName;
                    saveUserData(currentUser);
                }
            };
        }

        // --- ACCOUNT MANAGEMENT LOGIC ---
        const accountModal = document.getElementById('accountManagementModal');
        const manageAccountBtn = document.getElementById('manageAccountBtn');
        const closeAccountModal = document.getElementById('closeAccountModal');
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');

        if (manageAccountBtn) {
            manageAccountBtn.onclick = () => {
                const settingsDrawer = document.getElementById('settingsDrawer');
                if (settingsDrawer) settingsDrawer.classList.remove('open');
                if (accountModal) accountModal.style.display = 'flex';
            };
        }

        if (closeAccountModal) {
            closeAccountModal.onclick = () => {
                if (accountModal) accountModal.style.display = 'none';
            };
        }

        if (deleteAccountBtn) {
            deleteAccountBtn.onclick = async () => {
                const confirmation = confirm("ARE YOU ABSOLUTELY SURE?\n\nThis will delete your entire study progress and your account permanently. This action is irreversible.");
                if (confirmation) {
                    const finalCheck = prompt("To confirm deletion, type the word 'DELETE' below:");
                    if (finalCheck === "DELETE") {
                        try {
                            await deleteDoc(doc(db, "users", currentUser));
                            const userAuth = auth.currentUser;
                            await deleteUser(userAuth);
                            alert("Your account and all data have been successfully deleted.");
                            window.location.reload();
                        } catch (error) {
                            console.error("Error deleting account:", error);
                            if (error.code === 'auth/requires-recent-login') {
                                alert("For security reasons, you need to have logged in recently to delete your account. Please logout and login again, then try this action again.");
                            } else {
                                alert("An error occurred while deleting your account. Please try again later.");
                            }
                        }
                    } else {
                        alert("Confirmation word incorrect. Deletion cancelled.");
                    }
                }
            };
        }

        // --- ACORDION DE IDIOMA ---
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.onclick = () => {
                const wrapper = document.getElementById('langWrapper');
                const arrow = document.getElementById('langArrow');
                if (!wrapper || !arrow) return;
                const isHidden = wrapper.style.display === 'none';
                wrapper.style.display = isHidden ? 'block' : 'none';
                arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };
        }

        const langOptions = document.querySelectorAll('.lang-opt');
        if (langOptions.length > 0) {
            langOptions.forEach(btn => {
                btn.onclick = async () => {
                    const lang = btn.dataset.lang; // Pega o código do idioma (en, pt, es, fr)
                    const dict = translations[lang] || translations.en; // Pega o dicionário correspondente
                    
                    // Corrigido: Usamos a variável 'lang' que acabamos de definir
                    if (confirm(dict.confirmMsg)) {
                        await applyLanguage(lang, currentUser, userData);
                    }
                };
            });
        }

        // --- RENDERIZAÇÃO INICIAL ---
        const currentLang = userData.state.language || 'en';
        
        // 1. Limpa os containers para evitar sobreposição com o HTML estático
        const ovGrid = document.getElementById('dynamic-ov-grid');
        const tplList = document.getElementById('dynamic-tpl-list');
        if (ovGrid) ovGrid.innerHTML = '';
        if (tplList) tplList.innerHTML = '';

        // 2. Renderiza a estrutura e os textos do backup
        renderStructure(userData.plannerConfig, false, (m, w) => buildWeek(m, w, currentUser), false, "", currentLang);
        refreshGlobalDOM(userData.pageContent, "", currentLang);
        
        // --- FLOATING ACTION BUTTON LOGIC ---
        const fabWrapper = document.getElementById('fabWrapper');
        const fabMain = document.getElementById('fabMain');
        if (fabMain && fabWrapper) {
            fabMain.onclick = (e) => {
                e.stopPropagation();
                // If edit mode is active, prevent closing
                if (document.getElementById('saveChangesBtn')?.style.display === 'flex') {
                    fabWrapper.classList.add('open');
                    return;
                }
                fabWrapper.classList.toggle('open');
            };

            document.addEventListener('click', (e) => {
                // If editing, ignore outside clicks to keep FAB open
                if (document.getElementById('saveChangesBtn')?.style.display === 'flex') return;

                if (fabWrapper.classList.contains('open') && !fabWrapper.contains(e.target)) {
                    fabWrapper.classList.remove('open');
                }
            });

            document.querySelectorAll('.fab-item').forEach(item => {
                item.addEventListener('click', () => {
                    // Only close on click if NOT in edit mode
                    if (document.getElementById('saveChangesBtn')?.style.display !== 'flex') {
                        fabWrapper.classList.remove('open');
                    }
                });
            });
        }
        // --- BOTÕES DA TOPBAR E FAB ITEMS ---
        const editModeBtn = document.getElementById('editModeBtn');
        if (editModeBtn) editModeBtn.onclick = () => toggleEditMode(currentUser);

        // --- NOTES SYSTEM UI LOGIC ---
        const notesArea = document.getElementById('notes-area');
        const notesSidebar = document.getElementById('notes-sidebar');
        const plannerContent = document.getElementById('planner-content');
        const openNotesBtn = document.getElementById('openNotesBtn');
        const sidebarToggle = document.getElementById('sidebar-toggle-btn');

        if (openNotesBtn) {
            openNotesBtn.onclick = () => {
                if (!notesArea || !notesSidebar || !plannerContent) return;
                const isNotesOpen = notesArea.style.display === 'flex';
                const fabLabel = openNotesBtn.querySelector('.fab-label');
                const fabIcon = openNotesBtn.querySelector('.fab-icon');

                if (!isNotesOpen) {
                    // Abrir Notas
                    notesArea.style.setProperty('display', 'flex', 'important');
                    notesArea.style.flexDirection = 'column';
                    notesSidebar.style.display = 'flex';
                    plannerContent.style.display = 'none';
                    
                    if (fabLabel) fabLabel.textContent = "Back to Planner";
                    if (fabIcon) fabIcon.textContent = "📅";
                    
                    renderLibrary();
                } else {
                    // Voltar ao Planner
                    notesArea.style.display = 'none';
                    notesSidebar.style.display = 'none';
                    plannerContent.style.display = 'block';
                    
                    if (fabLabel) fabLabel.textContent = "Notes & Library";
                    if (fabIcon) fabIcon.textContent = "📓";
                }
            };
        }

        const closeNotesBtn = document.getElementById('close-notes-btn');
        if (closeNotesBtn) {
            closeNotesBtn.onclick = () => {
                if (notesArea) notesArea.style.display = 'none';
                if (notesSidebar) notesSidebar.style.display = 'none';
                if (plannerContent) {
                    plannerContent.style.display = 'block';
                    plannerContent.scrollTop = 0;
                }
                
                if (openNotesBtn) {
                    const fabLabel = openNotesBtn.querySelector('.fab-label');
                    const fabIcon = openNotesBtn.querySelector('.fab-icon');
                    if (fabLabel) fabLabel.textContent = "Notes & Library";
                    if (fabIcon) fabIcon.textContent = "📓";
                }
            };
        }

        if (sidebarToggle && notesSidebar) {
            sidebarToggle.onclick = (e) => {
                e.stopPropagation();
                notesSidebar.classList.toggle('collapsed');
            };
        }

        // Mobile Menu Listeners
        const mobLibBtn = document.getElementById('mobile-lib-menu-btn');
        const mobPlanBtn = document.getElementById('mobile-planner-menu-btn');
        const mobOverlay = document.getElementById('sidebar-mobile-overlay');

        if (mobLibBtn) {
            mobLibBtn.onclick = (e) => { e.stopPropagation(); toggleMobileMenu(); };
        }
        if (mobPlanBtn) {
            mobPlanBtn.onclick = (e) => { e.stopPropagation(); toggleMobileMenu(); };
        }
        if (mobOverlay) {
            mobOverlay.onclick = (e) => { e.stopPropagation(); closeMobileMenu(); };
        }

        // Close menu when clicking any link inside sidebar on mobile
        const sidebarNavBtns = document.querySelectorAll('.snav-btn');
        if (sidebarNavBtns.length > 0) {
            sidebarNavBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (window.innerWidth <= 768) closeMobileMenu();
                });
            });
        }
        
        // --- END OF NOTES SYSTEM UI LOGIC ---
        
        const saveChangesBtn = document.getElementById('saveChangesBtn');
        if (saveChangesBtn) saveChangesBtn.onclick = () => toggleEditMode(currentUser);

        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) cancelEditBtn.onclick = () => cancelEdit(currentUser);

        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) undoBtn.onclick = () => performUndo(currentUser);

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
        
        const switchBtn = document.getElementById('switchAccountBtn');
        if (switchBtn) {
            switchBtn.onclick = () => {
                provider.setCustomParameters({ prompt: 'select_account' });
                signInWithPopup(auth, provider).catch((error) => {
                    console.error("Error switching account:", error);
                });
            };
        }

        // --- EXPORT / IMPORT SYSTEM ---
        const importInput = document.getElementById('importFileInput');
        const exportDataBtn = document.getElementById('exportDataBtn');
        if (exportDataBtn) exportDataBtn.onclick = () => exportData();
        const importDataBtn = document.getElementById('importDataBtn');
        if (importDataBtn && importInput) importDataBtn.onclick = () => importInput.click();

        if (importInput) {
            importInput.onchange = async (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const confirmation = confirm("Importing will overwrite your current planner with data from '" + file.name + "'. A backup of your current progress will be saved in 'Import History'. Continue?");
                    if (confirmation) {
                        try {
                            const success = await importData(file, currentUser);
                            if (success) {
                                alert("Data imported successfully!");
                                window.location.reload();
                            }
                        } catch (err) { 
                            console.error("Import failed:", err);
                            alert("Import failed: " + err.message); 
                            importInput.value = "";
                        }
                    } else {
                        importInput.value = "";
                    }
                }
            };
        }

        // --- HISTÓRICO DE IMPORTAÇÕES & PREVIEW SANDBOX ---
        const historyModal = document.getElementById('importHistoryModal');
        const historyList = document.getElementById('importHistoryList');

        const importHistoryBtn = document.getElementById('importHistoryBtn');
        if (importHistoryBtn) {
            importHistoryBtn.onclick = () => {
                renderImportHistory();
                if (historyModal) historyModal.style.display = 'flex';
            };
        }

        const closeHistoryModal = document.getElementById('closeHistoryModal');
        if (closeHistoryModal) {
            closeHistoryModal.onclick = () => {
                if (historyModal) historyModal.style.display = 'none';
            };
        }
        
        const undoLastImportBtn = document.getElementById('undoLastImportBtn');
        if (undoLastImportBtn) {
            undoLastImportBtn.onclick = async () => {
                if (importHistory.length > 0) {
                    const lastBackup = importHistory[0];
                    if (confirm(`Restore to ${new Date(lastBackup.timestamp).toLocaleString()}?`)) {
                        await importData(lastBackup, currentUser, true);
                        await deleteImportBackup(currentUser, lastBackup.id);
                        window.location.reload();
                    }
                }
            };
        }

        function renderImportHistory() {
            const undoLastBtn = document.getElementById('undoLastImportBtn');
            if (undoLastBtn) undoLastBtn.style.display = importHistory.length > 0 ? 'block' : 'none';
            if (historyList) {
                historyList.innerHTML = importHistory.length === 0 ? 
                    '<p style="text-align:center; padding:20px; color:var(--muted); font-size:0.8rem;">No backups found.</p>' : '';
                
                importHistory.forEach(backup => {
                    const card = document.createElement('div');
                    card.className = 'import-backup-card';
                    card.innerHTML = `
                        <div class="backup-info">
                            <span class="backup-date">Backup: ${backup.filename}</span>
                            <span class="backup-meta">${new Date(backup.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="backup-actions">
                            <button class="btn-undo-import">Restore</button>
                            <button class="btn-preview">Preview Box</button>
                            <button class="btn-delete-backup">✕</button>
                        </div>
                    `;
                    
                    card.querySelector('.btn-undo-import').onclick = async () => {
                        if (confirm("Restore this version?")) {
                            await importData(backup, currentUser, true);
                            window.location.reload();
                        }
                    };

                    card.querySelector('.btn-preview').onclick = () => {
                        const sandbox = document.getElementById('previewSandbox');
                        const backupContent = backup.pageContent || {};
                        const backupState = backup.state || {};
                        
                        const sandboxTitle = document.getElementById('sandboxTitle');
                        if (sandboxTitle) sandboxTitle.textContent = `Preview: ${backup.filename}`;
                        
                        refreshGlobalDOM(backupContent, "sb-");

                        const sbCover = document.getElementById('sb-page-cover');
                        if (sbCover) sbCover.style.background = backupState.settings?.coverColor || "#f4f1ea";

                        updateProgressBar("sb-", backup.plannerConfig, backupState);

                        renderStructure(backup.plannerConfig, false, (m, w, isPrev, prefix) => {
    import('./planner.js').then(mod => mod.buildWeek(m, w, auth.currentUser.uid, [], true, prefix, backup.plannerConfig, backupState));
}, true, "sb-");
                        if (historyModal) historyModal.style.display = 'none';
                        if (sandbox) sandbox.style.display = 'flex';
                        document.body.classList.add('preview-open');

                        const restoreSandboxBtn = document.getElementById('restoreSandboxBtn');
                        if (restoreSandboxBtn) {
                            restoreSandboxBtn.onclick = async () => {
                                if(confirm("Restore this version?")) {
                                    await importData(backup, currentUser, true);
                                    window.location.reload();
                                }
                            };
                        }
                    };

                    card.querySelector('.btn-delete-backup').onclick = async () => {
                        if(confirm("Delete backup?")) {
                            await deleteImportBackup(currentUser, backup.id);
                            renderImportHistory();
                        }
                    };
                    historyList.appendChild(card);
                });
            }
        }

        const closeSandboxBtn = document.getElementById('closeSandboxBtn');
        if (closeSandboxBtn) {
            closeSandboxBtn.onclick = () => {
                const sandbox = document.getElementById('previewSandbox');
                if (sandbox) sandbox.style.display = 'none';
                document.body.classList.remove('preview-open');
                if (historyModal) historyModal.style.display = 'flex';
            };
        }

        // --- LÓGICA DO COLOR PICKER ---
        const editCoverBtn = document.getElementById('editCoverBtn');
        const colorMenu = document.getElementById('colorChoiceMenu');
        let colorHistory = userData.state.colorHistory || { solids: [], gradients: [], pinned: [] };
        
        const iroPicker = new iro.ColorPicker("#iroPicker", {
            width: 180,
            layout: [{ component: iro.ui.Wheel }, { component: iro.ui.Slider, options: { sliderType: 'value' } }]
        });

        let pickingGradient = false;
        let color1 = null;

        if (editCoverBtn) {
            editCoverBtn.onclick = (e) => {
                e.stopPropagation();
                if (colorMenu) colorMenu.style.display = (colorMenu.style.display === 'flex') ? 'none' : 'flex';
            };
        }

        const choiceSolid = document.getElementById('choiceSolid');
        if (choiceSolid) {
            choiceSolid.onclick = () => {
                pickingGradient = false; color1 = null;
                const pickerTitle = document.getElementById('pickerActionTitle');
                if (pickerTitle) pickerTitle.textContent = "Select Color";
                if (colorMenu) colorMenu.style.display = 'none'; 
                openPicker();
            };
        }

        const choiceGradient = document.getElementById('choiceGradient');
        if (choiceGradient) {
            choiceGradient.onclick = () => {
                pickingGradient = true; color1 = null;
                const pickerTitle = document.getElementById('pickerActionTitle');
                if (pickerTitle) pickerTitle.textContent = "Select Color 1";
                if (colorMenu) colorMenu.style.display = 'none'; 
                openPicker();
            };
        }

        const choiceCancel = document.getElementById('choiceCancel');
        if (choiceCancel) {
            choiceCancel.onclick = () => { if (colorMenu) colorMenu.style.display = 'none'; };
        }
        
        document.addEventListener('click', (e) => {
                // Se o botão de salvar estiver visível, não permitimos fechar o menu ao clicar fora.
                if (document.getElementById('saveChangesBtn')?.style.display === 'flex') return;

                if (fabWrapper.classList.contains('open') && !fabWrapper.contains(e.target)) {
                    fabWrapper.classList.remove('open');
                }
            });
        
        function openPicker() {
            renderHistoryUI();
            const pickerContainer = document.getElementById('colorPickerContainer');
            const pickerOverlay = document.getElementById('pickerOverlay');
            if (pickerContainer) pickerContainer.classList.add('open');
            if (pickerOverlay) pickerOverlay.classList.add('open');
        }

        function closePicker() {
            const pickerContainer = document.getElementById('colorPickerContainer');
            const pickerOverlay = document.getElementById('pickerOverlay');
            if (pickerContainer) pickerContainer.classList.remove('open');
            if (pickerOverlay) pickerOverlay.classList.remove('open');
        }

        const btnCancelPicker = document.getElementById('btnCancelPicker');
        if (btnCancelPicker) btnCancelPicker.onclick = closePicker;

        const btnApplyPicker = document.getElementById('btnApplyPicker');
        if (btnApplyPicker) {
            btnApplyPicker.onclick = () => {
                const selectedColor = iroPicker.color.hexString;
                if (!pickingGradient) {
                    applySolid(selectedColor);
                } else {
                    if (color1 === null) {
                        color1 = selectedColor;
                        const pickerTitle = document.getElementById('pickerActionTitle');
                        if (pickerTitle) pickerTitle.textContent = "Select Color 2";
                        const coverEl = document.getElementById('page-cover');
                        if (coverEl) coverEl.style.background = color1;
                    } else {
                        applyGradient(color1, selectedColor);
                    }
                }
            };
        }

        function applySolid(color) {
            const coverEl = document.getElementById('page-cover');
            if (coverEl) coverEl.style.background = color;
            if (!colorHistory.solids.includes(color)) {
                colorHistory.solids.unshift(color);
                if (colorHistory.solids.length > 3) colorHistory.solids.pop();
            }
            saveAllColorData(color);
            closePicker();
        }

        function applyGradient(c1, c2) {
            const grad = `linear-gradient(135deg, ${c1}, ${c2})`;
            const coverEl = document.getElementById('page-cover');
            if (coverEl) coverEl.style.background = grad;
            const exists = colorHistory.gradients.some(g => g.c1 === c1 && g.c2 === c2);
            if (!exists) {
                colorHistory.gradients.unshift({ c1, c2 });
                if (colorHistory.gradients.length > 3) colorHistory.gradients.pop();
            }
            saveAllColorData(grad);
            closePicker();
        }

        function saveAllColorData(lastValue) {
            if(!userData.state.settings) userData.state.settings = {};
            userData.state.settings.coverColor = lastValue;
            userData.state.colorHistory = colorHistory;
            saveUserData(currentUser);
        }

        function renderHistoryUI() {
            const solidContainer = document.getElementById('historySolids');
            const gradContainer = document.getElementById('historyGradients');
            const pinnedContainer = document.getElementById('pinnedGradients');
            if (solidContainer) {
                solidContainer.innerHTML = '';
                colorHistory.solids.forEach(color => {
                    const div = document.createElement('div');
                    div.style.cssText = `width:22px; height:22px; border-radius:50%; background:${color}; cursor:pointer; border:1.5px solid #eee;`;
                    div.onclick = () => applySolid(color);
                    solidContainer.appendChild(div);
                });
            }
            if (gradContainer) {
                gradContainer.innerHTML = '';
                colorHistory.gradients.forEach((g) => {
                    const row = document.createElement('div');
                    row.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:4px;";
                    row.innerHTML = `<div style="flex:1; height:18px; border-radius:4px; background:linear-gradient(90deg, ${g.c1}, ${g.c2}); cursor:pointer; border:1px solid #ddd;"></div><span title="Pin" style="cursor:pointer; font-size:12px;">📌</span>`;
                    row.querySelector('div').onclick = () => applyGradient(g.c1, g.c2);
                    row.querySelector('span').onclick = () => {
                        if (colorHistory.pinned.length < 2) {
                            colorHistory.pinned.push(g);
                            const currentCoverBg = document.getElementById('page-cover')?.style.background;
                            saveAllColorData(currentCoverBg);
                            renderHistoryUI();
                        }
                    };
                    gradContainer.appendChild(row);
                });
            }
            if (pinnedContainer) {
                pinnedContainer.innerHTML = '';
                colorHistory.pinned.forEach((g, idx) => {
                    const row = document.createElement('div');
                    row.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:4px;";
                    row.innerHTML = `<div style="flex:1; height:18px; border-radius:4px; background:linear-gradient(90deg, ${g.c1}, ${g.c2}); cursor:pointer; border:1px solid var(--accent);"></div><span title="Unpin" style="cursor:pointer; font-size:12px; color:#cc0000;">✕</span>`;
                    row.querySelector('div').onclick = () => applyGradient(g.c1, g.c2);
                    row.querySelector('span').onclick = () => {
                        colorHistory.pinned.splice(idx, 1);
                        const currentCoverBg = document.getElementById('page-cover')?.style.background;
                        saveAllColorData(currentCoverBg);
                        renderHistoryUI();
                    };
                    pinnedContainer.appendChild(row);
                });
            }
        }

        const coverEl = document.getElementById('page-cover');
        if(userData.state.settings?.coverColor && coverEl) {
            coverEl.style.background = userData.state.settings.coverColor;
        }

        // --- GAVETAS E PERSONALIZAÇÃO ---
        const personalizeBtn = document.getElementById('personalizeBtn');
        const customDrawer = document.getElementById('customDrawer');
        const closeDrawer = document.getElementById('closeDrawer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDrawer = document.getElementById('settingsDrawer');
        const closeSettings = document.getElementById('closeSettings');

        if (personalizeBtn) {
            personalizeBtn.onclick = () => {
                if (!document.body.classList.contains('preview-mode')) {
                    if (settingsDrawer) settingsDrawer.classList.remove('open');
                    if (customDrawer) customDrawer.classList.add('open');
                    if (fabWrapper) fabWrapper.classList.add('fab-hidden');
                }
            };
        }
        if (settingsBtn) {
            settingsBtn.onclick = () => {
                if (!document.body.classList.contains('preview-mode')) {
                    if (customDrawer) customDrawer.classList.remove('open');
                    if (settingsDrawer) settingsDrawer.classList.add('open');
                    if (fabWrapper) fabWrapper.classList.add('fab-hidden');
                    renderHistory();
                }
            };
        }
        if (closeDrawer) {
            closeDrawer.onclick = () => {
                if (customDrawer) customDrawer.classList.remove('open');
                if (fabWrapper) fabWrapper.classList.remove('fab-hidden');
            };
        }
        if (closeSettings) {
            closeSettings.onclick = () => {
                if (settingsDrawer) settingsDrawer.classList.remove('open');
                if (fabWrapper) fabWrapper.classList.remove('fab-hidden');
            };
        }

        const googleFonts = ["Arial", "Verdana", "Georgia", "Bebas Neue", "Montserrat", "Open Sans", "Roboto", "Jost", "Playfair Display", "Dancing Script", "Pacifico"];
        const fontListContainer = document.getElementById('fontList');
        const fontSearchInput = document.getElementById('fontSearchInput');

        function loadGoogleFont(fontName) {
            if (["Arial", "Verdana", "Georgia"].includes(fontName)) return;
            const id = `font-${fontName.replace(/\s+/g, '-')}`;
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id; link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
                document.head.appendChild(link);
            }
        }

        function renderFonts(filter = "") {
            if (!fontListContainer) return;
            fontListContainer.innerHTML = "";
            googleFonts.filter(f => f.toLowerCase().includes(filter.toLowerCase())).forEach(font => {
                const div = document.createElement('div');
                div.className = 'font-item';
                div.textContent = font;
                loadGoogleFont(font);
                div.style.fontFamily = `"${font}", sans-serif`;
                div.onclick = () => {
                    document.documentElement.style.setProperty('--main-font', `"${font}", sans-serif`);
                    if (!userData.state.settings) userData.state.settings = {};
                    userData.state.settings.font = font;
                    saveUserData(currentUser);
                };
                fontListContainer.appendChild(div);
            });
        }
        if (fontSearchInput) fontSearchInput.oninput = (e) => renderFonts(e.target.value);
        renderFonts();

        const fontSizeSlider = document.getElementById('fontSizeSlider');
        if (userData.state.settings?.font) {
            loadGoogleFont(userData.state.settings.font);
            document.documentElement.style.setProperty('--main-font', `"${userData.state.settings.font}", sans-serif`);
        }
        if (fontSizeSlider) {
            fontSizeSlider.value = userData.state.settings?.fontSize || "15";
            const fontSizeVal = document.getElementById('fontSizeVal');
            if (fontSizeVal) fontSizeVal.textContent = fontSizeSlider.value + "px";
            document.documentElement.style.setProperty('--main-font-size', fontSizeSlider.value + "px");

            fontSizeSlider.oninput = (e) => {
                if (fontSizeVal) fontSizeVal.textContent = e.target.value + "px";
                document.documentElement.style.setProperty('--main-font-size', e.target.value + "px");
            };
            fontSizeSlider.onchange = (e) => {
                if (!userData.state.settings) userData.state.settings = {};
                userData.state.settings.fontSize = e.target.value;
                saveUserData(currentUser);
            };
        }

        const fontStyleToggle = document.getElementById('fontStyleToggle');
        if (fontStyleToggle) {
            fontStyleToggle.onclick = () => {
                const wrapper = document.getElementById('fontPickerWrapper');
                const arrow = document.getElementById('fontArrow');
                if (!wrapper || !arrow) return;
                const isHidden = wrapper.style.display === 'none';
                wrapper.style.display = isHidden ? 'block' : 'none';
                arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };
        }

        function renderHistory() {
            const container = document.getElementById('historyList');
            if (!container) return;
            import('./storage.js').then(store => {
                container.innerHTML = store.history.length === 0 ? '<p style="font-size:0.7rem; color:var(--muted); padding:10px;">No history.</p>' : '';
                store.history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <span class="history-date">${new Date(item.timestamp).toLocaleString()}</span>
                        <strong style="font-size:0.8rem">${item.label}</strong>
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <button class="history-restore" style="flex:1; cursor:pointer;">Restore</button>
                            <button class="history-del">✕</button>
                        </div>`;
                    div.querySelector('.history-restore').onclick = async () => { if(confirm("Restore?")) { applySnapshot(item.plannerConfig, item.pageContent); await saveUserData(currentUser); window.location.reload(); } };
                    div.querySelector('.history-del').onclick = async () => { if(confirm("Delete?")) { await deleteHistoryEntry(currentUser, item.id); renderHistory(); } };
                    container.appendChild(div);
                });
            });
        }

        const addMonthBtn = document.getElementById('addMonthBtn');
        if (addMonthBtn) {
            addMonthBtn.onclick = (e) => {
                e.preventDefault(); addNewMonth(currentUser);
            };
        }

        const addOverviewBlockBtn = document.getElementById('addOverviewBlockBtn');
        if (addOverviewBlockBtn) {
            addOverviewBlockBtn.onclick = (e) => {
                e.preventDefault(); addOverviewBlock(currentUser);
            };
        }

        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.onclick = async () => {
                if(confirm("Permanently delete ALL history?")) {
                    await clearAllHistory(currentUser);
                    renderHistory();
                }
            };
        }

        renderLibrary();

        // --- NOTES SELECTION EVENT LISTENERS ---
        const btnSelectItems = document.getElementById('btn-select-items');
        if (btnSelectItems) {
            btnSelectItems.onclick = () => {
                import('./notes.js').then(mod => mod.toggleSelectionMode(true));
                const viewMenu = document.getElementById('view-options-menu');
                if (viewMenu) viewMenu.style.display = 'none';
            };
        }

        const btnSelectionDone = document.getElementById('btn-selection-done');
        if (btnSelectionDone) {
            btnSelectionDone.onclick = () => {
                import('./notes.js').then(mod => mod.toggleSelectionMode(false));
            };
        }

        const btnSelectAll = document.getElementById('btn-select-all');
        if (btnSelectAll) {
            btnSelectAll.onclick = () => {
                import('./notes.js').then(mod => mod.selectAllItems());
            };
        }

        const btnTrashSelected = document.getElementById('st-trash');
        if (btnTrashSelected) {
            btnTrashSelected.onclick = () => {
                import('./notes.js').then(mod => mod.deleteSelectedItems());
            };
        }

        // --- VIEW & SORTING LISTENERS ---
        const btnViewGrid = document.getElementById('btn-view-grid');
        const btnViewList = document.getElementById('btn-view-list');
        const sortSelect = document.getElementById('sort-docs-select');

        const updateViewCheckmarks = (mode) => {
            if (btnViewGrid) {
                const check = btnViewGrid.querySelector('.vlist-check');
                if (check) check.style.visibility = mode === 'grid' ? 'visible' : 'hidden';
            }
            if (btnViewList) {
                const check = btnViewList.querySelector('.vlist-check');
                if (check) check.style.visibility = mode === 'list' ? 'visible' : 'hidden';
            }
        };

        if (btnViewGrid) {
            btnViewGrid.onclick = () => {
                import('./notes.js').then(mod => mod.setLibraryLayout('grid'));
                updateViewCheckmarks('grid');
            };
        }

        if (btnViewList) {
            btnViewList.onclick = () => {
                import('./notes.js').then(mod => mod.setLibraryLayout('list'));
                updateViewCheckmarks('list');
            };
        }

        if (sortSelect) {
            sortSelect.onchange = (e) => {
                import('./notes.js').then(mod => mod.setLibrarySort(e.target.value));
            };
        }

        document.querySelectorAll('.sort-opt').forEach(opt => {
            opt.onclick = () => {
                const sortVal = opt.dataset.sort;
                import('./notes.js').then(mod => mod.setLibrarySort(sortVal));
                document.querySelectorAll('.sort-opt .vlist-check').forEach(c => c.style.visibility = 'hidden');
                const currentCheck = opt.querySelector('.vlist-check');
                if (currentCheck) currentCheck.style.visibility = 'visible';
            };
        });

        // --- IMPORT NOTE LOGIC ---
        const btnImportNote = document.getElementById('btn-import-doc');
        if (btnImportNote) {
            btnImportNote.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    if (e.target.files.length > 0) {
                        import('./notes.js').then(mod => mod.importNoteData(e.target.files[0]));
                    }
                };
                input.click();
                const newMenu = document.getElementById('new-options-menu');
                if (newMenu) newMenu.style.display = 'none';
            };
        }

       // --- REAL IMPLEMENTATION OF SELECTION ACTIONS ---
        const btnExportSelected = document.getElementById('st-export');
        if (btnExportSelected) {
            btnExportSelected.onclick = () => {
                import('./notes.js').then(mod => mod.exportSelectedItems());
            };
        }

        const btnMoveSelected = document.getElementById('st-move');
        if (btnMoveSelected) {
            btnMoveSelected.onclick = () => {
                import('./notes.js').then(mod => mod.moveSelectedItems());
            };
        }

       const btnDuplicateSelected = document.getElementById('st-duplicate');
        if (btnDuplicateSelected) {
            btnDuplicateSelected.onclick = () => {
                import('./notes.js').then(mod => mod.duplicateSelectedItems());
            };
        }

        const btnRenameSelected = document.getElementById('st-rename');
        if (btnRenameSelected) {
            btnRenameSelected.onclick = () => {
                import('./notes.js').then(mod => mod.renameSelectedItems());
            };
        }

        updateProgressBar();
        
    } else {
        if (auth.currentUser) window.location.reload();
        const plannerEl = document.getElementById("planner");
        if (plannerEl) plannerEl.style.display = "none";
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen) loginScreen.style.display = "flex";
        if (typeof currentUser !== 'undefined') currentUser = null;
    }
});

const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.onclick = () => signInWithPopup(auth, provider);
}

export function forceTranslateAll(langCode) {
    const t = translations[langCode] || translations.en;
    
    // Dicionário completo de dias para conversão de dados antigos
    const dayNamesDict = {
        en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        pt: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"],
        es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
        fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    };

    if (!dayNamesDict[langCode]) return;

    // 1. Traduzir dias da semana existentes no plannerConfig
    Object.keys(window.plannerConfig).forEach(wkKey => {
        const week = window.plannerConfig[wkKey];
        if (week && week.days) {
            week.days.forEach((day, i) => {
                // Só traduz se o nome atual do dia for um dos nomes padrão (nativos)
                if (isNativeText(day.name)) {
                    day.name = dayNamesDict[langCode][i % 7];
                }
            });
        }
    });

    // 2. Atualizar textos dinâmicos do PageContent que ainda são nativos
    Object.keys(window.pageContent).forEach(id => {
        const currentVal = window.pageContent[id];
        
        // SEGURANÇA: Só tentamos traduzir se o valor for efetivamente uma STRING
        if (typeof currentVal === 'string' && isNativeText(currentVal)) {
            const mapping = {
                "global-cover-eye": t.personalPlanner,
                "global-cover-title": t.roadmap,
                "global-cover-sub": t.roadmapSub,
                "global-goal-strong": t.yourGoal,
                "global-goal-text": t.goalHint,
                "global-sec-overview": t.overview,
                "global-sec-template": t.dailyTemplate,
                "global-prog-lbl": t.daysCompleted,
                "global-mstat": t.learningProg,
                "global-sec-monthly": t.monthlyPlans
            };
            if (mapping[id]) window.pageContent[id] = mapping[id];
        }
    });

    // 3. Salva no Firebase e recarrega a página para aplicar
    saveUserData(currentUser).then(() => {
        console.log("Forced Translation Complete.");
        window.location.reload();
    });
}
