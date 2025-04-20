'use client';

import React, {useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

const RegisterPage = () => {
  const [userType, setUserType] = useState<'client' | 'delivery'>('client');
  const [accountType, setAccountType] = useState<'individual' | 'company'>(
    'individual'
  );

  // Dynamically import client components
  const ClientRegistrationForm = React.useMemo(
    () => React.lazy(() => import('@/components/client-registration-form')),
    []
  );

  const DeliveryRegistrationForm = React.useMemo(
    () => React.lazy(() => import('@/components/delivery-registration-form')),
    []
  );

  return (
    <div className="flex justify-center items-center min-h-screen bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <button
              className={`px-4 py-2 rounded-md ${
                userType === 'client'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
              onClick={() => setUserType('client')}
            >
              Register as Client
            </button>
            <button
              className={`px-4 py-2 rounded-md ${
                userType === 'delivery'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
              onClick={() => setUserType('delivery')}
            >
              Register as Delivery Personnel
            </button>
          </div>

          <React.Suspense fallback={<p>Loading form...</p>}>
            {userType === 'client' ? (
              <>
                <div className="flex space-x-4 mb-4">
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    }`}
                    onClick={() => setAccountType('individual')}
                  >
                    Individual
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'company'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    }`}
                    onClick={() => setAccountType('company')}
                  >
                    Company
                  </button>
                </div>
                <ClientRegistrationForm accountType={accountType} />
              </>
            ) : (
              <>
                <div className="flex space-x-4 mb-4">
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    }`}
                    onClick={() => setAccountType('individual')}
                  >
                    Individual
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'company'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    }`}
                    onClick={() => setAccountType('company')}
                  >
                    Company
                  </button>
                </div>
                <DeliveryRegistrationForm accountType={accountType} />
              </>
            )}
          </React.Suspense>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
