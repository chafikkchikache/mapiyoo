'use client';

import React, {useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import Link from 'next/link';

const RegisterPage = () => {
  const [userType, setUserType] = useState<'client' | 'delivery' | 'chauffeur'>('client');
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

  const ChauffeurRegistrationForm = React.useMemo(
    () => React.lazy(() => import('@/components/chauffeur-registration-form')),
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

  const SuspenseChauffeurRegistrationForm = (props: any) => (
    <React.Suspense fallback={<p>Chargement du formulaire...</p>}>
      <ChauffeurRegistrationForm {...props} />
    </React.Suspense>
  );


  return (
    <div className="flex justify-center items-center min-h-screen bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Central container for buttons to ensure equal dimensions and alignment */}
          <div className="flex justify-center space-x-4 mb-4">
            <button
              className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                userType === 'client'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
              onClick={() => setUserType('client')}
            >
              Client
            </button>
             <button
              className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                userType === 'chauffeur'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
              onClick={() => setUserType('chauffeur')}
            >
              chauffeur
            </button>
            <button
              className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                userType === 'delivery'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
              onClick={() => setUserType('delivery')}
            >
              livreur
            </button>
          </div>

            {userType === 'client' ? (
              <>
                <div className="flex justify-center space-x-4 mb-4"> {/* Added flex-wrap for responsiveness */}
                  <button
                    className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('individual')}
                  >
                    Individuel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
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
            ) :  userType === 'chauffeur' ? (
                  <>
                <div className="flex justify-center space-x-4 mb-4"> {/* Added flex-wrap for responsiveness */}
                  <button
                    className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('individual')}
                  >
                    Individuel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                      accountType === 'company'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('company')}
                  >
                    Société
                  </button>
                </div>
                <SuspenseChauffeurRegistrationForm accountType={accountType} />
              </>
                ) : (
              <>
                <div className="flex justify-center space-x-4 mb-4"> {/* Added flex-wrap for responsiveness */}
                  <button
                    className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
                      accountType === 'individual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-accent'
                    } mb-2`} // Added margin bottom for better spacing in mobile view
                    onClick={() => setAccountType('individual')}
                  >
                    Individuel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md w-40 flex-grow text-center ${
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
