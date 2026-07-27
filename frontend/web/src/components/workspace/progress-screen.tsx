import * as React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export interface ProgressScreenProps {
  progressData: { status: string; error_message: string | null } | null;
  onStartChat: () => void;
  onBackHome: () => void;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  progressData,
  onStartChat,
  onBackHome,
}) => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 w-full">
      <Card className="w-full max-w-sm border-[#23252a] bg-[#0d0d0e] p-6 text-center">
        <CardHeader className="p-0 space-y-1 mb-4">
          <CardTitle className="text-xl font-semibold text-[#f7f8f8]">
            {progressData?.status === "completed"
              ? "Index Complete"
              : progressData?.status === "failed"
                ? "Index Failed"
                : "Indexing Repository"}
          </CardTitle>
          <CardDescription className="text-xs text-[#8a8f98]">
            {progressData?.status === "completed"
              ? "Your repository is ready to be queried."
              : progressData?.status === "failed"
                ? "Something went wrong during the indexing process."
                : "Cloning and parsing your codebase."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 border-t border-[#23252a] pt-4 space-y-4">
          {progressData?.status === "pending" && (
            <div className="flex items-center justify-center gap-2 text-[#8a8f98] text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-[#5e6ad2]" />
              <span>Parsing Codebase...</span>
            </div>
          )}

          {progressData?.status === "completed" && (
            <div className="text-[#27a644] text-xs font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>Successfully Indexed</span>
            </div>
          )}

          {progressData?.status === "failed" && (
            <div className="text-red-400 text-xs">
              {progressData?.error_message || "Error occurred during indexing."}
            </div>
          )}

          <div className="pt-2">
            {progressData?.status === "completed" && (
              <Button onClick={onStartChat} className="w-full py-2.5 text-sm">
                Start Chat Session
              </Button>
            )}

            {(progressData?.status === "failed" || !progressData) && (
              <Button onClick={onBackHome} variant="secondary" className="w-full py-2.5 text-sm">
                Back to Home
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
