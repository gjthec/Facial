import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CameraCapture } from '../components/CameraCapture';
import { recognizeUserByFace, loadFaceMatcher } from '../services/faceRecognitionService';
import { db } from '../services/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { PresenceRecord } from '../types';
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';

const PresencePage: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('Capture sua face para registrar presença.');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PresenceRecord | null>(null);
  const [loading, setLoading] = useState(false);

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
    setStatus('Reconhecendo rosto...');
    try {
      const image = document.createElement('img');
      image.src = URL.createObjectURL(blob);
      await image.decode();
      const result = await recognizeUserByFace(image);

      if (!result.recognized) {
        setError('Sua face ainda não foi cadastrada. Procure o administrador.');
        setStatus('');
        await registerPresence({
          userId: user?.sub || 'unknown',
          displayName: user?.displayName || 'Desconhecido',
          email: user?.email || 'sem-email',
          status: 'denied',
          timestamp: new Date(),
          matcherDistance: undefined,
        });
        return;
      }

      if (result.userId !== user?.sub) {
        setError('A face não pertence ao usuário logado.');
        setStatus('Possível tentativa indevida.');
        return;
      }

      const record: PresenceRecord = {
        userId: user!.sub,
        displayName: user!.displayName,
        email: user!.email,
        status: 'present',
        timestamp: new Date(),
        matcherDistance: result.distance,
      };

      await registerPresence(record);
      setSuccess(record);
      setStatus('Presença registrada com sucesso.');
    } catch (e) {
      console.error(e);
      setError('Erro ao reconhecer rosto.');
      setStatus('');
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
    <div className="max-w-2xl mx-auto p-6 space-y-4">
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
    </div>
  );
};

export default PresencePage;
