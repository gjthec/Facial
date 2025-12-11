import * as faceapi from 'face-api.js';
import { FaceMatcher, LabeledFaceDescriptors } from 'face-api.js';
import { listActiveFaces } from './facesRepository';
import { FaceDocument } from '../types';

let loaded = false;
let matcher: FaceMatcher | null = null;
let loadingPromise: Promise<void> | null = null;

function getModelBaseUrl() {
  // Configure the model path via Vite env when serving assets from a CDN or non-root path
  const envUrl = (import.meta as any)?.env?.VITE_FACEAPI_MODEL_URL as string | undefined;
  const baseUrl = (import.meta as any)?.env?.BASE_URL || '/';
  return envUrl || `${baseUrl}models`;
}

async function loadModels() {
  if (loaded) return;
  if (!loadingPromise) {
    const MODEL_URL = getModelBaseUrl();
    loadingPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
      .then(() => {
        loaded = true;
      })
      .catch((err) => {
        // Face-api returns HTML when the model files are missing, which causes JSON parse errors; explain where to place models
        loadingPromise = null;
        throw new Error(
          `Falha ao carregar modelos de face em "${MODEL_URL}". Garanta que os arquivos .bin e .json estejam em public/models ou configure VITE_FACEAPI_MODEL_URL.`
        );
      });
  }
  await loadingPromise;
}

function toLabeledDescriptor(face: FaceDocument) {
  const descriptors = face.embeddings.map((emb) => new Float32Array(emb));
  return new LabeledFaceDescriptors(face.userId, descriptors);
}

export async function loadFaceMatcher(threshold = 0.6): Promise<FaceMatcher> {
  await loadModels();
  const faces = await listActiveFaces();
  const labeled = faces.map(toLabeledDescriptor);
  matcher = new FaceMatcher(labeled, threshold);
  return matcher;
}

export async function recognizeUserByFace(
  input: HTMLVideoElement | HTMLImageElement | faceapi.TNetInput,
  threshold = 0.6
): Promise<
  | { recognized: false }
  | { recognized: true; userId: string; displayName?: string; email?: string; distance: number }
> {
  if (!matcher) {
    await loadFaceMatcher(threshold);
  }
  if (!matcher) return { recognized: false };

  const detection = await faceapi
    .detectSingleFace(input)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return { recognized: false };

  const bestMatch = matcher.findBestMatch(detection.descriptor);
  if (!bestMatch || bestMatch.label === 'unknown' || bestMatch.distance > threshold) {
    return { recognized: false };
  }

  // Buscar dados do usuário correspondente
  const faces = await listActiveFaces();
  const matchedFace = faces.find((f) => f.userId === bestMatch.label);
  return {
    recognized: true,
    userId: bestMatch.label,
    displayName: matchedFace?.displayName,
    email: matchedFace?.email,
    distance: bestMatch.distance,
  };
}

export async function createEmbeddingFromBlob(blob: Blob): Promise<number[] | null> {
  await loadModels();
  const image = await blobToImage(blob);
  const detection = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}
