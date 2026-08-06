import { LoginPageClient } from "@/app/login/LoginPageClient";
import { signUpDisabled } from "@/lib/sign-up-config";

export default function LoginPage() {
  return <LoginPageClient signUpDisabled={signUpDisabled()} />;
}
