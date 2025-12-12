export type UserRole = 'student' | 'teacher';

export interface GoogleUser {
  sub: string; // Google Subject ID (Unique)
  displayName: string;
  email: string;
  role: UserRole;
  accessToken?: string; // OAuth2 Token from Google
  photoUrl?: string;
}

export interface ClassSession {
  id: string;
  courseName: string;
  room: string;
  startTime: string; // ISO Date
  endTime: string; // ISO Date
  teacherName: string;
  isActive: boolean;
  allowedLocation: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  checkInTime: string;
  checkInLocation: { lat: number; lng: number } | null;
  checkOutTime?: string;
  checkOutLocation?: { lat: number; lng: number } | null;
  status: 'present' | 'completed';
  livenessConfidence?: number; // Score de qualidade/realidade da face
  faceId?: string; // ID temporário da detecção (não persistente)
  auditLogId?: string;
}

export interface AuthState {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface FaceDocument {
  id?: string;
  userId: string;
  displayName: string;
  email: string;
  active: boolean;
  embeddings: Record<string, number[]>;
  createdAt?: any;
  updatedAt?: any;
}

export interface PresenceRecord {
  id?: string;
  userId: string;
  displayName: string;
  email: string;
  timestamp: Date;
  status: 'present' | 'denied';
  matcherDistance?: number;
  recognized?: boolean;
  recognizedUserId?: string;
  recognitionNote?: string;
}