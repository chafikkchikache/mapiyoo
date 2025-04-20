"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

// Define the schema for the login form
const loginSchema = z.object({
  emailOrPhone: z.string().min(1, { message: "Veuillez entrer votre email ou numéro de téléphone." }),
  password: z.string().min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [loginError, setLoginError] = useState<string | null>(null); // State for login errors

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrPhone: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const router = useRouter();
  const { toast } = useToast();

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true); // Set loading to true
    setLoginError(null); // Clear any previous errors

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate a longer API call

    // Simulated check for account existence and password (replace with actual API call)
    let accountExists = true;
    let passwordCorrect = true;

     if (values.emailOrPhone === 'notfound'){
      accountExists = false;
    }
    if (values.password === 'wrong'){
      passwordCorrect = false;
    }

    if (!accountExists) {
      setLoginError("Aucun compte trouvé avec ces informations. Veuillez créer un compte.");
      setIsLoading(false); // Set loading to false
      return;
    }

    if (!passwordCorrect) {
      setLoginError("Mot de passe incorrect.  <Link href='/forgot-password' className='text-primary'>Mot de passe oublié ?</Link>");
      setIsLoading(false);
      return;
    }

    // Handle form submission
    console.log("Login Data:", values);
    toast({
      title: "Connexion réussie",
      description: `Bienvenue!`,
    });

    // Redirect to dashboard or show success message
    router.push('/dashboard');
    setIsLoading(false); // Set loading to false
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-secondary p-4"> {/* Added padding for small screens */}
      <Card className="w-full max-w-md"> {/* Card takes full width on small screens, max width on larger screens */}
        <CardHeader>
          <CardTitle>Se connecter à votre compte</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="emailOrPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email ou numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="john.doe@example.com ou +15551234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {loginError && (
                <div className="text-red-500 text-sm mt-2" dangerouslySetInnerHTML={{ __html: loginError }} />
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </Form>
          <div className="text-sm mt-2">
            <Link href="/forgot-password" className="text-primary">
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="text-sm mt-2">
            Nouveau sur MapYOO ? <Link href="/register" className="text-primary">
              Créer un compte
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
