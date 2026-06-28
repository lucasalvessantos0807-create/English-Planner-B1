import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCE4d1pH7qM5X2nqhxqsIbh7qp1bgbwTYc",
  authDomain: "english-planner-a1.firebaseapp.com",
  projectId: "english-planner-a1",
  storageBucket: "english-planner-a1.firebasestorage.app",
  messagingSenderId: "794904439088",
  appId: "1:794904439088:web:daa0ed2bed1506ae2b00f5",
  measurementId: "G-RPDY8X75WV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
window.auth = auth; // Isso permite que o ui.js veja o login
export const provider = new GoogleAuthProvider();

export { doc, getDoc, setDoc, signInWithPopup, signOut, onAuthStateChanged };

import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';
import { loadUserData } from './storage.js';
import { buildWeek, toggleEditMode, addNewMonth } from './planner.js';
import { renderStructure, updateProgressBar } from './ui.js';

let currentUser = null;

document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user.uid;
        document.getElementById("topbarName").textContent = user.displayName;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("planner").style.display = "block";
        
        const userData = await loadUserData(currentUser);
        
        // Renderiza a estrutura de botões e painéis dinamicamente
        renderStructure(userData.plannerConfig, (m, w) => buildWeek(m, w, currentUser));
        
        document.getElementById('editModeBtn').onclick = () => toggleEditMode(currentUser);
        document.getElementById('addMonthBtn').onclick = () => {
            if(confirm("Deseja criar um novo mês (4 semanas) no seu cronograma?")) {
                addNewMonth(currentUser);
            }
        };

        // Carrega automaticamente a primeira semana disponível
        const firstKey = Object.keys(userData.plannerConfig).sort()[0];
        if (firstKey) {
            const [m, w] = firstKey.split('-');
            buildWeek(m, w, currentUser);
        }
        updateProgressBar();
    } else {
        document.getElementById("planner").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
    }
});
