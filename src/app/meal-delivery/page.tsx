'use client';

import React, {useState, useRef, useEffect} from 'react';
import 'leaflet/dist/leaflet.css';
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
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";

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
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const {toast} = useToast();
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [routeLine, setRouteLine] = useState(null);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    let L;
    const initializeMap = async () => {
      try {
        L = (await import('leaflet')).default;

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
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur de carte',
          description: 'Impossible de charger la carte. Veuillez réessayer plus tard.',
        });
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
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

        if (mapRef.current && position) {
          const L = (await import('leaflet')).default;
          const newMarker = L.marker([position.coords.latitude, position.coords.longitude]).addTo(mapRef.current);
          setOriginMarker(newMarker);
          setOrigin(`${position.coords.latitude}, ${position.coords.longitude}`);

          mapRef.current.setView([position.coords.latitude, position.coords.longitude], 15);

        }
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

    try {
      const originCoords = origin.split(',').map(Number);
      const destinationCoords = destination.split(',').map(Number);

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destinationCoords[1]},${destinationCoords[0]}?geometries=geojson`
      );

      if (!response.ok) {
        throw new Error(`OSRM error: ${response.status}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geoJson = route.geometry;

        const L = (await import('leaflet')).default;
        if (routeLine) {
          mapRef.current.removeLayer(routeLine);
        }

        const newRouteLine = L.geoJSON(geoJson, {
          style: {color: 'blue'},
        }).addTo(mapRef.current);

        setRouteLine(newRouteLine);
      } else {
        toast({
          variant: 'destructive',
          title: 'Aucun itinéraire trouvé',
          description: 'Impossible de calculer un itinéraire entre ces points.',
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de calcul d’itinéraire',
        description: 'Une erreur s’est produite lors du calcul de l’itinéraire.',
      });
    }
  };

  const handleOriginFromMap = () => {
    if (originInputRef.current) {
      originInputRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const handleDestinationFromMap = () => {
    if (destinationInputRef.current) {
      destinationInputRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
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
    if (originInputRef.current) {
      originInputRef.current.value = `${currentLocation.lat}, ${currentLocation.lng}`;
    }

    const L = (await import('leaflet')).default;
    if (mapRef.current && originMarker) {
      mapRef.current.removeLayer(originMarker);
    }
    const newMarker = L.marker([currentLocation.lat, currentLocation.lng]).addTo(mapRef.current);
    setOriginMarker(newMarker);
    mapRef.current.setView([currentLocation.lat, currentLocation.lng], 15);
  };

  const handleGpsDialogAction = async () => {
    setIsGpsDialogOpen(false);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      setCurrentLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setHasGpsPermission(true);

      const L = (await import('leaflet')).default;
      if (mapRef.current && originMarker) {
        mapRef.current.removeLayer(originMarker);
      }

      if (mapRef.current) {
        const newMarker = L.marker([position.coords.latitude, position.coords.longitude]).addTo(mapRef.current);
        setOriginMarker(newMarker);
      }

      setOrigin(`${position.coords.latitude}, ${position.coords.longitude}`);
      if (originInputRef.current) {
        originInputRef.current.value = `${position.coords.latitude}, ${position.coords.longitude}`;
      }

      toast({
        title: 'GPS Activé',
        description: 'Votre position a été définie comme origine.',
      });
    } catch (error) {
      console.error('Error getting GPS location:', error);
      setHasGpsPermission(false);
      toast({
        variant: 'destructive',
        title: 'Accès GPS Refusé',
        description:
          'Veuillez activer les autorisations GPS dans les paramètres de votre navigateur pour utiliser cette application.',
      });
    }
  };

  const handleMapClick = async (e) => {
    if (!mapLoaded) {
      toast({
        variant: 'destructive',
        title: 'Carte en chargement',
        description: 'Veuillez attendre que la carte soit complètement chargée.',
      });
      return;
    }

    const latLng = e.latlng;
    const L = (await import('leaflet')).default;

    if (clickCount === 0) {
      setOrigin(`${latLng.lat}, ${latLng.lng}`);
      if (originInputRef.current) {
        originInputRef.current.value = `${latLng.lat}, ${latLng.lng}`;
      }

      if (mapRef.current && originMarker) {
        mapRef.current.removeLayer(originMarker);
      }
      const newOriginMarker = L.marker([latLng.lat, latLng.lng]).addTo(mapRef.current).bindPopup("Départ").openPopup();
      setOriginMarker(newOriginMarker);

      setDestination('');
      setDestinationMarker(null);

      setClickCount(1);
    } else if (clickCount === 1) {
      setDestination(`${latLng.lat}, ${latLng.lng}`);
      if (destinationInputRef.current) {
        destinationInputRef.current.value = `${latLng.lat}, ${latLng.lng}`;
      }

      if (mapRef.current && destinationMarker) {
        mapRef.current.removeLayer(destinationMarker);
      }
      const newDestinationMarker = L.marker([latLng.lat, latLng.lng]).addTo(mapRef.current).bindPopup("Destination").openPopup();
      setDestinationMarker(newDestinationMarker);

      setClickCount(2);
    } else {
      toast({
        variant: 'destructive',
        title: 'Maximum de points atteints',
        description: 'Veuillez réinitialiser la carte pour choisir de nouveaux points.',
      });
    }
  };

  const resetMap = () => {
    if (mapRef.current) {
      if (originMarker) mapRef.current.removeLayer(originMarker);
      if (destinationMarker) mapRef.current.removeLayer(destinationMarker);
      if (routeLine) mapRef.current.removeLayer(routeLine);

      setOrigin('');
      setDestination('');
      if (originInputRef.current) originInputRef.current.value = '';
      if (destinationInputRef.current) destinationInputRef.current.value = '';
      setOriginMarker(null);
      setDestinationMarker(null);
      setRouteLine(null);
      setClickCount(0);

      mapRef.current.setView([defaultLocation.lat, defaultLocation.lng], 10);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleOriginFromMap}
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Choisir l’adresse de ramassage sur la carte
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleUseCurrentLocation}
                          disabled={!hasGpsPermission}
                        >
                          <Locate className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasGpsPermission ? "Utiliser ma position actuelle" : "Activer le GPS"}
                      </TooltipContent>
                    </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleDestinationFromMap}
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Choisir l’adresse de destination sur la carte
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={calculateRoute} disabled={clickCount !== 2}>Calculer la Route</Button>
                <Button onClick={resetMap} variant="secondary">Réinitialiser</Button>
              </div>
            </div>

            <div className="w-full md:w-1/2">
              {!hasGpsPermission ? (
                <Alert variant="destructive">
                  <AlertTitle>Accès GPS Requis</AlertTitle>
                  <AlertDescription>
                    Veuillez autoriser l’accès GPS pour utiliser cette fonctionnalité.
                  </AlertDescription>
                  <Button onClick={handleUseCurrentLocation} className="mt-2">
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
    </TooltipProvider>
  );
};

export default MealDeliveryPage;
