// src/services/firebase.ts - Production Firebase Auth & Firestore Persistence Engine
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer,
  writeBatch,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { Task, Note, UserMemoryItem, VoiceSettings } from "../types";

// 1. Initialize Firebase App and Firestore with specific Database ID
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

// Error Context Handler per Firebase Integration Skill Specification
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 2. Validate Connection to Firestore (Per Firebase Integration Spec)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[Firebase] Client is offline or Firestore is unreachable.");
      return false;
    }
    // Expected to fail permission-check on unauthenticated test doc, but proves reachability
    return true;
  }
}

// Boot connection test
testFirestoreConnection().catch(() => {});

// 3. Authentication Services
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function loginAsGuest(): Promise<User> {
  const result = await signInAnonymously(auth);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function registerWithEmail(email: string, pass: string, name?: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  await ensureUserProfile(result.user, name);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// 4. User Profile & Settings
export interface UserProfileData {
  userId: string;
  email: string | null;
  displayName: string | null;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
}

export async function ensureUserProfile(user: User, customName?: string) {
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const now = new Date().toISOString();
      const profile: UserProfileData = {
        userId: user.uid,
        email: user.email || null,
        displayName: customName || user.displayName || (user.isAnonymous ? "Guest Explorer" : "User"),
        preferredLanguage: "auto",
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(userRef, profile);
    }
  } catch (e) {
    console.warn("[Firebase] ensureUserProfile notice:", e);
  }
}

export async function saveUserSettings(userId: string, settings: VoiceSettings): Promise<void> {
  const settingRef = doc(db, "users", userId, "settings", "config");
  await setDoc(
    settingRef,
    {
      userId,
      voiceName: settings.voiceName,
      speechRate: settings.speechRate,
      graphicsQuality: settings.graphicsQuality,
      handsFreeStandby: settings.handsFreeStandby,
      micSensitivity: settings.micSensitivity,
      languageMode: settings.languageMode,
      enableMemory: settings.enableMemory,
      responseStyle: settings.responseStyle,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function loadUserSettings(userId: string): Promise<Partial<VoiceSettings> | null> {
  try {
    const snap = await getDoc(doc(db, "users", userId, "settings", "config"));
    if (snap.exists()) {
      return snap.data() as Partial<VoiceSettings>;
    }
  } catch (e) {
    console.warn("[Firebase] loadUserSettings notice:", e);
  }
  return null;
}

// 5. Notes Operations
export function subscribeUserNotes(userId: string, onUpdate: (notes: Note[]) => void, onError?: (err: any) => void) {
  const notesCol = collection(db, "users", userId, "notes");
  return onSnapshot(
    notesCol,
    (snapshot) => {
      const notes: Note[] = snapshot.docs.map((d) => ({
        id: d.id,
        title: d.data().title || "Untitled",
        content: d.data().content || "",
        createdAt: d.data().createdAt || new Date().toLocaleDateString(),
      }));
      onUpdate(notes);
    },
    (err) => {
      console.warn("[Firebase] Notes snapshot error:", err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserNote(userId: string, note: Note): Promise<void> {
  const path = `users/${userId}/notes/${note.id}`;
  try {
    const noteRef = doc(db, "users", userId, "notes", note.id);
    await setDoc(noteRef, {
      id: note.id,
      userId,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserNote(userId: string, noteId: string): Promise<void> {
  const path = `users/${userId}/notes/${noteId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "notes", noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 6. Tasks Operations
export function subscribeUserTasks(userId: string, onUpdate: (tasks: Task[]) => void, onError?: (err: any) => void) {
  const tasksCol = collection(db, "users", userId, "tasks");
  return onSnapshot(
    tasksCol,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((d) => ({
        id: d.id,
        title: d.data().title || "",
        completed: !!d.data().completed,
        createdAt: d.data().createdAt || new Date().toLocaleDateString(),
      }));
      onUpdate(tasks);
    },
    (err) => {
      console.warn("[Firebase] Tasks snapshot error:", err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserTask(userId: string, task: Task): Promise<void> {
  const path = `users/${userId}/tasks/${task.id}`;
  try {
    const taskRef = doc(db, "users", userId, "tasks", task.id);
    await setDoc(taskRef, {
      id: task.id,
      userId,
      title: task.title,
      completed: task.completed,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserTask(userId: string, taskId: string): Promise<void> {
  const path = `users/${userId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "tasks", taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 7. Memory Operations
export function subscribeUserMemories(userId: string, onUpdate: (memories: UserMemoryItem[]) => void, onError?: (err: any) => void) {
  const memCol = collection(db, "users", userId, "memories");
  return onSnapshot(
    memCol,
    (snapshot) => {
      const memories: UserMemoryItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        key: d.data().key || "",
        value: d.data().value || "",
        category: d.data().category || "fact",
        updatedAt: d.data().updatedAt || new Date().toLocaleDateString(),
      }));
      onUpdate(memories);
    },
    (err) => {
      console.warn("[Firebase] Memories snapshot error:", err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserMemory(userId: string, item: UserMemoryItem): Promise<void> {
  const path = `users/${userId}/memories/${item.id}`;
  try {
    const memRef = doc(db, "users", userId, "memories", item.id);
    await setDoc(memRef, {
      id: item.id,
      userId,
      key: item.key,
      value: item.value,
      category: item.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserMemory(userId: string, memoryId: string): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "memories", memoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllUserMemories(userId: string, memories: UserMemoryItem[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const m of memories) {
      batch.delete(doc(db, "users", userId, "memories", m.id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/memories`);
  }
}

// 8. Controlled LocalStorage Migration on First Cloud Sync
export async function migrateLocalStorageToCloud(
  userId: string,
  localTasks: Task[],
  localNotes: Note[],
  localMemory: UserMemoryItem[]
): Promise<{ migratedCount: number }> {
  let count = 0;
  try {
    const batch = writeBatch(db);

    for (const task of localTasks) {
      const ref = doc(db, "users", userId, "tasks", task.id);
      batch.set(ref, {
        id: task.id,
        userId,
        title: task.title,
        completed: task.completed,
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      count++;
    }

    for (const note of localNotes) {
      const ref = doc(db, "users", userId, "notes", note.id);
      batch.set(ref, {
        id: note.id,
        userId,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      count++;
    }

    for (const mem of localMemory) {
      const ref = doc(db, "users", userId, "memories", mem.id);
      batch.set(ref, {
        id: mem.id,
        userId,
        key: mem.key,
        value: mem.value,
        category: mem.category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      count++;
    }

    if (count > 0) {
      await batch.commit();
      console.log(`[Firebase] Successfully migrated ${count} local items to Cloud Firestore.`);
    }
  } catch (err) {
    console.warn("[Firebase] Local storage migration skipped or partially completed:", err);
  }
  return { migratedCount: count };
}

// 9. Data Backup & Export (Priority 7 Requirement)
export interface UserDataBackup {
  version: string;
  exportDate: string;
  userId: string;
  tasks: Task[];
  notes: Note[];
  memory: UserMemoryItem[];
}

export function exportUserDataAsJSON(data: UserDataBackup) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sam-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
