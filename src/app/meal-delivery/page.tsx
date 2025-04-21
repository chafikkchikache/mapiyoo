'use client';

import React, {useState, useRef, useEffect} from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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
  const [currentLocation, setCurrentLocation] = useState(null);
  const [hasGpsPermission, setHasGpsPermission] = useState(false);
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false); // Track if the map is loaded
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const {toast} = useToast();

  useEffect(() => {
    const map = L.map('map', {
      center: [defaultLocation.lat, defaultLocation.lng],
      zoom: 10,
      doubleClickZoom: false,
      closePopupOnClick: false,
      crs: L.CRS.EPSG3857,
      attributionControl: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    setMapLoaded(true);

    map.on('click', e => {
      handleMapClick(e);
    });

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setHasGpsPermission(true);
      } catch (error) {
        console.error('Error accessing GPS location:', error);
        setHasGpsPermission(false);
      }
    };

    getCameraPermission();
  }, []);

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

    // Removed Google Maps Directions Service
    toast({
      variant: 'destructive',
      title: 'Calcul de l’itinéraire non supporté',
      description:
        'Le calcul de l’itinéraire n’est pas pris en charge avec OpenStreetMap.',
    });
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

  const handleMapClick = (e) => {
    if (!mapLoaded) {
      toast({
        variant: 'destructive',
        title: 'Carte en chargement',
        description: 'Veuillez attendre que la carte soit complètement chargée.',
      });
      return;
    }

    const latLng = e.latlng;
    setDestination(`${latLng.lat}, ${latLng.lng}`);

    // Reverse geocoding with OpenStreetMap Nominatim API
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latLng.lat}&lon=${latLng.lng}`)
      .then(response => response.json())
      .then(data => {
        if (data && data.display_name) {
          setDestination(data.display_name);
          destinationInputRef.current.value = data.display_name;
        } else {
          toast({
            variant: 'destructive',
            title: 'Aucun résultat trouvé',
            description: 'Impossible de déterminer l’adresse à partir du clic sur la carte.',
          });
        }
      })
      .catch(error => {
        console.error('Erreur lors du géocodage inverse:', error);
        toast({
          variant: 'destructive',
          title: 'Échec du géocodage',
          description: 'Échec du géocodage inverse en raison de : ' + error,
        });
      });
  };

  const requestGpsPermission = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      setCurrentLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setHasGpsPermission(true);
      toast({
        title: 'GPS Activé',
        description: 'Votre position a été déterminée.',
      });
    } catch (error) {
      console.error('Error accessing GPS location:', error);
      setHasGpsPermission(false);
      toast({
        variant: 'destructive',
        title: 'Accès GPS Refusé',
        description:
          'Veuillez activer les autorisations GPS dans les paramètres de votre navigateur pour utiliser cette application.',
      });
    }
  };

  return (
    <div>
      <div id="map" style={mapContainerStyle} />
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
            {!hasGpsPermission ? (
              <Alert variant="destructive">
                <AlertTitle>Accès GPS Requis</AlertTitle>
                <AlertDescription>
                  Veuillez autoriser l’accès GPS pour utiliser cette fonctionnalité.
                </AlertDescription>
                <Button onClick={requestGpsPermission} className="mt-2">
                  Autoriser l'accès GPS
                </Button>
              </Alert>
            ) : null}
          </div>
        </div>

        {currentLocation && (
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
    </div>
  );
};

export default MealDeliveryPage;
