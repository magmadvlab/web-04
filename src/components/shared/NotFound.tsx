import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";

interface NotFoundProps {
  message?: string;
}

export function NotFound({ message }: NotFoundProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg text-muted-foreground">
            {message || "Pagina non trovata"}
          </p>
          <p className="text-sm text-muted-foreground">
            {message 
              ? "La risorsa che stai cercando non esiste o è stata rimossa."
              : "La pagina che stai cercando non esiste o è stata spostata."}
          </p>
          <Link href="/">
            <Button>
              <Home className="mr-2 h-4 w-4" />
              Torna alla Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

