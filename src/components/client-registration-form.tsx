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
import { Icons } from './icons';
import { useToast } from '@/hooks/use-toast';
import { registerClient } from '@/app/actions';

// Define the schemas for individual and company registration
const individualSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  cinRecto: z.string().optional(), // Simulate file upload with a string
  cinVerso: z.string().optional(), // Simulate file upload with a string
});

const companySchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  phone: z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, { message: "Invalid phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  rcOrIf: z.string().optional(), // Simulate file upload with a string
  ice: z.string().optional(),
});

type IndividualFormValues = z.infer<typeof individualSchema>;
type CompanyFormValues = z.infer<typeof companySchema>;

interface ClientRegistrationFormProps {
  accountType: 'individual' | 'company';
}

const ClientRegistrationForm: React.FC<ClientRegistrationFormProps> = ({ accountType }) => {
  const form = useForm<IndividualFormValues | CompanyFormValues>({
    resolver: zodResolver(accountType === 'individual' ? individualSchema : companySchema),
    defaultValues: accountType === 'individual' ? {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      password: "",
      cinRecto: "",
      cinVerso: "",
    } : {
      companyName: "",
      phone: "",
      email: "",
      password: "",
      rcOrIf: "",
      ice: "",
    },
    mode: "onSubmit",
  });

  const { toast } = useToast();

  async function onSubmit(values: IndividualFormValues | CompanyFormValues) {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Call the server action
    await registerClient(values);

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
  }

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
              name="cinRecto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CIN (Recto)</FormLabel>
                  <FormControl>
                    <Input type="file" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cinVerso"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CIN (Verso)</FormLabel>
                  <FormControl>
                    <Input type="file" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name="rcOrIf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RC or IF</FormLabel>
                  <FormControl>
                    <Input type="file" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
