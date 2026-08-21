import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Uses current origin in the browser when omitted
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  updateUser,
  changePassword,
  deleteUser,
} = authClient;
