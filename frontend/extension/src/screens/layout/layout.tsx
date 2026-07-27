import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
    return <div className="bg-background text-foreground p-6 min-w-[320px] min-h-[360px] flex flex-col justify-between font-sans antialiased">
        {children}
    </div>
}