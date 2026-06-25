import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { GameSummary } from '../../shared/statsTypes';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase configuration is provided
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let db: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
} else {
  console.warn('Firebase configuration missing. Falling back to localStorage for game stats.');
}

const LOCAL_STORAGE_KEY = 'catan-past-games';

export async function saveGameSummary(summary: GameSummary): Promise<void> {
  if (db) {
    try {
      const collRef = collection(db, 'matches');
      await addDoc(collRef, summary);
      console.log('Saved game summary to Firestore.');
      return;
    } catch (e) {
      console.error('Error writing to Firestore, falling back to localStorage:', e);
    }
  }

  // Fallback to localStorage
  try {
    const existing = await getPastGames();
    // Add to list and keep uniqueness
    if (!existing.some(g => g.id === summary.id)) {
      existing.unshift(summary);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    }
    console.log('Saved game summary to localStorage.');
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export async function getPastGames(): Promise<GameSummary[]> {
  if (db) {
    try {
      const collRef = collection(db, 'matches');
      const q = query(collRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const games: GameSummary[] = [];
      snapshot.forEach((doc) => {
        games.push({ id: doc.id, ...doc.data() } as GameSummary);
      });
      return games;
    } catch (e) {
      console.error('Error reading from Firestore, falling back to localStorage:', e);
    }
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as GameSummary[];
      parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return parsed;
    }
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
  }
  return [];
}
