"use client";

import React, { useState } from 'react';
import ClientRegistrationForm from '@/components/client-registration-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RegisterPage = () => {
  const [accountType, setAccountType] = useState<'individual' | 'company'>('individual');

  return (
    <div className="flex justify-center items-center min-h-screen bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <button
              className={`px-4 py-2 rounded-md ${accountType === 'individual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-accent'}`}
              onClick={() => setAccountType('individual')}
            >
              Individual
            </button>
            <button
              className={`px-4 py-2 rounded-md ${accountType === 'company'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-accent'}`}
              onClick={() => setAccountType('company')}
            >
              Company
            </button>
          </div>
          <ClientRegistrationForm accountType={accountType} />
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
