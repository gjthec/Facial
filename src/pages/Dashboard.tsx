import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { ClassSession, AttendanceRecord } from '../types';
import { Button } from '../components/Button';
import {
  MapPin,
  Clock,
  Calendar,
  ShieldCheck,
  Camera,
  AlertTriangle,
  LayoutDashboard,
  ScanFace,
  Users,
  ImagePlus,
  UserPlus,
} from 'lucide-react';
import { CameraCapture } from '../components/CameraCapture';
import Sidebar from '../components/Sidebar';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  
  // Camera States
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const isAdmin = useMemo(() => !!user, [user]);

  const navItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Registrar Presença', to: '/presence', icon: <ScanFace className="w-4 h-4" /> },
        ...(isAdmin
          ? [
              { label: 'Faces Autorizadas', to: '/admin/faces', icon: <Users className="w-4 h-4" /> },
              { label: 'Cadastro de Imagem', to: '/admin/faces/profile', icon: <ImagePlus className="w-4 h-4" /> },
              { label: 'Novo Cadastro', to: '/admin/faces/new', icon: <UserPlus className="w-4 h-4" /> },
            ]
          : []),
      ],
    [isAdmin]
  );

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    if (user?.accessToken) {
      const data = await api.getClasses(user.accessToken);
      setClasses(data);
    }
  };

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalização não suportada neste dispositivo."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };

  const initiateCheckIn = (classId: string) => {
    setSelectedClassId(classId);
    setCameraError(null);
    setShowCamera(true);
    setStatusMessage({ type: 'info', text: "Prepare-se para a foto. Apenas seu rosto deve aparecer." });
  };

  const handleFaceCapture = async (imageBlob: Blob) => {
    if (!user?.accessToken || !selectedClassId) return;
    
    setLoading(true);
    setCameraError(null); // Limpa erro anterior ao tentar novamente
    
    try {
      // 1. Obter GPS Fresco (Anti-fraude de local)
      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      
      // 2. Enviar para Backend (Google Gemini Vision + PostGIS)
      const record = await api.checkInWithFace(
        user.accessToken, 
        selectedClassId, 
        latitude, 
        longitude,
        imageBlob
      );
      
      // Sucesso
      setActiveRecord(record);
      setShowCamera(false);
      setStatusMessage({ type: 'success', text: "Presença confirmada! Você está auditado." });
    } catch (err: any) {
      console.error(err);
      let msg = "Falha no registro.";
      if (err.code === 1) msg = "Permissão de localização negada.";
      if (err.message) msg = err.message;
      
      // Define erro ESPECÍFICO da câmera para mostrar na interface da câmera
      setCameraError(msg);
      
      // Também atualiza o status geral
      setStatusMessage({ type: 'error', text: msg });
      
      // NOTA: Não fechamos mais a câmera (setShowCamera(false)) em caso de erro,
      // permitindo que o usuário tente novamente.
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user?.accessToken || !activeRecord) return;
    setLoading(true);
    try {
      const position = await getPosition();
      await api.checkOut(user.accessToken, activeRecord.id, position.coords.latitude, position.coords.longitude);
      setActiveRecord(null);
      setStatusMessage({ type: 'success', text: "Saída registrada." });
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Erro ao registrar saída." });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {user && <Sidebar user={user} navItems={navItems} onLogout={logout} />}

      <div className="flex-1">
      {showCamera && (
        <CameraCapture
          onCapture={handleFaceCapture}
          onCancel={() => setShowCamera(false)}
          isLoading={loading}
          error={cameraError}
          onClearError={() => setCameraError(null)}
        />
      )}

      <main className="max-w-5xl mx-auto p-8 space-y-6">

        {/* Status Message */}
        {statusMessage && !showCamera && (
          <div className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
            statusMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' :
            statusMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' :
            'bg-blue-50 text-blue-800 border border-blue-100'
          }`}>
            {statusMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : 
             statusMessage.type === 'success' ? <ShieldCheck className="w-5 h-5 shrink-0" /> :
             <div className="w-5 h-5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />}
            <p className="font-medium mt-0.5">{statusMessage.text}</p>
          </div>
        )}

        {/* Card de Presença Ativa */}
        {activeRecord && (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
            <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                <ShieldCheck className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <h3 className="font-bold text-green-900">Presença Confirmada</h3>
                <p className="text-xs text-green-700">Validado via Google Gemini Vision</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Entrada</span>
                <span className="font-mono font-medium">{formatTime(activeRecord.checkInTime)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Validação Biométrica</span>
                <span className="font-mono font-medium text-green-600">{(activeRecord.livenessConfidence! * 100).toFixed(0)}% (Autêntico)</span>
              </div>
              <Button onClick={handleCheckOut} variant="outline" isLoading={loading} className="w-full mt-2 border-red-200 text-red-600 hover:bg-red-50">
                Registrar Saída
              </Button>
            </div>
          </div>
        )}

        {/* Lista de Aulas */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            Aulas de Hoje
          </h2>

          <div className="space-y-3">
            {classes.map((cls) => (
              <div key={cls.id} className={`relative bg-white rounded-xl border transition-all ${
                cls.isActive ? 'border-blue-200 shadow-sm' : 'border-gray-100 opacity-60'
              }`}>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                      {cls.room}
                    </span>
                    {cls.isActive && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">
                    {cls.courseName}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">{cls.teacherName}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500 font-medium bg-gray-50 p-2 rounded-lg mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Raio 30m
                    </div>
                  </div>

                  {cls.isActive && !activeRecord ? (
                    <Button 
                      onClick={() => initiateCheckIn(cls.id)} 
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                    >
                      <Camera className="w-4 h-4" />
                      Registrar Presença Agora
                    </Button>
                  ) : !activeRecord && (
                    <button disabled className="w-full py-2 text-center text-xs text-gray-400 font-medium bg-gray-50 rounded-lg cursor-not-allowed">
                      Fora do horário
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default Dashboard;