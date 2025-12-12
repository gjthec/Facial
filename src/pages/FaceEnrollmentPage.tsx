import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleUser, FaceDocument } from '../types';
import Sidebar from '../components/Sidebar';
import { CameraCapture } from '../components/CameraCapture';
import { Button } from '../components/Button';
import { addEmbedding, getFace, upsertFace } from '../services/facesRepository';
import { createEmbeddingFromBlob } from '../services/faceRecognitionService';
import { AlertTriangle, LayoutDashboard, ScanFace, Shield, Upload, Users, UserPlus } from 'lucide-react';

const ADMIN_EMAILS = ['admin@dominio.com'];

const FaceEnrollmentPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = (u?: GoogleUser | null) => !!u && (ADMIN_EMAILS.includes(u.email) || u.role === 'teacher');

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin(user)
          ? [
              { label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> },
              { label: 'Cadastro de Imagem', to: '/admin/faces/profile', icon: <UserPlus className="w-4 h-4" /> },
              { label: 'Novo Cadastro', to: '/admin/faces/new', icon: <UserPlus className="w-4 h-4" /> },
            ]
          : []),
      ],
    [user]
  );

  if (!user || !isAdmin(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 text-center max-w-md">
          <Shield className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">Acesso restrito.</p>
          <p className="text-sm text-gray-500">Apenas administradores podem cadastrar novas faces.</p>
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

      const embeddingKey = Date.now().toString();
      const faceDoc: FaceDocument = {
        userId: user.sub,
        displayName: user.displayName,
        email: user.email,
        active: true,
        embeddings: { [embeddingKey]: embedding },
      };

      setStatus('Salvando no Firestore...');
      const existing = await getFace(user.sub);

      if (!existing) {
        await upsertFace({ ...faceDoc, embeddings: { [embeddingKey]: embedding } });
      } else {
        await upsertFace({ ...existing, displayName: user.displayName, email: user.email, active: true });
        await addEmbedding(user.sub, embedding);
      }

      setStatus(existing ? 'Novo embedding adicionado ao cadastro!' : 'Cadastro salvo com sucesso!');
      setShowCapture(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o cadastro.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFace(file);
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
            <Button onClick={() => setShowCapture(true)} isLoading={isSaving}>
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

        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Como funciona</h2>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Capture um frame nítido do rosto ou envie uma foto.</li>
            <li>O embedding é gerado no navegador e salvo na coleção <code>faces</code> do Firestore.</li>
            <li>Cadastros ativos serão usados pelo matcher facial para validar presenças.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollmentPage;
