export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

export type AuthFieldErrors = {
  email?: string;
  password?: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
};
