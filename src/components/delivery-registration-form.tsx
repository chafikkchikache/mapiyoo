"use client";

import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

// Define the schemas for individual and company registration
const individualSchema = z.object({
  firstName: z.string().min(2, { message: "Le prénom doit contenir au moins 2 caractères." }),
  lastName: z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone invalide." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone WhatsApp invalide." }),
  email: z.string().email({ message: "Adresse email invalide." }),
  password: z.string().min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." }),
  cin: z.string().optional(),
  cinRectoFile: z.string().optional(), // Simulate file upload with a string
  cinVersoFile: z.string().optional(), // Simulate file upload with a string
  cae: z.string().optional(),
  caeFile: z.string().optional(),
});

const companySchema = z.object({
  companyName: z.string().min(2, { message: "Le nom de l'entreprise doit contenir au moins 2 caractères." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone invalide." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone WhatsApp invalide." }),
  email: z.string().email({ message: "Adresse email invalide." }),
  password: z.string().min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." }),
  rcOrIfNumber: z.string().optional(),
  rcOrIfFile: z.string().optional(), // Simulate file upload with a string
  ice: z.string().optional(),
});

const individualSchemaRequired = individualSchema.extend({
  firstName: z.string().min(2, { message: "Le prénom doit contenir au moins 2 caractères." }),
  lastName: z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone invalide." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone WhatsApp invalide." }),
  email: z.string().email({ message: "Adresse email invalide." }),
  password: z.string().min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." }),
  cin: z.string().min(1, {message: "Le numéro CIN est requis"}),
  cinRectoFile: z.string().min(1, {message: "Le CIN (Recto) est requis"}),
  cinVersoFile: z.string().min(1, {message: "Le CIN (Verso) est requis"}),
  cae: z.string().min(1, {message: "Le numéro CAE est requis"}),
  caeFile: z.string().min(1, {message: "Le fichier CAE est requis"}),
})

const companySchemaRequired = companySchema.extend({
  companyName: z.string().min(2, { message: "Le nom de l'entreprise doit contenir au moins 2 caractères." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone invalide." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Numéro de téléphone WhatsApp invalide." }),
  email: z.string().email({ message: "Adresse email invalide." }),
  password: z.string().min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." }),
  rcOrIfNumber: z.string().min(1, {message: "Le numéro RC ou IF est requis"}),
  rcOrIfFile: z.string().min(1, {message: "Le fichier RC ou IF est requis"}),
})

type IndividualFormValues = z.infer<typeof individualSchemaRequired>;
type CompanyFormValues = z.infer<typeof companySchemaRequired>;

interface DeliveryRegistrationFormProps {
  accountType: 'individual' | 'company';
}

const DeliveryRegistrationForm: React.FC<DeliveryRegistrationFormProps> = ({ accountType }) => {
  const form = useForm<IndividualFormValues | CompanyFormValues>({
    resolver: zodResolver(accountType === 'individual' ? individualSchemaRequired : companySchemaRequired),
    defaultValues: accountType === 'individual' ? {
      firstName: "",
      lastName: "",
      phone: "",
      whatsappPhone: "",
      email: "",
      password: "",
      cin: "",
      cinRectoFile: "",
      cinVersoFile: "",
      cae: "",
      caeFile: "",
    } : {
      companyName: "",
      phone: "",
      whatsappPhone: "",
      email: "",
      password: "",
      rcOrIfNumber: "",
      rcOrIfFile: "",
      ice: "",
    },
    mode: "onSubmit",
  });

  const [rcOrIfPreview, setRcOrIfPreview] = useState<string | null>(null);
  const [cinRectoPreview, setCinRectoPreview] = useState<string | null>(null);
  const [cinVersoPreview, setCinVersoPreview] = useState<string | null>(null);
  const [caeFilePreview, setCaeFilePreview] = useState<string | null>(null);


  const { toast } = useToast();
  const router = useRouter();

  async function onSubmit(values: IndividualFormValues | CompanyFormValues) {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Handle form submission based on account type
    if (accountType === 'individual') {
      const individualValues = values as IndividualFormValues;
      console.log("Individual Registration Data:", individualValues);
      toast({
        title: "Inscription réussie",
        description: `Bienvenue, ${individualValues.firstName} ${individualValues.lastName}!`,
      });
    } else {
      const companyValues = values as CompanyFormValues;
      console.log("Company Registration Data:", companyValues);
      toast({
        title: "Inscription réussie",
        description: `Bienvenue, ${companyValues.companyName}!`,
      });
    }

    // Redirect to dashboard
    router.push('/dashboard');
  }


  const handleRcOrIfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("rcOrIfFile", file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRcOrIfPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCinRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("cinRectoFile", file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCinRectoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

    const handleCinVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("cinVersoFile", file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCinVersoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCaeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("caeFile", file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCaeFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {accountType === 'individual' ? (
          <>
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de l'entreprise</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Corp" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro de téléphone</FormLabel>
              <FormControl>
                <Input placeholder="+15551234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="whatsappPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro de téléphone WhatsApp</FormLabel>
              <FormControl>
                <Input placeholder="+15551234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john.doe@example.com" {...field} />
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
        {accountType === 'individual' ? (
          <>
           <FormField
              control={form.control}
              name="cin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro CIN</FormLabel>
                  <FormControl>
                    <Input placeholder="Numéro CIN" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cinRectoFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CIN (Recto)</FormLabel>
                  <FormControl>
                    <Input type="file" onChange={handleCinRectoUpload} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {cinRectoPreview && (
                <img
                  src={cinRectoPreview}
                  alt="Aperçu CIN Recto"
                  className="max-w-full h-auto rounded-md" // Added max-w-full for responsiveness
                />
              )}


            <FormField
              control={form.control}
              name="cinVersoFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CIN (Verso)</FormLabel>
                  <FormControl>
                    <Input type="file" onChange={handleCinVersoUpload} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {cinVersoPreview && (
                <img
                  src={cinVersoPreview}
                  alt="Aperçu CIN Verso"
                  className="max-w-full h-auto rounded-md" // Added max-w-full for responsiveness
                />
              )}

               <FormField
              control={form.control}
              name="cae"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro CAE</FormLabel>
                  <FormControl>
                    <Input placeholder="Numéro CAE" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caeFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fichier CAE</FormLabel>
                  <FormControl>
                    <Input type="file" onChange={handleCaeFileUpload} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {caeFilePreview && (
                <img
                  src={caeFilePreview}
                  alt="Aperçu du fichier CAE"
                  className="max-w-full h-auto rounded-md" // Added max-w-full for responsiveness
                />
              )}
          </>
        ) : (
          <>
           <FormField
              control={form.control}
              name="rcOrIfNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro RC ou IF</FormLabel>
                  <FormControl>
                    <Input placeholder="Numéro RC ou IF" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rcOrIfFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fichier RC ou IF</FormLabel>
                  <FormControl>
                    <Input type="file" onChange={handleRcOrIfUpload} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             {rcOrIfPreview && (
                <img
                  src={rcOrIfPreview}
                  alt="Aperçu RC ou IF"
                  className="max-w-full h-auto rounded-md" // Added max-w-full for responsiveness
                />
              )}

            <FormField
              control={form.control}
              name="ice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ICE (Optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="ICE" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <Button type="submit">
          {accountType === 'individual' ? 'S\'inscrire en tant qu\'individu' : 'S\'inscrire en tant que société'}
        </Button>
      </form>
    </Form>
  );
};

export default DeliveryRegistrationForm;
