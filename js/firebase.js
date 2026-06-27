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
