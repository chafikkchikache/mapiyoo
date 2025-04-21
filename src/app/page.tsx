'use client';

import {Button} from '@/components/ui/button';
import Link from 'next/link';
import {useState, useEffect} from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {MoreVertical} from 'lucide-react';
import {useRouter} from 'next/navigation';

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Mock authentication check (replace with actual authentication logic)
  const isAuthenticated = false; // Example: check if user is logged in

  const handleNavigation = (path: string) => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-secondary p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <a href="/" className="text-2xl font-semibold text-foreground">
            MapYOO
          </a>
          {/* Hide on small screens, show on medium and up */}
          <nav className="hidden md:flex">
            <ul className="flex space-x-4">
              <li>
                <a href="#" className="hover:text-accent-foreground">
                  Snack et Restauration
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-foreground">
                  Colis
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-foreground">
                  Courses
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex items-center space-x-2">
            {/* Added flex and spacing for better alignment */}
            <Link href="/login">
              <Button variant="outline" className="w-32">Se connecter</Button>
            </Link>
            <Link href="/register">
              <Button className="w-32">S'inscrire</Button>
            </Link>
            <Button variant="ghost">Aide</Button>
          </div>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="">
              <Button variant="ghost" className="h-8 w-8 p-0 md:hidden">
                <span className="sr-only">Ouvrir le menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="">
              <DropdownMenuItem>
                <Link href="#" className="w-full">
                  Snack et Restauration
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="#" className="w-full">
                  Colis
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="#" className="w-full">
                  Course
                </Link>
              </DropdownMenuItem>
               <DropdownMenuItem>
                <Link href="#" className="w-full">
                  Aide
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container mx-auto py-12 flex-grow">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Grid changes to 2 columns on medium screens and up */}
          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              colie et package
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
            Expédiez vos colis en un clin d’œil...
            </p>
            <Button onClick={() => handleNavigation('/register')}>Commencer la livraison</Button>
          </div>

          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Snack et Restauration
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
             Optimisez vos livraisons et touchez plus de clients...
            </p>
            <Button onClick={() =>  router.push('/meal-delivery')}>Livrer un repas</Button>
          </div>
        </section>

        {/* New section for finding a ride */}
        <section className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Vous cherchez un trajet ?
          </h2>
          <p className="text-muted-foreground mb-6 text-center">
            Réservez une course maintenant ou planifiez-la plus tard, directement depuis votre navigateur.
          </p>
          <Button onClick={() => handleNavigation('/dashboard')}>Trouver un chauffeur</Button>
        </section>
      </main>

      <footer className="bg-secondary p-4 text-center text-muted-foreground">
        <p className="text-sm">© 2024 MapYOO. All rights reserved.</p>
      </footer>
    </div>
  );
}

