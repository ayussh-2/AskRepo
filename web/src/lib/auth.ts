export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getUserName(token: string): string {
  try {
    const payload = parseJwtPayload(token);
    if (!payload) return "User";
    return (
      (payload.name as string) ||
      ((payload.email as string)?.split("@")[0]) ||
      "User"
    );
  } catch {
    return "User";
  }
}

export function getTokenExp(token: string): number | null {
  const payload = parseJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}

export function isTokenExpired(token: string): boolean {
  const expMs = getTokenExp(token);
  if (!expMs) return false;
  return expMs <= Date.now();
}

export function triggerSilentGoogleRefresh(onSuccess?: (token: string) => void) {
  if (typeof window === "undefined") return;

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "272374172101-kb5dlfqfcksaoc1m1lm4at4pvfj7e7pd.apps.googleusercontent.com";
  const redirectUri = `${window.location.origin}/dashboard`;
  const nonce = Math.random().toString(36).substring(2);

  const oauthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=id_token&` +
    `scope=${encodeURIComponent("openid email profile")}&` +
    `nonce=${encodeURIComponent(nonce)}&` +
    `prompt=none`;

  const existing = document.getElementById("google-silent-refresh-frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "google-silent-refresh-frame";
  iframe.style.display = "none";
  iframe.setAttribute("aria-hidden", "true");

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "ASKREPO_GOOGLE_TOKEN_REFRESH" && event.data?.token) {
      const newToken = event.data.token;
      localStorage.setItem("google_auth_token", newToken);
      cleanup();
      window.dispatchEvent(
        new CustomEvent("askrepo_token_updated", { detail: { token: newToken } })
      );
      if (onSuccess) onSuccess(newToken);
    } else if (event.data?.type === "ASKREPO_GOOGLE_TOKEN_ERROR") {
      cleanup();
      console.warn("[Auth] Silent token renewal encountered error:", event.data.error);
    }
  };

  window.addEventListener("message", onMessage);
  setTimeout(cleanup, 15000);

  iframe.src = oauthUrl;
  document.body.appendChild(iframe);
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get("id_token");
    const error = params.get("error");

    // If running in a hidden silent-refresh iframe, inform the parent and halt
    if (window.self !== window.top) {
      if (idToken) {
        window.parent.postMessage(
          { type: "ASKREPO_GOOGLE_TOKEN_REFRESH", token: idToken },
          window.location.origin
        );
      } else if (error) {
        window.parent.postMessage(
          { type: "ASKREPO_GOOGLE_TOKEN_ERROR", error },
          window.location.origin
        );
      }
      return null;
    }

    if (idToken) {
      localStorage.setItem("google_auth_token", idToken);
      setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          window.location.hash.includes("id_token")
        ) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      }, 0);
      return idToken;
    }
  }

  if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get("token");
    if (qToken) {
      localStorage.setItem("google_auth_token", qToken);
      return qToken;
    }
  }

  const stored = localStorage.getItem("google_auth_token");
  if (!stored) return null;

  if (isTokenExpired(stored)) {
    clearUserSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("askrepo_token_updated", { detail: { token: null } }),
      );
    }
    return null;
  }

  return stored;
}

export function clearUserSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("google_auth_token");
  localStorage.removeItem("active_ingest_job_id");
  localStorage.removeItem("active_ingest_repo_name");
  localStorage.removeItem("pending_repo_url");
}
