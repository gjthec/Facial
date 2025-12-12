import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CameraCapture } from '../components/CameraCapture';
import {
  recognizeUserByFace,
  loadFaceMatcher,
  createEmbeddingFromBlob,
} from '../services/faceRecognitionService';
import { addEmbedding, getFace, upsertFace } from '../services/facesRepository';
import { db } from '../services/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { PresenceRecord, GoogleUser } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  LayoutDashboard,
  ScanFace,
  Users,
  UserPlus,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

const PresencePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<string>('Capture sua face para registrar presença.');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PresenceRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAILS = ['admin@dominio.com'];
  const isAdmin = (u?: GoogleUser | null) => !!u && (ADMIN_EMAILS.includes(u.email) || u.role === 'teacher');

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin(user)
          ? [
              { label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> },
              { label: 'Novo Cadastro', to: '/admin/faces/new', icon: <UserPlus className="w-4 h-4" /> },
            ]
          : []),
      ],
    [user]
  );

  useEffect(() => {
    loadFaceMatcher().catch(() => setError('Não foi possível carregar base de faces.'));
  }, []);

  const registerPresence = async (record: PresenceRecord) => {
    await addDoc(collection(db, 'presences'), {
      ...record,
      timestamp: serverTimestamp(),
    });
  };

  const handleCapture = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    setStatus('Processando captura...');
    try {
      const image = document.createElement('img');
      image.src = URL.createObjectURL(blob);
      await image.decode();

      // Sempre persiste o embedding para este usuário para uso futuro no reconhecimento
      setStatus('Gerando embedding e salvando no Firestore...');
      const embedding = await createEmbeddingFromBlob(blob);
      if (!embedding) {
        setStatus('Face não detectada. Ajuste o enquadramento e tente novamente.');
        setLoading(false);
        return;
      }

      const existingFace = await getFace(user!.sub);
      const embeddingKey = Date.now().toString();
      if (!existingFace) {
        await upsertFace({
          userId: user!.sub,
          displayName: user!.displayName,
          email: user!.email,
          active: true,
          embeddings: { [embeddingKey]: embedding },
        });
      } else {
        await addEmbedding(user!.sub, embedding);
      }

      // Recarrega o matcher com a face recém-salva para que o reconhecimento use o novo embedding
      await loadFaceMatcher();

      setStatus('Reconhecendo rosto...');
      const result = await recognizeUserByFace(image);

      const recognizedSameUser = result.recognized && result.userId === user?.sub;
      const recognitionNote = !result.recognized
        ? 'Face não encontrada na base. Presença registrada sem validação facial.'
        : result.userId !== user?.sub
        ? 'Face reconhecida pertence a outro usuário. Presença registrada sem validação facial.'
        : 'Face reconhecida para este usuário.';

      const record: PresenceRecord = {
        userId: user!.sub,
        displayName: user!.displayName,
        email: user!.email,
        status: 'present',
        timestamp: new Date(),
        matcherDistance: result.distance,
        recognized: recognizedSameUser,
        recognizedUserId: result.recognized ? result.userId : undefined,
        recognitionNote,
      };

      await registerPresence(record);
      setSuccess(record);
      setError(null);
      setStatus(
        recognizedSameUser
          ? 'Presença registrada com sucesso. Face confirmada para o usuário logado.'
          : 'Presença registrada sem validação facial. Confira a base de faces depois de cadastrá-las.'
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Falha ao processar reconhecimento facial.');
      const fallbackRecord: PresenceRecord = {
        userId: user!.sub,
        displayName: user!.displayName,
        email: user!.email,
        status: 'present',
        timestamp: new Date(),
        recognitionNote: 'Erro ao reconhecer rosto. Presença registrada sem validação facial.',
      };
      await registerPresence(fallbackRecord);
      setSuccess(fallbackRecord);
      setStatus('Presença registrada. O reconhecimento facial falhou, valide manualmente depois de cadastrar as faces.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p>Faça login com Google antes de registrar presença.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={user} navItems={navItems} onLogout={logout} />

      <main className="flex-1 max-w-3xl mx-auto p-8 space-y-4">
        <div className="bg-white shadow rounded-lg p-4">
          <h1 className="text-xl font-bold mb-2">Registrar Presença</h1>
          <p className="text-sm text-gray-500">Autentique-se com sua face cadastrada.</p>
        </div>

        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setStatus('Captura cancelada.')}
          isLoading={loading}
          error={error}
          onClearError={() => setError(null)}
        />

        {status && <div className="text-sm text-gray-700">{status}</div>}

        {success && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-md flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Presença registrada</p>
              <p className="text-sm text-green-700">{success.displayName} - {success.email}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">{error}</p>
              <p className="text-sm text-red-700">
                Certifique-se de que o administrador cadastrou sua face na coleção `faces` e que ela está ativa.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PresencePage;
