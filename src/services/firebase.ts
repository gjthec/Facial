import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Configuração padrão para o projeto de teste fornecido pelo solicitante.
// Sempre que possível, sobrescreva via variáveis de ambiente para evitar expor
// segredos em produção (ex.: Vite import.meta.env).
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCID7AGwR-tfNsiJIBd0nPfBGE5adLAbwY',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'train-api-49052.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'train-api-49052',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE || 'train-api-49052.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_SENDER_ID || '1056584302761',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1056584302761:web:659d6c4a3692ded2c4a9b8',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-DT7ZYWWZ8E',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
