"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/workspace/auth-screen";
import { getStoredToken } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = getStoredToken();
      if (savedToken) {
        const params = new URLSearchParams(window.location.search);
        const repoParam = params.get("repo");
        if (repoParam) {
          router.push(`/dashboard?repo=${encodeURIComponent(repoParam)}`);
        } else {
          router.push("/dashboard");
        }
      }
    }
  }, [router]);

  const handleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
    const redirectUri = window.location.origin;
    const nonce = Math.random().toString(36).substring(2);
    
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(clientId)}&` + 
      `redirect_uri=${encodeURIComponent(redirectUri)}&` + 
      `response_type=id_token&` + 
      `scope=${encodeURIComponent("openid email profile")}&` + 
      `nonce=${encodeURIComponent(nonce)}`;
      
    window.location.href = oauthUrl;
  };

  return <AuthScreen onLogin={handleLogin} />;
}
