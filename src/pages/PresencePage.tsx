import React, { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { CameraCapture } from "../components/CameraCapture";
// 👇 por enquanto, sem reconhecimento facial
// import { recognizeUserByFace, loadFaceMatcher } from '../services/faceRecognitionService';
import { db } from "../services/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { PresenceRecord, GoogleUser } from "../types";
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  LayoutDashboard,
  ScanFace,
  Users,
  UserPlus,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

const PresencePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<string>(
    "Capture sua face para registrar presença."
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PresenceRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAILS = ["admin@dominio.com"];
  const isAdmin = (u?: GoogleUser | null) =>
    !!u && (ADMIN_EMAILS.includes(u.email) || u.role === "teacher");

  const navItems = useMemo(
    () => [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
      {
        label: "Registrar Presença",
        to: "/presence",
        icon: <ScanFace className="w-4 h-4" />,
      },
      ...(isAdmin(user)
        ? [
            {
              label: "Faces Autorizadas",
              to: "/admin/faces",
              icon: <Users className="w-4 h-4" />,
            },
            {
              label: "Novo Cadastro",
              to: "/admin/faces/new",
              icon: <UserPlus className="w-4 h-4" />,
            },
          ]
        : []),
    ],
    [user]
  );

  // 🔧 Modo teste: só grava no Firestore
  const registerPresence = async (record: PresenceRecord) => {
    await addDoc(collection(db, "presences"), {
      ...record,
      timestamp: serverTimestamp(),
    });
  };

  const handleCapture = async (blob: Blob) => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setStatus("Registrando presença...");

    try {
      // Se quiser fazer algo com a imagem, dá pra usar o blob aqui
      const recognitionNote =
        "Reconhecimento facial desativado em modo de teste. Presença registrada sem validação facial.";

      const record: PresenceRecord = {
        userId: user.sub,
        displayName: user.displayName,
        email: user.email,
        status: "present",
        timestamp: new Date(),
        recognized: false,
        recognitionNote,
      };

      await registerPresence(record);
      setSuccess(record);
      setStatus("Presença registrada (modo teste, sem validação facial).");
    } catch (e) {
      console.error(e);
      const fallbackRecord: PresenceRecord = {
        userId: user.sub,
        displayName: user.displayName,
        email: user.email,
        status: "present",
        timestamp: new Date(),
        recognitionNote:
          "Erro inesperado ao registrar presença em modo teste. Verifique o Firestore.",
      };
      try {
        await registerPresence(fallbackRecord);
        setSuccess(fallbackRecord);
        setStatus(
          "Presença registrada, mas ocorreu um erro durante o processo."
        );
      } catch (inner) {
        console.error(inner);
        setError(
          "Não foi possível registrar presença. Verifique o Firestore e a conexão."
        );
        setStatus("Falha ao registrar presença.");
      }
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
          <p className="text-sm text-gray-500">
            Capture sua imagem para registrar presença.
          </p>
        </div>

        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setStatus("Captura cancelada.")}
          isLoading={loading}
          error={error}
          onClearError={() => setError(null)}
        />

        {status && <div className="text-sm text-gray-700">{status}</div>}

        {success && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-md flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">
                Presença registrada
              </p>
              <p className="text-sm text-green-700">
                {success.displayName} - {success.email}
              </p>
              {success.recognitionNote && (
                <p className="text-xs text-green-700 mt-1">
                  {success.recognitionNote}
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">{error}</p>
              <p className="text-sm text-red-700">
                Verifique a conexão com o Firestore e se as regras permitem
                leitura/escrita em `presences`.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PresencePage;
