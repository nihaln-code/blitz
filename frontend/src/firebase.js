import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// These are public client-side credentials - not secrets.
// Firebase security is enforced by Firestore rules on the server side.
const firebaseConfig = {
  apiKey: "AIzaSyDKqGPYBHBF-2s5iuAJ2gj4MhBo3icEN-o",
  authDomain: "blitz-36ec4.firebaseapp.com",
  projectId: "blitz-36ec4",
  storageBucket: "blitz-36ec4.firebasestorage.app",
  messagingSenderId: "900251764986",
  appId: "1:900251764986:web:3223ae31847ebf29a0a143",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export { onAuthStateChanged, signInAnonymously };

// Saves the roster to Firestore at path: users/{uid}/data/roster
// Only saves name/pos/news - projections are always refetched fresh from the backend
export async function saveRoster(uid, roster) {
  const stripped = roster.map(({ name, pos, news }) => ({ name, pos, news: news ?? "hold" }));
  await setDoc(doc(db, "users", uid, "data", "roster"), { players: stripped });
}

// Returns the saved players array, or null if this user has never saved a roster
export async function loadRoster(uid) {
  const snap = await getDoc(doc(db, "users", uid, "data", "roster"));
  return snap.exists() ? snap.data().players : null;
}
