export type AuthEmailPurpose = "email_verification" | "password_reset";

export type OutboundAuthEmail = {
  to: string;
  subject: string;
  text: string;
  purpose: AuthEmailPurpose;
  url: string;
};
