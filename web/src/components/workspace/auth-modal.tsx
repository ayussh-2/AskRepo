import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export interface AuthModalProps {
  isOpen: boolean;
  onLoginAgain: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onLoginAgain,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm text-center border-[#23252a] bg-[#0d0d0e] shadow-2xl p-6">
        <CardHeader className="p-0 mb-4 space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#1e2024] border border-[#23252a] flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-[#8a8f98]" />
          </div>
          <CardTitle className="text-xl font-semibold text-[#f7f8f8]">
            Session Expired
          </CardTitle>
          <CardDescription className="text-sm text-[#8a8f98]">
            Your session has expired. Please sign in again to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex flex-col gap-3">
          <Button
            variant="default"
            onClick={onLoginAgain}
            className="w-full py-2.5 text-sm font-medium bg-[#5e6ad2] text-white hover:bg-[#4e58b5]"
          >
            Log In Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
