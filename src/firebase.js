import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD5QbByeSoejLdJcPuzDaveILlOOspVhrc",
  authDomain: "control-vacaciones-7f9d8.firebaseapp.com",
  projectId: "control-vacaciones-7f9d8",
  storageBucket: "control-vacaciones-7f9d8.firebasestorage.app",
  messagingSenderId: "834860023585",
  appId: "1:834860023585:web:73c9e40e8791ef83e0c860",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
