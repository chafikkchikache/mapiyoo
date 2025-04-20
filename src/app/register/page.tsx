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

  const SuspenseClientRegistrationForm = (props: any) => (
    <React.Suspense fallback={<p>Chargement du formulaire...</p>}>
      <ClientRegistrationForm {...props} />
    </React.Suspense>
  );

  const SuspenseDeliveryRegistrationForm = (props: any) => (
    <React.Suspense fallback={<p>Chargement du formulaire...</p>}>
      <DeliveryRegistrationForm {...props} />
    </React.Suspense>
  );


  return (
    <div className="flex justify-center items-center min-h-screen bg-secondary p-4"> {/* Added padding for responsiveness */}
      <Card className="w-full max-w-md"> {/* Card takes full width on small screens, max width on larger screens */}
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap space-x-4 mb-4"> {/* Added flex-wrap for responsiveness */}
            <button
              className={`px-4 py-2 rounded-md ${
                userType === 'client'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              } mb-2`} // Added margin bottom for better spacing in mobile view
              onClick={() => setUserType('client')}
            >
              Je suis client
            </button>
            <button
              className={`px-4 py-2 rounded-md ${
                userType === 'delivery'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
              onClick={() => setUserType('delivery')}
            >
              Je suis livreur
            </button>
          </div>

            {userType === 'client' ? (
              <>
                <div className="flex flex-wrap space-x-4 mb-4"> {/* Added flex-wrap for responsiveness */}
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('individual')}
                  >
                    Individuel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'company'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('company')}
                  >
                    Société
                  </button>
                </div>
                <SuspenseClientRegistrationForm accountType={accountType} />
              </>
            ) : (
              <>
                <div className="flex flex-wrap space-x-4 mb-4"> {/* Added flex-wrap for responsiveness */}
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('individual')}
                  >
                    Individuel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${
                      accountType === 'company'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('company')}
                  >
                    Société
                  </button>
                </div>
                <SuspenseDeliveryRegistrationForm accountType={accountType} />
              </>
            )}

        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
