# Vacaciones de Controladores de Puerta.

App para coordinar días de vacaciones del equipo sin que se empalmen. Los días ocupados se marcan en rojo, y solo el administrador puede agregar o eliminar compañeros.

## 1. Crear el proyecto de Firebase (gratis)

1. Ve a https://console.firebase.google.com y da clic en "Agregar proyecto".
2. Ponle un nombre (ej. `vacaciones-equipo`) y sigue los pasos (puedes desactivar Google Analytics, no es necesario).
3. Dentro del proyecto, en el menú izquierdo: **Compilación > Firestore Database > Crear base de datos**.
   - Elige modo de producción.
   - Elige una región cercana (ej. `us-central`).
4. Ve a la pestaña **Reglas** de Firestore y pega esto para poder probar (ajusta después si quieres más seguridad):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Ve a **Configuración del proyecto** (ícono de engrane) > **Tus apps** > clic en el ícono web `</>`.
6. Registra la app (el nombre no importa) y copia el objeto `firebaseConfig` que te muestra.
7. Pega ese objeto en `src/firebase.js`, reemplazando los valores de ejemplo (`TU_API_KEY`, etc.).

## 2. Probar localmente (opcional pero recomendado)

Necesitas tener Node.js instalado (https://nodejs.org).

```bash
npm install
npm run dev
```

Abre la URL que te muestre en la terminal (normalmente http://localhost:5173).

## 3. Subir a Netlify

**Opción A — Arrastrar y soltar (más simple):**

```bash
npm install
npm run build
```

Esto crea una carpeta `dist/`. Ve a https://app.netlify.com, entra a tu cuenta, y arrastra la carpeta `dist` completa al área de "Deploy manually". Netlify te da una URL al instante.

**Opción B — Conectado a GitHub (recomendado para poder actualizarlo después):**

1. Sube esta carpeta a un repositorio de GitHub.
2. En Netlify: "Add new site" > "Import an existing project" > conecta tu repo.
3. Netlify detecta automáticamente el `netlify.toml` (build command `npm run build`, carpeta `dist`).
4. Da clic en "Deploy".

## 4. Cambiar la contraseña de administrador

Está en `src/App.jsx`, en la línea:

```js
const ADMIN_PASSWORD = "puerta2026";
```

Cámbiala antes de compartir el enlace con tu equipo.

## Notas

- Todos los que abran el enlace ven el mismo calendario en tiempo real (gracias a Firestore).
- Cada quien elige su nombre en "Yo soy" — esa elección se guarda en su propio navegador.
- Solo quien entre con la contraseña de administrador puede agregar o eliminar compañeros.
