// Shared types and constants between client and server

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type Grade = 9 | 10 | 11 | 12;

export type SubjectCategory =
  | "MATH"
  | "SCIENCE"
  | "ENGLISH"
  | "HISTORY"
  | "WORLD_LANGUAGE"
  | "ELECTIVE"
  | "AP"
  | "OTHER";

export type Urgency = "LOW" | "MEDIUM" | "HIGH";

export type BadgeType = "TOP_RATED" | "RECOMMENDED" | "HIGHLY_SKILLED";

export type RequestStatus =
  | "OPEN"
  | "MATCHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type MatchStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "COMPLETED"
  | "NO_SHOW";

export type UserRole = "STUDENT" | "ADMIN";

// ---- DTOs ----

export interface UserDTO {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  grade: Grade;
  role: UserRole;
  bio?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  isTutor: boolean;
  notificationsEnabled?: boolean;
  createdAt: string;
}

export interface SubjectDTO {
  id: string;
  name: string;
  category: SubjectCategory;
}

export interface TutorSubjectDTO {
  id: string;
  userId: string;
  subjectId: string;
  subject: SubjectDTO;
  selfRating: number;
  teacherEndorsed: boolean;
  createdAt: string;
}

export interface TutorAvailabilityDTO {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TutorBadgeDTO {
  id: string;
  userId: string;
  badge: BadgeType;
  awardedAt: string;
}

export interface TutorProfileDTO extends UserDTO {
  tutorSubjects: TutorSubjectDTO[];
  averageRating: number | null;
  totalHoursTutored: number;
  badges: TutorBadgeDTO[];
  availability: TutorAvailabilityDTO[];
}

export interface TutoringRequestDTO {
  id: string;
  requesterId: string;
  requester: Pick<UserDTO, "id" | "firstName" | "lastName" | "grade" | "avatarUrl">;
  subjectId: string;
  subject: SubjectDTO;
  description: string;
  urgency: Urgency;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MatchDTO {
  id: string;
  requestId?: string | null;
  request?: TutoringRequestDTO | null;
  studentId?: string | null;
  student?: Pick<UserDTO, "id" | "firstName" | "lastName" | "grade" | "avatarUrl"> | null;
  subjectId?: string | null;
  subject?: SubjectDTO | null;
  note?: string | null;
  tutorId: string;
  tutor: Pick<UserDTO, "id" | "firstName" | "lastName" | "grade" | "avatarUrl">;
  status: MatchStatus;
  scheduledAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDTO {
  id: string;
  matchId: string;
  match: MatchDTO;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  actualDurationMinutes?: number | null;
  notes?: string | null;
  tutorConfirmed: boolean;
  tuteeConfirmed: boolean;
  confirmCode?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  reviews?: ReviewDTO[];
}

export interface ReviewDTO {
  id: string;
  sessionId?: string | null;
  tutorId?: string | null;
  reviewerId: string;
  reviewer: Pick<UserDTO, "id" | "firstName" | "lastName" | "avatarUrl">;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface VolunteerHourLogDTO {
  id: string;
  userId: string;
  totalMinutes: number;
  period: string;
  lastUpdatedAt: string;
  exportedAt?: string | null;
}

export interface HourSummaryDTO {
  totalMinutes: number;
  totalHours: number;
  currentPeriod: string;
  logs: VolunteerHourLogDTO[];
}

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TutorVerificationDTO {
  id: string;
  userId: string;
  subjectId: string;
  subject: SubjectDTO;
  evidenceType: "grades" | "skyward" | "screenshot" | "other";
  evidenceNote: string;
  evidenceUrl?: string | null;
  gpaOrGrade?: string | null;
  selfRating: number;
  status: VerificationStatus;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<UserDTO, "id" | "firstName" | "lastName" | "email" | "grade">;
}

// ---- Constants ----

export const LTHS_EMAIL_DOMAIN = "@ltisdschools.org";
export const MAX_OPEN_REQUESTS = 5;
export const MIN_SESSION_MINUTES = 15;
export const MAX_SESSION_MINUTES = 180;
export const SESSION_CONFIRM_HOURS = 72;
