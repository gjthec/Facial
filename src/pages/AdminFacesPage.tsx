import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  addEmbedding,
  deleteFace,
  listFaces,
  toggleFaceActive,
  upsertFace,
} from '../services/facesRepository';
import { createEmbeddingFromBlob } from '../services/faceRecognitionService';
import { FaceDocument } from '../types';
import { CameraCapture } from '../components/CameraCapture';
import { Button } from '../components/Button';
import Sidebar from '../components/Sidebar';
import { CheckCircle2, LayoutDashboard, Loader2, ScanFace, Shield, Trash2, Upload, Users, UserPlus } from 'lucide-react';

const ADMIN_EMAILS = ['admin@dominio.com'];

const AdminFacesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [faces, setFaces] = useState<FaceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const isAdmin = useMemo(
    () => !!user && (ADMIN_EMAILS.includes(user.email) || user.role === 'teacher'),
    [user]
  );

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin
          ? [
              { label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> },
              { label: 'Novo Cadastro', to: '/admin/faces/new', icon: <UserPlus className="w-4 h-4" /> },
            ]
          : []),
      ],
    [isAdmin]
  );

  useEffect(() => {
    if (isAdmin) loadFaces();
  }, [isAdmin]);

  const loadFaces = async () => {
    setLoading(true);
    try {
      const data = await listFaces();
      setFaces(data);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (face: FaceDocument) => {
    await toggleFaceActive(face.userId, !face.active);
    loadFaces();
  };

  const handleDelete = async (face: FaceDocument) => {
    if (!confirm('Excluir face?')) return;
    await deleteFace(face.userId);
    loadFaces();
  };

  const handleCapture = async (blob: Blob) => {
    if (!user) return;
    setStatus('Processando embedding...');
    const embedding = await createEmbeddingFromBlob(blob);
    if (!embedding) {
      setStatus('Face não detectada. Tente novamente.');
      return;
    }

    setStatus('Salvando no Firestore...');
    const base: FaceDocument = {
      userId: user.sub,
      displayName: user.displayName,
      email: user.email,
      active: true,
      embeddings: [embedding],
    };

    const existing = faces.find((f) => f.userId === user.sub);
    if (!existing) {
      await upsertFace(base);
    } else {
      await addEmbedding(user.sub, embedding);
    }

    setStatus('Face cadastrada!');
    setShowCapture(false);
    loadFaces();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleCapture(file);
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p>Você não tem permissão para acessar este painel.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {user && <Sidebar user={user} navItems={navItems} onLogout={logout} />}

      <div className="flex-1 max-w-5xl mx-auto p-6 space-y-6">
      {showCapture && (
        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setShowCapture(false)}
          isLoading={loading}
          error={null}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faces cadastradas</h1>
          <p className="text-sm text-gray-500">Apenas administradores podem cadastrar ou remover.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCapture(true)}>Cadastrar face</Button>
          <label className="px-4 py-2 border rounded-md cursor-pointer flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Upload imagem
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {status && (
        <div className="p-3 rounded-md bg-blue-50 border border-blue-100 text-sm text-blue-800 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {status}
        </div>
      )}

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Embeddings</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {faces.map((face) => (
              <tr key={face.userId} className="border-t">
                <td className="p-3 font-medium">{face.displayName}</td>
                <td className="p-3">{face.email}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      face.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {face.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3">{face.embeddings?.length || 0}</td>
                <td className="p-3 flex gap-2">
                  <Button variant="outline" onClick={() => handleToggle(face)}>
                    {face.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button variant="outline" onClick={() => handleDelete(face)} className="border-red-200 text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-900">
        <CheckCircle2 className="w-4 h-4" />
        <p>
          Garanta que os modelos do <code>face-api.js</code> estejam disponíveis no caminho configurado
          (ex.: <code>/public/models</code>). O Firestore precisa estar inicializado em <code>services/firebase.ts</code>.
        </p>
      </div>
      </div>
    </div>
  );
};

export default AdminFacesPage;
