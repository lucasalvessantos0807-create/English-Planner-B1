import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserProgress } from './storage.js';
import { buildWeek } from './planner.js';
import { setupNavigation, updateProgressBar } from './ui.js';

let currentUser = null;

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("topbarName").textContent = user.displayName;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        await loadUserProgress(currentUser);
        setupNavigation((m, w) => buildWeek(m, w, currentUser));
        buildWeek(1, 1, currentUser);
        updateProgressBar();
    } else {
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
    }
});
