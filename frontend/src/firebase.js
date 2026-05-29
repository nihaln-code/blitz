import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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

export async function saveRoster(uid, roster) {
  const stripped = roster.map(({ name, pos, news }) => ({ name, pos, news: news ?? "hold" }));
  await setDoc(doc(db, "users", uid, "data", "roster"), { players: stripped });
}

export async function loadRoster(uid) {
  const snap = await getDoc(doc(db, "users", uid, "data", "roster"));
  return snap.exists() ? snap.data().players : null;
}
