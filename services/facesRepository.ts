import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { FaceDocument } from '../types';

const COLLECTION_NAME = 'faces';

export async function listFaces(): Promise<FaceDocument[]> {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as FaceDocument) }));
}

export async function listActiveFaces(): Promise<FaceDocument[]> {
  const q = query(collection(db, COLLECTION_NAME), where('active', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as FaceDocument) }));
}

export async function upsertFace(face: FaceDocument): Promise<void> {
  const faceRef = doc(collection(db, COLLECTION_NAME), face.userId);
  await setDoc(
    faceRef,
    {
      ...face,
      updatedAt: serverTimestamp(),
      createdAt: face.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export async function addEmbedding(userId: string, embedding: number[]): Promise<void> {
  const faceRef = doc(collection(db, COLLECTION_NAME), userId);
  await setDoc(
    faceRef,
    {
      embeddings: arrayUnion(embedding),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createFaceDocument(face: Omit<FaceDocument, 'id'>) {
  return addDoc(collection(db, COLLECTION_NAME), {
    ...face,
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
