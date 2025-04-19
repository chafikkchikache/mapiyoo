import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function MealDeliveryPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="container mx-auto py-12 flex-grow">
        <section className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Deliver a Meal
          </h2>
          <p className="text-muted-foreground mb-6 text-center">
            Page en construction...
          </p>
          <Link href="/">
            <Button>Retour à la page d'accueil</Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
