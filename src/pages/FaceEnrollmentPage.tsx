import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FaceDocument } from '../types';
import Sidebar from '../components/Sidebar';
import { CameraCapture } from '../components/CameraCapture';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { getFace, listFaces, saveFaceEnrollment } from '../services/facesRepository';
import { createEmbeddingFromBlob } from '../services/faceRecognitionService';
import { AlertTriangle, LayoutDashboard, ScanFace, Shield, Upload, Users, UserPlus } from 'lucide-react';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível ler a imagem.'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const FaceEnrollmentPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [faces, setFaces] = useState<FaceDocument[]>([]);
  const [facesStatus, setFacesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [samples, setSamples] = useState<number[][]>([]);
  const [sampleBlobs, setSampleBlobs] = useState<Blob[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string>(user?.sub || '');
  const [personName, setPersonName] = useState<string>(user?.displayName || '');

  const isAdmin = useMemo(() => !!user, [user]);

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin
          ? [
              { label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> },
              { label: 'Cadastro de Imagem', to: '/admin/faces/profile', icon: <UserPlus className="w-4 h-4" /> },
              { label: 'Novo Cadastro', to: '/admin/faces/new', icon: <UserPlus className="w-4 h-4" /> },
            ]
          : []),
      ],
    [isAdmin]
  );

  const loadFaces = async () => {
    setFacesStatus('loading');
    try {
      const data = await listFaces();
      setFaces(data);
      setFacesStatus('ready');
    } catch (err) {
      console.error(err);
      setFacesStatus('error');
    }
  };

  useEffect(() => {
    loadFaces();
  }, []);

  useEffect(() => {
    setPersonId(user?.sub || '');
    setPersonName(user?.displayName || '');
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 text-center max-w-md">
          <Shield className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">Sessão não iniciada.</p>
          <p className="text-sm text-gray-500">Faça login para cadastrar novas faces.</p>
        </div>
      </div>
    );
  }

  const processFace = async (blob: Blob) => {
    setStatus('Processando embedding...');
    setError(null);
    setIsSaving(true);
    try {
      const embedding = await createEmbeddingFromBlob(blob);
      if (!embedding) {
        setError('Face não detectada. Tente novamente.');
        return;
      }

      const embArray = Array.from(embedding);
      setSamples((prev) => [...prev, embArray]);
      setSampleBlobs((prev) => [...prev, blob]);
      if (!photoPreview) {
        const preview = await blobToDataUrl(blob);
        setPhotoPreview(preview);
      }

      setStatus('Embedding capturado. Capture mais frames ou salve o cadastro.');
      setShowCapture(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível processar o embedding.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFace(file);
  };

  const averageEmbedding = useMemo(() => {
    if (!samples.length) return null;
    const length = samples[0]?.length || 0;
    const sum = new Array(length).fill(0);
    samples.forEach((sample) => {
      sample.forEach((value, idx) => {
        sum[idx] += value;
      });
    });
    return sum.map((value) => value / samples.length);
  }, [samples]);

  const handleSave = async () => {
    if (!personId || !personName) {
      setError('Informe o identificador e o nome para salvar.');
      return;
    }
    if (!samples.length) {
      setError('Capture pelo menos um frame para gerar o embedding.');
      return;
    }

    setIsSaving(true);
    setStatus('Salvando no Firebase...');
    setError(null);
    try {
      const existing = await getFace(personId);
      await saveFaceEnrollment({
        userId: personId,
        displayName: personName,
        email: user.email,
        embeddings: samples,
        photoBlobs: sampleBlobs,
        active: true,
        existing,
      });
      setStatus(existing ? 'Cadastro atualizado com sucesso!' : 'Cadastro salvo com sucesso!');
      setSamples([]);
      setSampleBlobs([]);
      setPhotoPreview(null);
      loadFaces();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o cadastro.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={user} navItems={navItems} onLogout={logout} />

      <div className="flex-1 max-w-5xl mx-auto p-8 space-y-6">
        {showCapture && (
          <CameraCapture
            onCapture={processFace}
            onCancel={() => setShowCapture(false)}
            isLoading={isSaving}
            error={error}
            onClearError={() => setError(null)}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-semibold mb-1">Cadastro de face</p>
            <h1 className="text-2xl font-bold text-gray-900">Novo cadastro autorizado</h1>
            <p className="text-sm text-gray-600">Use a câmera ou faça upload para registrar a face que liberará o acesso.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCapture(true)} isLoading={isSaving} className="w-auto">
              Capturar câmera
            </Button>
            <label className="px-4 py-2 border rounded-md cursor-pointer flex items-center gap-2 text-sm bg-white hover:bg-gray-50">
              <Upload className="w-4 h-4" /> Upload imagem
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>

        {status && (
          <div className="p-3 rounded-md bg-blue-50 border border-blue-100 text-sm text-blue-800">
            {status}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-100 text-sm text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Identificador (personId)"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                placeholder="ex: aluno-123"
              />
              <Input
                label="Nome / Display"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Nome do aluno"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500">Embeddings coletados</p>
                <p className="text-2xl font-bold text-gray-900">{samples.length}</p>
                <p className="text-xs text-gray-500">Capture 3 a 5 frames para melhor resultado.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500">Vetor agregado</p>
                <p className="text-sm font-semibold text-gray-800">
                  {averageEmbedding ? 'Média calculada' : 'Aguardando capturas'}
                </p>
                <p className="text-xs text-gray-500">Normalizado localmente antes de salvar.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
                {photoPreview ? (
                  <img src={photoPreview} alt="Pré-visualização" className="w-16 h-16 rounded-full object-cover border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200" />
                )}
                <div>
                  <p className="text-xs text-gray-500">Última captura</p>
                  <p className="text-sm font-semibold text-gray-800">{photoPreview ? 'Pronta para salvar' : 'Ainda sem foto'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} isLoading={isSaving} disabled={!samples.length} className="w-auto">
                Salvar cadastro
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSamples([]);
                  setSampleBlobs([]);
                  setPhotoPreview(null);
                  setStatus(null);
                }}
                className="w-auto"
              >
                Limpar captura
              </Button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Faces cadastradas</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  facesStatus === 'ready'
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : facesStatus === 'loading'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                }`}
              >
                {facesStatus === 'loading' ? 'Carregando' : facesStatus === 'ready' ? 'Pronto' : 'Erro'}
              </span>
            </div>
            <p className="text-sm text-gray-600">Os cadastros ativos serão usados no reconhecimento facial.</p>
            <div className="divide-y divide-gray-100">
              {facesStatus === 'loading' && <p className="text-sm text-gray-500 py-2">Sincronizando com o Firestore...</p>}
              {facesStatus === 'error' && (
                <p className="text-sm text-red-600 py-2">Não foi possível carregar os cadastros. Tente novamente.</p>
              )}
              {facesStatus === 'ready' &&
                faces.map((face) => (
                  <div key={face.userId} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{face.displayName}</p>
                      <p className="text-xs text-gray-500">{face.email}</p>
                    </div>
                    <span className="text-xs text-gray-600">
                      {(face.samples?.length || Object.keys(face.embeddings || {}).length) || 0} embeddings
                    </span>
                  </div>
                ))}
            </div>
            <Button variant="outline" onClick={loadFaces} className="w-full">
              Recarregar lista
            </Button>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Como funciona</h2>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Capture um frame nítido do rosto ou envie uma foto.</li>
            <li>Geramos um embedding por captura, calculamos a média e salvamos na coleção <code>faces</code>.</li>
            <li>Cadastros ativos serão usados pelo matcher facial para validar presenças.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollmentPage;
