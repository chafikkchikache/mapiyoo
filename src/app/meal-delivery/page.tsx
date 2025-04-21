'use client';

import React, {useState, useRef} from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  DirectionsRenderer,
} from '@react-google-maps/api';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useToast} from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {Locate, MapPin} from 'lucide-react';

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultLocation = {
  lat: 34.052235,
  lng: -118.243683,
};

const MealDeliveryPage = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [directions, setDirections] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [hasGpsPermission, setHasGpsPermission] = useState(false);
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false); // Track if the map is loaded
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const {toast} = useToast();

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
  };

  const calculateRoute = async () => {
    if (origin === '' || destination === '') {
      toast({
        variant: 'destructive',
        title: 'Information Manquante',
        description:
          'Veuillez entrer les adresses de départ et de destination.',
      });
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          console.error('Directions request failed due to ' + status);
          setDirections(null);
          toast({
            variant: 'destructive',
            title: 'Échec du Calcul de l’itinéraire',
            description: 'Impossible de calculer l’itinéraire. Veuillez réessayer.',
          });
        }
      }
    );
  };

  const handleOriginFromMap = () => {
    // Logic to get address from map click
    console.log('Obtenir l’origine de la carte');
  };

  const handleDestinationFromMap = () => {
    // Logic to get address from map click
    console.log('Obtenir la destination de la carte');
  };

  const handleUseCurrentLocation = async () => {
    if (!mapLoaded) {
      toast({
        variant: 'destructive',
        title: 'Carte en chargement',
        description: 'Veuillez attendre que la carte soit complètement chargée.',
      });
      return;
    }

    if (!hasGpsPermission) {
      setIsGpsDialogOpen(true);
      return;
    }

    if (!currentLocation) {
      toast({
        variant: 'destructive',
        title: 'Position Non Disponible',
        description:
          'La position actuelle n’est pas disponible. Veuillez réessayer.',
      });
      return;
    }

    setOrigin(`${currentLocation.lat}, ${currentLocation.lng}`);
  };

  const handleGpsDialogAction = () => {
    setIsGpsDialogOpen(false);
    navigator.geolocation.getCurrentPosition(
      position => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setOrigin(`${position.coords.latitude}, ${position.coords.longitude}`);
        setHasGpsPermission(true);
        toast({
          title: 'GPS Activé',
          description: 'Votre position a été définie comme origine.',
        });
      },
      error => {
        console.error('Error getting GPS location:', error);
        setHasGpsPermission(false);
        toast({
          variant: 'destructive',
          title: 'Accès GPS Refusé',
          description:
            'Veuillez activer les autorisations GPS dans les paramètres de votre navigateur pour utiliser cette application.',
        });
      }
    );
  };

  const handleMapClick = (event, type) => {
    const latLng = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({location: latLng}, (results, status) => {
      if (status === 'OK') {
        if (results[0]) {
          const address = results[0].formatted_address;
          if (type === 'origin') {
            setOrigin(address);
            originInputRef.current.value = address; // Update the input value
          } else {
            setDestination(address);
            destinationInputRef.current.value = address; // Update the input value
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Aucun résultat trouvé',
            description:
              'Impossible de déterminer l’adresse à partir du clic sur la carte.',
          });
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Échec du géocodeur',
          description: 'Échec du géocodeur en raison de : ' + status,
        });
      }
    });
  };

  const onMapLoad = map => {
    mapRef.current = map;
    setMapLoaded(true); // Set mapLoaded to true when the map is loaded
  };

  return (
    <LoadScript googleMapsApiKey={googleMapsApiKey}>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Snack et Restauration</h1>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/2">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse de ramassage
              </label>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-10"
                  placeholder="Adresse de ramassage"
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  ref={originInputRef}
                />
                <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOriginFromMap}
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUseCurrentLocation}
                  >
                    <Locate className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse de destination
              </label>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-10"
                  placeholder="Adresse de destination"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  ref={destinationInputRef}
                />
                <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDestinationFromMap}
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <Button onClick={calculateRoute}>Calculer la Route</Button>
          </div>

          <div className="w-full md:w-1/2">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              defaultCenter={defaultLocation}
              zoom={10}
              options={mapOptions}
              onClick={e => handleMapClick(e, 'destination')}
              onLoad={onMapLoad}
            >
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    polylineOptions: {
                      strokeColor: 'green',
                      strokeOpacity: 0.8,
                      strokeWeight: 5,
                    },
                    suppressMarkers: true,
                  }}
                />
              )}
              {currentLocation && (
                <Marker position={currentLocation} label="Votre Position" />
              )}
            </GoogleMap>
            {!hasGpsPermission && (
              <Alert variant="destructive">
                <AlertTitle>Accès GPS Requis</AlertTitle>
                <AlertDescription>
                  Veuillez autoriser l’accès GPS pour utiliser cette fonctionnalité.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {directions && (
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2">Options de Livraison</h2>
            <div className="flex space-x-4">
              <Button>Ouvrir une Enchère</Button>
              <Button>Trouver un Livreur</Button>
              <Button>MapYOO Service</Button>
            </div>
          </div>
        )}

        <AlertDialog open={isGpsDialogOpen} onOpenChange={setIsGpsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activer le GPS ?</AlertDialogTitle>
              <AlertDialogDescription>
                Voulez-vous activer le GPS pour une localisation automatique ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsGpsDialogOpen(false)}>
                Non, spécifier manuellement
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleGpsDialogAction}>
                Activer GPS
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </LoadScript>
  );
};

export default MealDeliveryPage;
