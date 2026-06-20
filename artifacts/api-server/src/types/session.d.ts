import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      subscriptionTier: "amateur" | "professional";
      selectedTeamId: string | null;
    };
  }
}
