/**
 * BACKEND SERVER - ATTENDANCE ANTI-FRAUD SYSTEM
 * 
 * Tecnologias: Node.js, Express, PostgreSQL (PostGIS), Azure Face API
 * Objetivo: Registrar presença garantindo que é um humano real no local correto.
 * 
 * --- INSTRUÇÕES DE CONFIGURAÇÃO ---
 * 
 * 1. AZURE ENTRA ID (App Registration):
 *    - Crie um novo registro no portal do Azure.
 *    - Adicione Plataforma "Single Page Application" (para React) ou "Mobile" (para React Native).
 *    - Permissões (API Permissions): Microsoft Graph (User.Read).
 * 
 * 2. AZURE FACE API:
 *    - Crie um recurso "Face" no Azure.
 *    - Anote o ENDPOINT e a KEY.
 *    - NOTA SOBRE LIVENESS: A detecção passiva de qualidade usada aqui (blur, exposure, noise)
 *      ajuda a evitar fotos ruins, mas para "Liveness" certificado (ISO 30107-3), 
 *      você deve solicitar acesso ao "Face Liveness SDK" no Azure e implementar o fluxo de sessão.
 *      Este código implementa a "Detecção de Qualidade e Atributos" robusta via API REST padrão.
 * 
 * 3. VARIÁVEIS DE AMBIENTE (.env):
 *    PORT=3000
 *    DATABASE_URL=postgres://user:pass@localhost:5432/attendance_db
 *    AZURE_FACE_ENDPOINT=https://seurecurso.cognitiveservices.azure.com/
 *    AZURE_FACE_KEY=sua_chave_aqui
 * 
 * 4. SQL SETUP:
 *    CREATE EXTENSION IF NOT EXISTS postgis;
 *    CREATE TABLE classes (
 *      id SERIAL PRIMARY KEY,
 *      course_name VARCHAR(100),
 *      start_time TIMESTAMP,
 *      end_time TIMESTAMP,
 *      location GEOGRAPHY(POINT, 4326),
 *      radius_meters INT DEFAULT 30
 *    );
 *    CREATE TABLE attendance_audit (
 *      id SERIAL PRIMARY KEY,
 *      user_sub VARCHAR(255),
 *      class_id INT,
 *      timestamp TIMESTAMP DEFAULT NOW(),
 *      location GEOGRAPHY(POINT, 4326),
 *      face_detected BOOLEAN,
 *      face_id_temp VARCHAR(100),
 *      liveness_score FLOAT, -- Simulado via análise de atributos
 *      ip_address VARCHAR(45),
 *      user_agent TEXT
 *    );
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const axios = require('axios'); // Usando axios para controle total da REST API do Azure

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuração Upload (Memória)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // Limite 5MB
});

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware de Auth (Mock para o exemplo - em prod usar passport-azure-ad)
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Token ausente" });
  // Aqui você validaria o JWT da Microsoft
  req.user = { sub: "ms-mock-user-id" }; 
  next();
};

/**
 * Endpoint Crítico: CHECK-IN
 * 1. Valida Token
 * 2. Valida Geolocalização (PostGIS)
 * 3. Valida Horário
 * 4. Valida Face Humana Única (Azure Face API)
 */
app.post('/api/attendance/check-in', requireAuth, upload.single('image'), async (req, res) => {
  const { classId, lat, lng } = req.body;
  const userIp = req.ip;
  const userAgent = req.headers['user-agent'];

  if (!req.file) return res.status(400).json({ error: "Selfie é obrigatória." });
  if (!lat || !lng) return res.status(400).json({ error: "Localização GPS é obrigatória." });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. VALIDAÇÃO DE CONTEXTO (Local e Hora)
    // Busca a aula e verifica se o aluno está no raio de 30m e no horário correto
    const classQuery = `
      SELECT id, course_name, 
             ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)) as distance_meters
      FROM classes 
      WHERE id = $1 
      AND start_time <= NOW() + INTERVAL '15 minutes' 
      AND end_time >= NOW() - INTERVAL '15 minutes'
    `;
    
    const classResult = await client.query(classQuery, [classId, lng, lat]);

    // Se aula não encontrada ou fora do horário
    // Nota: Em prod, trate erros de 'não encontrado' vs 'fora do horário' separadamente para melhor UX
    if (classResult.rowCount === 0) {
      throw new Error("Aula não encontrada ou fora do horário permitido.");
    }

    const { distance_meters } = classResult.rows[0];
    const MAX_DISTANCE = 30; // metros

    if (distance_meters > MAX_DISTANCE) {
      throw new Error(`Localização inválida. Você está a ${Math.round(distance_meters)}m da sala. Aproxime-se.`);
    }

    // 2. VALIDAÇÃO BIOMÉTRICA (Azure Face API - Detect)
    // Documentação: https://westus.dev.cognitive.microsoft.com/docs/services/face-v1-0-preview/operations/563879b61984550f30395236
    const azureUrl = `${process.env.AZURE_FACE_ENDPOINT}/face/v1.0/detect`;
    
    const azureParams = {
      returnFaceId: true,
      returnFaceLandmarks: false,
      returnFaceAttributes: "blur,exposure,noise,headPose", // Atributos para verificar qualidade/liveness passivo
      detectionModel: "detection_03", // Melhor para liveness e anti-spoofing
      recognitionModel: "recognition_04"
    };

    const azureResponse = await axios.post(azureUrl, req.file.buffer, {
      params: azureParams,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': process.env.AZURE_FACE_KEY
      }
    });

    const faces = azureResponse.data;

    // Regra 2.1: Deve haver EXATAMENTE UMA face
    if (faces.length === 0) throw new Error("Nenhum rosto detectado. Remova máscaras e óculos escuros.");
    if (faces.length > 1) throw new Error("Múltiplos rostos detectados. Apenas você deve aparecer na foto.");

    const face = faces[0];
    const attrs = face.faceAttributes;

    // Regra 2.2: Validação de Qualidade (Anti-spoofing básico)
    // Rejeitar fotos muito borradas ou com ruído excessivo (comum em fotos de telas)
    if (attrs.blur && attrs.blur.blurLevel === 'High') throw new Error("Foto muito borrada. Mantenha a câmera firme.");
    if (attrs.noise && attrs.noise.noiseLevel === 'High') throw new Error("Imagem com muito ruído. Melhore a iluminação.");

    // Sucesso - Gravar Auditoria
    const insertAudit = `
      INSERT INTO attendance_audit 
      (user_sub, class_id, location, face_detected, face_id_temp, liveness_score, ip_address, user_agent)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), TRUE, $5, $6, $7, $8)
      RETURNING id, timestamp
    `;

    // Calculamos um "score" fictício baseado na qualidade para fins de log
    const qualityScore = 1.0 - (attrs.noise?.value || 0); 

    const auditResult = await client.query(insertAudit, [
      req.user.sub, 
      classId, 
      lng, 
      lat, 
      face.faceId, 
      qualityScore,
      userIp,
      userAgent
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Presença registrada com sucesso.",
      data: {
        recordId: auditResult.rows[0].id,
        timestamp: auditResult.rows[0].timestamp,
        distance: Math.round(distance_meters)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Erro Check-in:", error.message);
    
    // Log de falha de segurança
    // Em produção: salvar tentativas falhas no banco também
    res.status(400).json({ 
      success: false, 
      error: error.message || "Erro no processamento da presença." 
    });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Sistema de Presença Seguro rodando na porta ${port}`);
});