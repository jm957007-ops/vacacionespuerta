import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 1. Ve a https://console.firebase.google.com
// 2. Crea un proyecto nuevo (gratis, plan Spark)
// 3. Dentro del proyecto: "Compilación" > "Firestore Database" > "Crear base de datos"
//    (elige modo de producción, ubicación cercana, ej. us-central)
// 4. En Firestore > Reglas, pega temporalmente esto para pruebas y luego ajusta:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;
//        }
//      }
//    }
// 5. En "Configuración del proyecto" > "Tus apps" > icono Web (</>) registra una app
// 6. Copia el objeto firebaseConfig que te da Firebase y pégalo abajo, reemplazando esto:

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
