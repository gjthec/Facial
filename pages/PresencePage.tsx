import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CameraCapture } from '../components/CameraCapture';
import { recognizeUserByFace, loadFaceMatcher } from '../services/faceRecognitionService';
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
  LogOut,
} from 'lucide-react';

const PresencePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<string>('Capture sua face para registrar presença.');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PresenceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const ADMIN_EMAILS = ['admin@dominio.com'];
  const isAdmin = (u?: GoogleUser | null) => !!u && (ADMIN_EMAILS.includes(u.email) || u.role === 'teacher');

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin(user)
          ? [{ label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> }]
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
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4">
        <div className="flex items-center gap-3 pb-6 border-b border-gray-100">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="Avatar" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user.displayName?.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>

        <nav className="mt-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </aside>

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
