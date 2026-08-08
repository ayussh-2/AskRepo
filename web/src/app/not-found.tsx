import Link from "next/link";
import { FileQuestion, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#010102] text-[#f7f8f8] flex items-center justify-center p-4 font-sans antialiased relative">
      <Card className="w-full max-w-md p-8 text-center border-[#23252a] bg-[#0d0d0e] shadow-2xl relative z-10">
        <CardHeader className="p-0 mb-6 space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#1e2024] border border-[#23252a] flex items-center justify-center text-[#8a8f98]">
            <FileQuestion className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-[#f7f8f8] tracking-tight">
              Page Not Found
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-[#8a8f98] leading-relaxed">
            The page or repository route you are looking for does not exist or
            has been moved.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 flex flex-col gap-3">
          <Link href="/" passHref>
            <Button
              variant="default"
              className="w-full py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <HomeIcon size={16} />
              Return to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
