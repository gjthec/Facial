import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import { FaceDocument } from '../types';

const COLLECTION_NAME = 'faces';
const EMBEDDING_VERSION = 'v1';

function computeEmbeddingAverage(samples: number[][]): number[] | null {
  if (!samples.length) return null;
  const length = samples[0].length;
  const sum = new Array(length).fill(0);

  samples.forEach((sample) => {
    sample.forEach((value, idx) => {
      sum[idx] += value;
    });
  });

  return sum.map((value) => value / samples.length);
}

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
      embeddingAvg: face.embeddingAvg || computeEmbeddingAverage(Object.values(normalizedEmbeddings)),
      embeddingVersion: face.embeddingVersion || EMBEDDING_VERSION,
      samples: face.samples || Object.values(normalizedEmbeddings),
      updatedAt: serverTimestamp(),
      createdAt: face.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveFaceEnrollment(options: {
  userId: string;
  displayName: string;
  email: string;
  embeddings: number[][];
  photoBlobs?: Blob[];
  active?: boolean;
  existing?: FaceDocument | null;
}): Promise<void> {
  const { userId, displayName, email, embeddings, photoBlobs = [], active = true, existing } = options;
  const embeddingRecord = normalizeEmbeddings([
    ...(existing ? Object.values(existing.embeddings || {}) : []),
    ...embeddings,
  ]);

  const embeddingAvg = computeEmbeddingAverage(Object.values(embeddingRecord));

  const uploadedUrls: string[] = [];
  for (const blob of photoBlobs) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storageRef = ref(storage, `faces/${userId}/${key}.jpg`);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    uploadedUrls.push(url);
  }

  const mergedImageUrls = [
    ...(existing?.imageUrls || []),
    ...uploadedUrls,
  ];

  await upsertFace({
    userId,
    displayName,
    email,
    active,
    embeddings: embeddingRecord,
    embeddingAvg: embeddingAvg || existing?.embeddingAvg,
    embeddingVersion: EMBEDDING_VERSION,
    samples: Object.values(embeddingRecord),
    imageUrls: mergedImageUrls,
  });
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
