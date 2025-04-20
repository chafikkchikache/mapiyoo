'use client';

import {Button} from '@/components/ui/button';
import {Icons} from '@/components/icons';
import Link from 'next/link';
import {useState} from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {MoreVertical} from 'lucide-react';

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-secondary p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <a href="/" className="text-2xl font-semibold text-foreground">
            MapYOO
          </a>
          <nav className="hidden md:block">
            {/* Hide on small screens, show on medium and up */}
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
              <li>
                <a href="#" className="hover:text-accent-foreground">
                  Courses
                </a>
              </li>
            </ul>
          </nav>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="md:hidden">
              <DropdownMenuItem>
                <Link href="#" className="w-full">
                  Repas
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
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center space-x-2">
            {/* Added flex and spacing for better alignment */}
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up</Button>
            </Link>
            <Button variant="ghost">Help</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-12 flex-grow">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Grid changes to 2 columns on medium screens and up */}
          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Deliver a Package
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
              Expédiez vos colis en un clin d’œil...
            </p>
            <Link href="/package-delivery">
              <Button>Livrer un colis</Button>
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md bg-card">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Deliver a Meal
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
              Optimisez vos livraisons et touchez plus de clients...
            </p>
            <Link href="/meal-delivery">
              <Button>Livrer un repas</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-secondary p-4 text-center text-muted-foreground">
        <p>© 2024 MapYOO. All rights reserved.</p>
      </footer>
    </div>
  );
}
