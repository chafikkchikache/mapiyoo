import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-secondary p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <a href="/" className="text-2xl font-semibold text-foreground">
            MapYOO
          </a>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <a href="#" className="hover:text-accent-foreground">
                  Repas
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-foreground">
                  Colis
                </a>
              </li>
            </ul>
          </nav>
          <div>
            <Button variant="outline">Login</Button>
            <Link href="/register">
            <Button>Sign Up</Button>
            </Link>
            <Button variant="ghost">Help</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-12 flex-grow">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Deliver a Package
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
              Expédiez vos colis en un clin d’œil...
            </p>
            <Button>Livrer un colis</Button>
          </div>

          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Deliver a Meal
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
              Optimisez vos livraisons et touchez plus de clients...
            </p>
            <Button>Livrer un repas</Button>
          </div>
        </section>
      </main>

      <footer className="bg-secondary p-4 text-center text-muted-foreground">
        <p>© 2024 MapYOO. All rights reserved.</p>
      </footer>
    </div>
  );
}
