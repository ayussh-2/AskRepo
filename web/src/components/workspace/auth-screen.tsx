import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export interface AuthScreenProps {
  onLogin: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
}) => {
  return (
    <div className="flex-1 flex justify-center items-center bg-[#010102] text-[#f7f8f8] p-4 min-h-screen relative font-sans antialiased">
      <Card className="w-full max-w-sm p-8 text-center border-[#23252a] bg-[#0d0d0e]">
        <CardHeader className="p-0 mb-6 space-y-2">
          <CardTitle className="text-[26px] font-semibold text-[#f7f8f8] tracking-tight leading-tight">
            Welcome to askRepo
          </CardTitle>
          <CardDescription className="text-[14px] text-[#8a8f98] leading-relaxed max-w-[280px] mx-auto">
            Please sign in with your Google account to index and chat with your
            repositories.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 flex flex-col gap-3">
          <Button
            onClick={onLogin}
            className="w-full py-2.5 text-[14px] bg-[#5e6ad2] text-white hover:bg-[#4e58b5] font-medium transition-colors"
          >
            Sign In with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
