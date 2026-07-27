import Layout from "@/screens/layout/layout";
import IngestScreen from "@/screens/ingest/Ingest";
import ProgressScreen from "@/screens/progress/Progress";
import { useState, useEffect } from "react";
import { setApiToken, getStoredToken, getUserNameFromToken } from "@/lib/api";
import { Typography } from "@/components/typography/Typography";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle } from "lucide-react";

function App() {
  const [screen, setScreen] = useState<"ingest" | "progress">("ingest");
  const [jobId, setJobId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [authError, setAuthError] = useState<string | null>(null);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    getStoredToken().then((tok) => {
      if (tok) {
        setToken(tok);
        setUserName(getUserNameFromToken(tok));
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      import.meta.env.WXT_GOOGLE_CLIENT_ID ||
      "";

    if (!clientId || clientId.startsWith("YOUR_GOOGLE")) {
      if (isDev) {
        console.warn(
          "No VITE_GOOGLE_CLIENT_ID provided. Using Demo Mode in DEV.",
        );
        await setApiToken("mock_google_id_token");
        setToken("mock_google_id_token");
        setUserName("Demo User");
        return;
      } else {
        setAuthError("Configuration Error: Missing Google Client ID.");
        return;
      }
    }

    const redirectUrl =
      typeof chrome !== "undefined" && chrome.identity
        ? chrome.identity.getRedirectURL()
        : window.location.origin;

    console.log("Launching OAuth Flow with Redirect URI:", redirectUrl);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=id_token&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `scope=${encodeURIComponent("openid email profile")}&` +
      `nonce=${Math.random().toString(36).substring(2)}`;

    if (typeof chrome !== "undefined" && chrome.identity?.launchWebAuthFlow) {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectResponseUrl?: string) => {
          if (chrome.runtime.lastError || !redirectResponseUrl) {
            const errDetail =
              chrome.runtime.lastError?.message ||
              "Authentication was cancelled or failed.";
            console.error("Google Web Auth Flow error:", errDetail);

            if (isDev) {
              setAuthError(
                `OAuth Error: ${errDetail}. Using Demo Mode fallback.`,
              );
              await setApiToken("mock_google_id_token");
              setToken("mock_google_id_token");
              setUserName("Demo User");
            } else {
              setAuthError(`Authentication Failed: ${errDetail}`);
            }
            return;
          }
          const matches = redirectResponseUrl.match(/id_token=([^&]+)/);
          if (matches && matches[1]) {
            await setApiToken(matches[1]);
            setToken(matches[1]);
            setUserName(getUserNameFromToken(matches[1]));
          } else {
            console.warn(
              "No id_token found in response URL:",
              redirectResponseUrl,
            );
            if (isDev) {
              await setApiToken("mock_google_id_token");
              setToken("mock_google_id_token");
              setUserName("Demo User");
            } else {
              setAuthError(
                "Failed to extract ID token from authentication response.",
              );
            }
          }
        },
      );
    } else {
      if (isDev) {
        await setApiToken("mock_google_id_token");
        setToken("mock_google_id_token");
        setUserName("Demo User");
      } else {
        setAuthError("Chrome identity API unavailable.");
      }
    }
  };

  const handleDemoLogin = async () => {
    if (!isDev) return;
    setAuthError(null);
    const mockToken = "mock_google_id_token";
    await setApiToken(mockToken);
    setToken(mockToken);
    setUserName("Demo User");
  };

  const handleLogout = async () => {
    await setApiToken(null);
    setToken(null);
    setAuthError(null);
  };

  const handleIngestStarted = (id: number) => {
    setJobId(id);
    setScreen("progress");
  };

  const handleBackToIngest = () => {
    setJobId(null);
    setScreen("ingest");
  };

  if (!token) {
    return (
      <Layout>
        <div className="space-y-6 flex flex-col items-center justify-center py-8 text-center px-4">
          <div className="space-y-2">
            <Typography
              variant="headline"
              className="font-semibold text-foreground tracking-tight"
            >
              Welcome to askRepo
            </Typography>
            <Typography
              variant="body-sm"
              className="text-muted-foreground max-w-xs mx-auto"
            >
              Sign in to index and query your repositories.
            </Typography>
          </div>

          {authError && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-950/40 p-2.5 rounded border border-red-900/40 text-left max-w-xs">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              onClick={handleGoogleLogin}
              className="w-full font-medium cursor-pointer"
            >
              Sign In with Google
            </Button>

            {isDev && (
              <Button
                onClick={handleDemoLogin}
                variant="secondary"
                className="w-full font-medium cursor-pointer border border-border text-xs text-muted-foreground"
              >
                Demo Login
              </Button>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between bg-card/40">
        <span className="text-xs text-muted-foreground">
          Signed in as <strong className="text-foreground">{userName}</strong>
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleLogout}
          title="Sign Out"
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>

      {screen === "ingest" ? (
        <IngestScreen onIngestStarted={handleIngestStarted} />
      ) : (
        <ProgressScreen jobId={jobId!} onBack={handleBackToIngest} />
      )}
    </Layout>
  );
}

export default App;
