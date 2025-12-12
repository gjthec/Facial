import { addDoc, collection, deleteDoc, doc, getDocs, getDoc, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { FaceDocument } from '../types';

const COLLECTION_NAME = 'faces';

function normalizeEmbeddings(
  embeddings?: Record<string, number[] | Float32Array> | Array<number[] | Float32Array> | null
): Record<string, number[]> {
  if (!embeddings) return {};

  if (Array.isArray(embeddings)) {
    return embeddings.reduce<Record<string, number[]>>((acc, emb, idx) => {
      acc[idx.toString()] = Array.from(emb);
      return acc;
    }, {});
  }

  return Object.entries(embeddings).reduce<Record<string, number[]>>((acc, [key, emb]) => {
    acc[key] = Array.from(emb);
    return acc;
  }, {});
}

export async function listFaces(): Promise<FaceDocument[]> {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as FaceDocument) }));
}

export async function listActiveFaces(): Promise<FaceDocument[]> {
  const q = query(collection(db, COLLECTION_NAME), where('active', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as FaceDocument) }));
}

export async function getFace(userId: string): Promise<FaceDocument | null> {
  const faceRef = doc(collection(db, COLLECTION_NAME), userId);
  const snap = await getDoc(faceRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as FaceDocument) };
}

export async function upsertFace(face: FaceDocument): Promise<void> {
  const faceRef = doc(collection(db, COLLECTION_NAME), face.userId);
  const normalizedEmbeddings = normalizeEmbeddings(face.embeddings);
  await setDoc(
    faceRef,
    {
      ...face,
      embeddings: normalizedEmbeddings,
      updatedAt: serverTimestamp(),
      createdAt: face.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export async function addEmbedding(userId: string, embedding: number[]): Promise<void> {
  const faceRef = doc(collection(db, COLLECTION_NAME), userId);
  const snap = await getDoc(faceRef);
  const existing = (snap.data() as FaceDocument | undefined)?.embeddings;

  const normalized = normalizeEmbeddings(existing);

  const embeddingKey = Date.now().toString();
  await setDoc(
    faceRef,
    {
      embeddings: { ...normalized, [embeddingKey]: Array.from(embedding) },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createFaceDocument(face: Omit<FaceDocument, 'id'>) {
  return addDoc(collection(db, COLLECTION_NAME), {
    ...face,
    embeddings: normalizeEmbeddings(face.embeddings),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function toggleFaceActive(userId: string, active: boolean) {
  const faceRef = doc(collection(db, COLLECTION_NAME), userId);
  await updateDoc(faceRef, { active, updatedAt: serverTimestamp() });
}

export async function deleteFace(userId: string) {
  const faceRef = doc(collection(db, COLLECTION_NAME), userId);
  await deleteDoc(faceRef);
}
