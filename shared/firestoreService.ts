import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Session, L1Note, T2Coding, T3Final } from './types';

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(name: string, createdBy: string): Promise<Session> {
  const id = `session_${Date.now()}`;
  const session: Session = {
    id,
    name,
    createdBy,
    createdAt: new Date().toISOString(),
    status: 'l1',
  };
  await setDoc(doc(db, 'sessions_v3', id), session);
  return session;
}

export async function listSessions(): Promise<Session[]> {
  const snap = await getDocs(collection(db, 'sessions_v3'));
  return snap.docs.map((d: DocumentData) => d.data() as Session);
}

export async function updateSessionStatus(sessionId: string, status: Session['status']): Promise<void> {
  await setDoc(doc(db, 'sessions_v3', sessionId), { status }, { merge: true });
}

// ─── L1 Notes ────────────────────────────────────────────────────────────────

export async function saveL1Note(sessionId: string, expertName: string, text: string): Promise<void> {
  const id = `${sessionId}_${expertName.replace(/\s+/g, '_')}`;
  await setDoc(doc(db, 'l1_notes_v3', id), {
    id,
    sessionId,
    expertName,
    text,
    timestamp: new Date().toISOString(),
  });
}

export async function getL1Notes(sessionId: string): Promise<L1Note[]> {
  const snap = await getDocs(collection(db, 'l1_notes_v3'));
  const all = snap.docs.map((d: DocumentData) => d.data() as L1Note & { sessionId: string });
  return all
    .filter((n: L1Note & { sessionId: string }) => n.sessionId === sessionId)
    .map(({ sessionId: _s, ...rest }: L1Note & { sessionId: string }) => rest as L1Note);
}

// ─── T2 Codings (SubModerator output) ────────────────────────────────────────

export async function saveT2Coding(coding: T2Coding): Promise<void> {
  const id = `${coding.sessionId}_${coding.subModName.replace(/\s+/g, '_')}`;
  await setDoc(doc(db, 't2_codings_v3', id), { ...coding, id });
}

export async function getT2Codings(sessionId: string): Promise<T2Coding[]> {
  const snap = await getDocs(collection(db, 't2_codings_v3'));
  const all = snap.docs.map((d: DocumentData) => d.data() as T2Coding & { id: string });
  return all.filter((c: T2Coding) => c.sessionId === sessionId);
}

// ─── T3 Final (Moderator output) ─────────────────────────────────────────────

export async function saveT3Final(final: T3Final): Promise<void> {
  await setDoc(doc(db, 't3_final_v3', final.sessionId), final);
}

export async function getT3Final(sessionId: string): Promise<T3Final | null> {
  const snap = await getDoc(doc(db, 't3_final_v3', sessionId));
  return snap.exists() ? (snap.data() as T3Final) : null;
}
