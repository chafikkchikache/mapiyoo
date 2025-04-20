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
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid phone number." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid WhatsApp phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  cin: z.string().optional(),
  cinRectoFile: z.string().optional(), // Simulate file upload with a string
  cinVersoFile: z.string().optional(), // Simulate file upload with a string
  cae: z.string().optional(),
  caeFile: z.string().optional(),
});

const companySchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid phone number." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid WhatsApp phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  rcOrIfNumber: z.string().optional(),
  rcOrIfFile: z.string().optional(), // Simulate file upload with a string
  ice: z.string().optional(),
});

const individualSchemaRequired = individualSchema.extend({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid phone number." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid WhatsApp phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  cin: z.string().min(1, {message: "CIN Number is required"}),
  cinRectoFile: z.string().min(1, {message: "CIN (Recto) is required"}),
  cinVersoFile: z.string().min(1, {message: "CIN (Verso) is required"}),
  cae: z.string().min(1, {message: "CAE Number is required"}),
  caeFile: z.string().min(1, {message: "CAE File is required"}),
})

const companySchemaRequired = companySchema.extend({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid phone number." }),
  whatsappPhone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid WhatsApp phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  rcOrIfNumber: z.string().min(1, {message: "RC or IF Number is required"}),
  rcOrIfFile: z.string().min(1, {message: "RC or IF File is required"}),
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
        title: "Registration Successful",
        description: `Welcome, ${individualValues.firstName} ${individualValues.lastName}!`,
      });
    } else {
      const companyValues = values as CompanyFormValues;
      console.log("Company Registration Data:", companyValues);
      toast({
        title: "Registration Successful",
        description: `Welcome, ${companyValues.companyName}!`,
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
                  <FormLabel>First Name</FormLabel>
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
                  <FormLabel>Last Name</FormLabel>
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
                <FormLabel>Company Name</FormLabel>
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
              <FormLabel>Phone Number</FormLabel>
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
              <FormLabel>WhatsApp Phone Number</FormLabel>
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
              <FormLabel>Password</FormLabel>
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
                  <FormLabel>CIN Number</FormLabel>
                  <FormControl>
                    <Input placeholder="CIN Number" {...field} />
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
                  alt="CIN Recto Preview"
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
                  alt="CIN Verso Preview"
                  className="max-w-full h-auto rounded-md" // Added max-w-full for responsiveness
                />
              )}

               <FormField
              control={form.control}
              name="cae"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CAE Number</FormLabel>
                  <FormControl>
                    <Input placeholder="CAE Number" {...field} />
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
                  <FormLabel>CAE File</FormLabel>
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
                  alt="CAE File Preview"
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
                  <FormLabel>RC or IF Number</FormLabel>
                  <FormControl>
                    <Input placeholder="RC or IF Number" {...field} />
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
                  <FormLabel>RC or IF File</FormLabel>
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
                  alt="RC or IF Preview"
                  className="max-w-full h-auto rounded-md" // Added max-w-full for responsiveness
                />
              )}

            <FormField
              control={form.control}
              name="ice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ICE (Optional)</FormLabel>
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
          {accountType === 'individual' ? 'Register as Individual' : 'Register as Company'}
        </Button>
      </form>
    </Form>
  );
};

export default ClientRegistrationForm;
