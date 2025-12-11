/**
 * ARQUIVO DE CONFIGURAÇÃO DE AUTENTICAÇÃO GOOGLE
 *
 * Instruções para produção:
 * 1. Crie um projeto no Google Cloud Console.
 * 2. Configure a tela de consentimento OAuth.
 * 3. Crie credenciais de "ID do cliente OAuth 2.0" para Aplicação Web.
 * 4. Utilize uma biblioteca como @react-oauth/google ou firebase/auth.
 */

export const GOOGLE_CLIENT = {
  clientId:
    "455563875480-hba2lg34ahn8a62uchcaa7llqhtnkqn6.apps.googleusercontent.com",
  scope: "profile email openid",
  redirectUri: "https://facial-project-umber.vercel.app",
};
export const GOOGLE_CLIENT_ID =
  "455563875480-hba2lg34ahn8a62uchcaa7llqhtnkqn6.apps.googleusercontent.com";
// --- SIMULAÇÃO PARA ESTE DEMO ---
// Simulamos o objeto de usuário retornado pelo Google Identity Services

export const MOCK_GOOGLE_USER = {
  sub: "google-1029384756",
  displayName: "Aluno Exemplo Google",
  email: "aluno@gmail.com",
  role: "student" as const,
  photoUrl: "https://lh3.googleusercontent.com/a/default-user",
  accessToken: "ya29.a0Af... (simulated_google_token) ...xyz",
};
