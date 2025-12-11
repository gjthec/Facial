import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { GoogleUser } from "../types";
import { GOOGLE_CLIENT_ID, MOCK_GOOGLE_USER } from "../authConfig";

interface AuthContextType {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Inicializar sessão salva
  useEffect(() => {
    const storedUser = localStorage.getItem("google_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Callback para processar a resposta do token
  const handleTokenResponse = useCallback(async (tokenResponse: any) => {
    if (tokenResponse && tokenResponse.access_token) {
      setIsLoading(true);
      try {
        // Usa o token de acesso para buscar os dados reais do perfil do usuário
        const userInfo = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          }
        ).then((res) => res.json());

        const newUser: GoogleUser = {
          sub: userInfo.sub,
          displayName: userInfo.name,
          email: userInfo.email,
          photoUrl: userInfo.picture,
          role: "student",
          accessToken: tokenResponse.access_token,
        };

        setUser(newUser);
        localStorage.setItem("google_user", JSON.stringify(newUser));
      } catch (error) {
        console.error("Erro ao buscar perfil do usuário Google:", error);
        alert("Erro ao buscar perfil. Verifique o console.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      console.error("Falha ao obter token de acesso Google.", tokenResponse);
    }
  }, []);

  // Inicializar Google Identity Services Client Dinamicamente
  useEffect(() => {
    const initializeGsi = () => {
      if (!window.google || !window.google.accounts) return;

      try {
        console.log("Inicializando TokenClient do Google...");
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope:
            "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid",
          callback: handleTokenResponse,
        });
        setTokenClient(client);
        setScriptLoaded(true);
        console.log("Cliente Google Auth pronto!");
      } catch (error) {
        console.error("Erro ao inicializar Google Client:", error);
      }
    };

    // 1. Se já estiver carregado (ex: navegação entre rotas)
    if (window.google && window.google.accounts) {
      initializeGsi();
      return;
    }

    // 2. Carregar script dinamicamente se não existir
    const scriptId = "google-jssdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      console.log("Injetando script do Google...");
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log("Script do Google carregado.");
        initializeGsi();
      };
      script.onerror = (err) => {
        console.error("Falha ao carregar script do Google:", err);
      };
      document.body.appendChild(script);
    } else {
      // Script já existe mas talvez não tenha terminado de carregar
      console.log("Script já existe no DOM. Aguardando...");
      script.addEventListener("load", initializeGsi);
    }

    return () => {
      if (script) script.removeEventListener("load", initializeGsi);
    };
  }, [handleTokenResponse]);

  const loginWithGoogle = () => {
    setIsLoading(true);

    // 1. Verifica MOCK (Se o usuário não configurou o ID)
    if (
      GOOGLE_CLIENT_ID === "YOUR_CLIENT_ID.apps.googleusercontent.com" ||
      !GOOGLE_CLIENT_ID
    ) {
      console.warn("GOOGLE_CLIENT_ID não configurado. Usando modo MOCK.");
      setTimeout(() => {
        setUser(MOCK_GOOGLE_USER);
        localStorage.setItem("google_user", JSON.stringify(MOCK_GOOGLE_USER));
        setIsLoading(false);
      }, 1000);
      return;
    }

    // 2. Tenta Login Real
    if (tokenClient) {
      // Abre o popup do Google para consentimento
      tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      console.error("Cliente Google Auth não inicializado.");

      let errorMsg = "O serviço de login do Google ainda não carregou.";
      if (!window.google) {
        errorMsg += " Verifique sua conexão com a internet.";
      } else {
        errorMsg += " Tente atualizar a página.";
      }

      alert(errorMsg);
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (user?.accessToken && window.google) {
      try {
        window.google.accounts.oauth2.revoke(user.accessToken, () => {
          console.log("Token revogado");
        });
      } catch (e) {
        console.error("Erro ao revogar token", e);
      }
    }
    setUser(null);
    localStorage.removeItem("google_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loginWithGoogle,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
