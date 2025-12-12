import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Button } from '../components/Button';
import { CameraCapture } from '../components/CameraCapture';
import { useAuth } from '../contexts/AuthContext';
import { FaceDocument } from '../types';
import {
  listFaces,
  getFace,
  upsertFace,
} from '../services/facesRepository';
import { createEmbeddingFromBlob } from '../services/faceRecognitionService';
import {
  Download,
  ImageDown,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ScanFace,
  Shield,
  Users,
  UserPlus,
} from 'lucide-react';

const defaultForm = {
  userId: '',
  displayName: '',
  email: '',
  active: true,
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível ler a imagem.'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const FaceProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [faces, setFaces] = useState<FaceDocument[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [photoData, setPhotoData] = useState<string | undefined>(undefined);
  const [currentEmbeddings, setCurrentEmbeddings] = useState<Record<string, number[]>>({});
  const [pendingEmbedding, setPendingEmbedding] = useState<number[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  const isAdmin = useMemo(() => !!user, [user]);

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin
          ? [
              { label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> },
              { label: 'Novo Cadastro', to: '/admin/faces/new', icon: <UserPlus className="w-4 h-4" /> },
              { label: 'Cadastro de Imagem', to: '/admin/faces/profile', icon: <ImagePlus className="w-4 h-4" /> },
            ]
          : []),
      ],
    [isAdmin]
  );

  useEffect(() => {
    if (isAdmin) loadFaces();
  }, [isAdmin]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 text-center max-w-md">
          <Shield className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">Sessão não iniciada.</p>
          <p className="text-sm text-gray-500">Faça login para cadastrar ou editar faces.</p>
        </div>
      </div>
    );
  }

  const loadFaces = async () => {
    setLoading(true);
    try {
      const data = await listFaces();
      setFaces(data);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(defaultForm);
    setPhotoData(undefined);
    setCurrentEmbeddings({});
    setPendingEmbedding(null);
    setSelectedId('');
    setStatus('');
    setError('');
  };

  const loadFace = async (userId: string) => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const face = await getFace(userId);
      if (!face) {
        setError('Cadastro não encontrado. Você pode criar um novo.');
        return;
      }
      setSelectedId(userId);
      setForm({
        userId: face.userId,
        displayName: face.displayName,
        email: face.email,
        active: face.active,
      });
      setPhotoData(face.photoData);
      setCurrentEmbeddings(face.embeddings || {});
      setPendingEmbedding(null);
      setStatus('Cadastro carregado.');
    } finally {
      setLoading(false);
    }
  };

  const processBlob = async (blob: Blob) => {
    setStatus('Processando imagem...');
    setError('');
    setLoading(true);
    try {
      const dataUrl = await blobToDataUrl(blob);
      setPhotoData(dataUrl);

      const embedding = await createEmbeddingFromBlob(blob);
      if (!embedding) {
        setError('Face não detectada. Tente novamente.');
        setPendingEmbedding(null);
        return;
      }
      setPendingEmbedding(Array.from(embedding));
      setStatus('Foto pronta para salvar junto com o embedding.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível processar a imagem.');
    } finally {
      setLoading(false);
      setShowCapture(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processBlob(file);
  };

  const handleDownloadPhoto = () => {
    if (!photoData) return;
    const link = document.createElement('a');
    link.href = photoData;
    link.download = `${form.displayName || 'face'}-foto.png`;
    link.click();
  };

  const handleSave = async () => {
    if (!form.userId || !form.displayName || !form.email) {
      setError('Preencha ID, nome e email para salvar.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Salvando cadastro...');

    try {
      const existing = await getFace(form.userId);
      const mergedEmbeddings: Record<string, number[]> = {
        ...(existing?.embeddings || {}),
        ...(currentEmbeddings || {}),
      };

      if (pendingEmbedding) {
        const key = Date.now().toString();
        mergedEmbeddings[key] = pendingEmbedding;
      }

      const payload: FaceDocument = {
        userId: form.userId,
        displayName: form.displayName,
        email: form.email,
        active: form.active,
        embeddings: mergedEmbeddings,
        photoData,
      };

      await upsertFace(payload);
      setStatus(existing ? 'Cadastro atualizado com sucesso.' : 'Cadastro criado com sucesso.');
      setPendingEmbedding(null);
      setCurrentEmbeddings(mergedEmbeddings);
      loadFaces();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const selectedFace = faces.find((f) => f.userId === selectedId);
  const embeddingsCount = Object.keys(currentEmbeddings || {}).length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={user} navItems={navItems} onLogout={logout} />

      {showCapture && (
        <CameraCapture
          onCapture={processBlob}
          onCancel={() => setShowCapture(false)}
          isLoading={loading}
          error={error || null}
          onClearError={() => setError('')}
        />
      )}

      <div className="flex-1 max-w-6xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-semibold mb-1">Cadastro biométrico</p>
            <h1 className="text-2xl font-bold text-gray-900">Foto, dados e edição</h1>
            <p className="text-sm text-gray-600">Capture, baixe, recupere e atualize o cadastro facial em um só lugar.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetForm}>
              <RefreshCw className="w-4 h-4 mr-2" /> Novo cadastro
            </Button>
            <Button onClick={() => setShowCapture(true)} isLoading={loading}>
              <ImagePlus className="w-4 h-4 mr-2" /> Tirar foto
            </Button>
            <label className="px-4 py-2 border rounded-md cursor-pointer flex items-center gap-2 text-sm bg-white hover:bg-gray-50">
              <ImageDown className="w-4 h-4" /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>

        {(status || error) && (
          <div className="space-y-2">
            {status && (
              <div className="p-3 rounded-md bg-blue-50 border border-blue-100 text-sm text-blue-800 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {status}
              </div>
            )}
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-100 text-sm text-red-800 flex items-center gap-2">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dados do cadastro</h2>
                <p className="text-sm text-gray-500">Busque um cadastro existente ou preencha para criar um novo.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedId(id);
                    if (id) loadFace(id);
                  }}
                  className="border border-gray-200 rounded-md text-sm px-3 py-2 bg-white"
                >
                  <option value="">Selecionar cadastro...</option>
                  {faces.map((face) => (
                    <option key={face.userId} value={face.userId}>
                      {face.displayName} ({face.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">ID do usuário (único)</label>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2"
                  value={form.userId}
                  onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                  placeholder="ID do usuário"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600">Nome completo</label>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2"
                  value={form.displayName}
                  onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Nome da pessoa"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600">Email</label>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@dominio.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2"
                  value={form.active ? 'active' : 'inactive'}
                  onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.value === 'active' }))}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-md p-3 text-sm">
              <span className="text-gray-600">Embeddings vinculados: {embeddingsCount}</span>
              {selectedFace && (
                <button
                  className="text-blue-600 text-sm"
                  onClick={() => loadFace(selectedFace.userId)}
                  disabled={loading}
                >
                  Recarregar dados
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} isLoading={loading}>
                Salvar cadastro
              </Button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Foto vinculada</h3>
              <Button variant="outline" onClick={handleDownloadPhoto} disabled={!photoData}>
                <Download className="w-4 h-4 mr-2" /> Baixar
              </Button>
            </div>
            <div className="aspect-[3/4] rounded-lg border border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
              {photoData ? (
                <img src={photoData} alt="Foto da pessoa" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-500 text-sm space-y-2">
                  <ImagePlus className="w-6 h-6 mx-auto" />
                  <p>Nenhuma foto vinculada.</p>
                  <p className="text-xs">Use a câmera ou faça upload.</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Button onClick={() => setShowCapture(true)} className="w-full" variant="outline">
                Tirar foto agora
              </Button>
              <label className="w-full px-4 py-2 border rounded-md cursor-pointer flex items-center gap-2 text-sm bg-white hover:bg-gray-50 justify-center">
                <ImageDown className="w-4 h-4" /> Upload de imagem
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceProfilePage;
