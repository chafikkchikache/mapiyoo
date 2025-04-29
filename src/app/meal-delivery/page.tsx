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
import type L from 'leaflet'; // Import Leaflet type

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultLocation = {
  lat: 34.052235,
  lng: -118.243683,
};

// Define a custom red marker icon
let redIcon: L.Icon | undefined;
if (typeof window !== 'undefined') { // Check if window is defined (client-side)
  import('leaflet').then(L => {
    redIcon = new L.Icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  });
}


const MealDeliveryPage = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null); // Use null to represent initial state
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const {toast} = useToast();
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [routeLine, setRouteLine] = useState<L.GeoJSON | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const LRef = useRef<typeof L | null>(null); // Ref to store Leaflet instance


  // Initialize Leaflet dynamically on the client-side
  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || LRef.current) return; // Ensure it runs only on client and only once

      try {
        const L = (await import('leaflet')).default;
        LRef.current = L; // Store Leaflet instance

        // Check if the map container exists
        const mapElement = document.getElementById('map');
        if (!mapElement || mapRef.current) return; // Exit if container not found or map already initialized

        const map = L.map(mapElement, {
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

        map.on('click', (e: L.LeafletMouseEvent) => {
           handleMapClick(e);
        });

        // Attempt to get initial GPS permission status
        checkGpsPermission();


      } catch (error) {
        console.error('Failed to load Leaflet or initialize map:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur de carte',
          description: 'Impossible de charger la carte. Veuillez réessayer plus tard.',
        });
      }
    };

    initializeMap();

    // Cleanup function to remove the map instance
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null; // Ensure the ref is cleared
      }
    };
  }, [toast]); // Added toast to dependencies


  // Check initial GPS permission state
  const checkGpsPermission = async () => {
      if (!navigator.geolocation) {
          setHasGpsPermission(false);
          return;
      }
       try {
           const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
           setHasGpsPermission(permissionStatus.state === 'granted');
           if (permissionStatus.state === 'granted') {
                getCurrentLocationAndSetOrigin(); // Get location if permission already granted
           }
           permissionStatus.onchange = () => {
               setHasGpsPermission(permissionStatus.state === 'granted');
                if (permissionStatus.state === 'granted') {
                    getCurrentLocationAndSetOrigin();
                } else {
                    setCurrentLocation(null); // Clear location if permission revoked
                }
           };
       } catch (error) {
           console.error("Error checking GPS permission:", error);
           setHasGpsPermission(false); // Assume no permission if query fails
       }
   };

  // Get current location and update map/origin state
  const getCurrentLocationAndSetOrigin = async () => {
    if (!LRef.current || !mapRef.current) return;
    const L = LRef.current;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
      });
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCurrentLocation(coords);
      setHasGpsPermission(true); // Explicitly set to true after successful retrieval

      // Clear previous origin marker if it exists
      if (originMarker) {
        mapRef.current.removeLayer(originMarker);
      }

      // Add new red marker for current location
      const newMarker = L.marker([coords.lat, coords.lng], { icon: redIcon }).addTo(mapRef.current).bindPopup("Votre Position").openPopup();
      setOriginMarker(newMarker);

      // Update origin state and input field
      const originString = `${coords.lat}, ${coords.lng}`;
      setOrigin(originString);
      if (originInputRef.current) {
        originInputRef.current.value = originString;
      }

      // Center map on the current location
      mapRef.current.setView([coords.lat, coords.lng], 15);

      // Ensure click count is updated correctly if this is the first point
       if (clickCount === 0 && !destination) {
            setClickCount(1);
        }

      toast({
        title: 'Position Actuelle Définie',
        description: 'Votre position actuelle a été définie comme point de départ.',
      });

    } catch (error: any) {
      console.error('Error accessing GPS location:', error);
       setHasGpsPermission(false); // Set to false on error
       setCurrentLocation(null);
      let description = 'Une erreur s’est produite lors de la récupération de votre position.';
       if (error.code === error.PERMISSION_DENIED) {
           description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur.';
           // Optionally, trigger the dialog again or guide the user
           // setIsGpsDialogOpen(true); // Or provide other instructions
       } else if (error.code === error.POSITION_UNAVAILABLE) {
           description = 'Votre position actuelle n’est pas disponible.';
       } else if (error.code === error.TIMEOUT) {
           description = 'La demande de géolocalisation a expiré.';
       }
       toast({
           variant: 'destructive',
           title: 'Erreur GPS',
           description: description,
       });
    }
  };



  const calculateRoute = async () => {
    if (!LRef.current || !mapRef.current) return;
    const L = LRef.current;

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

       if (originCoords.length !== 2 || destinationCoords.length !== 2 || originCoords.some(isNaN) || destinationCoords.some(isNaN)) {
            toast({
                variant: 'destructive',
                title: 'Coordonnées Invalides',
                description: 'Veuillez entrer des coordonnées valides (latitude, longitude).',
            });
            return;
        }


      // Use OSRM routing service
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destinationCoords[1]},${destinationCoords[0]}?geometries=geojson`
      );

      if (!response.ok) {
        throw new Error(`OSRM error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geoJson = route.geometry;
        const distanceKm = (route.distance / 1000).toFixed(2); // Distance in km

        if (routeLine) {
          mapRef.current.removeLayer(routeLine);
        }

        const newRouteLine = L.geoJSON(geoJson, {
          style: {color: 'blue', weight: 5}, // Make line thicker
        }).addTo(mapRef.current);

        // Add distance popup to the route line
         newRouteLine.bindPopup(`Distance: ${distanceKm} km`).openPopup();


        setRouteLine(newRouteLine);

         // Fit map bounds to the route
         mapRef.current.fitBounds(newRouteLine.getBounds());

      } else {
        toast({
          variant: 'destructive',
          title: 'Aucun itinéraire trouvé',
          description: 'Impossible de calculer un itinéraire entre ces points.',
        });
      }
    } catch (error: any) {
      console.error('Error calculating route:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de calcul d’itinéraire',
        description: `Une erreur s’est produite lors du calcul de l’itinéraire: ${error.message}`,
      });
    }
  };

  // Scroll to the input field when map icon is clicked
   const handleScrollToInput = (ref: React.RefObject<HTMLInputElement>) => {
     if (ref.current) {
       ref.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center', // Scrolls the element to the center of the view
       });
       ref.current.focus(); // Focus the input field
     }
   };


  // Handle click on the "Use Current Location" button
  const handleUseCurrentLocation = async () => {
     if (!mapLoaded || !LRef.current || !mapRef.current) {
      toast({
        variant: 'destructive',
        title: 'Carte non prête',
        description: 'Veuillez attendre que la carte soit complètement chargée et initialisée.',
      });
      return;
    }

    if (hasGpsPermission === false) {
      // If permission is known to be denied or not determined, show dialog
      setIsGpsDialogOpen(true);
    } else if (hasGpsPermission === true) {
      // If permission is granted, get location
       await getCurrentLocationAndSetOrigin();
    } else {
       // If permission status is unknown (null), try to get it
        checkGpsPermission().then(() => {
            // After checking, decide whether to show dialog or get location
            if (hasGpsPermission === false) {
                setIsGpsDialogOpen(true);
            } else if (hasGpsPermission === true) {
                getCurrentLocationAndSetOrigin();
            }
        });
    }

  };

   // Handle action from the GPS permission dialog
   const handleGpsDialogAction = async (allow: boolean) => {
     setIsGpsDialogOpen(false);
     if (allow) {
       try {
         // Request permission and get location
         await getCurrentLocationAndSetOrigin();
       } catch (error) {
         // Error handled within getCurrentLocationAndSetOrigin
       }
     } else {
       toast({
         title: 'GPS Non Activé',
         description: 'Vous pouvez spécifier votre position manuellement sur la carte.',
       });
     }
   };

  // Handle clicks on the map to set origin and destination markers
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
     if (!mapLoaded || !LRef.current || !mapRef.current) {
       toast({
         variant: 'destructive',
         title: 'Carte non prête',
         description: 'Veuillez attendre que la carte soit complètement chargée.',
       });
       return;
     }

     const L = LRef.current;
     const latLng = e.latlng;
     const locationString = `${latLng.lat}, ${latLng.lng}`;

     if (clickCount === 0) {
       // Set Origin
       setOrigin(locationString);
       if (originInputRef.current) {
         originInputRef.current.value = locationString;
       }

       // Remove previous origin marker if exists
       if (originMarker) {
         mapRef.current.removeLayer(originMarker);
       }
        // Add new origin marker (default icon)
       const newOriginMarker = L.marker([latLng.lat, latLng.lng]).addTo(mapRef.current).bindPopup("Départ").openPopup();
       setOriginMarker(newOriginMarker);

       // Clear destination if origin is reset
       setDestination('');
        if (destinationInputRef.current) destinationInputRef.current.value = '';
       if (destinationMarker) {
         mapRef.current.removeLayer(destinationMarker);
         setDestinationMarker(null);
       }
        if (routeLine) {
            mapRef.current.removeLayer(routeLine);
            setRouteLine(null);
        }


       setClickCount(1); // Move to setting destination
     } else if (clickCount === 1) {
       // Set Destination
       setDestination(locationString);
       if (destinationInputRef.current) {
         destinationInputRef.current.value = locationString;
       }

        // Remove previous destination marker if exists
       if (destinationMarker) {
         mapRef.current.removeLayer(destinationMarker);
       }
        // Add new destination marker (default icon)
       const newDestinationMarker = L.marker([latLng.lat, latLng.lng]).addTo(mapRef.current).bindPopup("Destination").openPopup();
       setDestinationMarker(newDestinationMarker);

       setClickCount(2); // Both points set, ready to calculate route
     } else {
        // Allow resetting by clicking again if route is already shown
       if (routeLine) {
            resetMap();
             handleMapClick(e); // Re-trigger click to set the first point again
       } else {
            toast({
                title: 'Points Déjà Sélectionnés',
                description: 'Cliquez sur "Calculer la Route" ou "Réinitialiser".',
             });
        }
     }
   };


  // Reset the map state
  const resetMap = () => {
    if (mapRef.current && LRef.current) {
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
      setCurrentLocation(null); // Reset current location as well if needed

      mapRef.current.setView([defaultLocation.lat, defaultLocation.lng], 10); // Reset map view
      toast({ title: 'Carte Réinitialisée' });
    }
  };


  return (
    <TooltipProvider delayDuration={0}>
      <div>
        {/* The map container */}
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4" />

        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-semibold mb-4 text-center md:text-left">Snack et Restauration</h1>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Left side: Input fields */}
            <div className="w-full md:w-1/2 space-y-4">
              {/* Origin Input */}
              <div className="mb-4">
                <label htmlFor="origin" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de ramassage
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="origin"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-20" // Increased padding-right
                    placeholder="Cliquer sur la carte ou utiliser GPS"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    ref={originInputRef}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1"> {/* Added space-x-1 */}
                    {/* Map Pin Icon */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                           onClick={() => handleScrollToInput(originInputRef)}
                          aria-label="Choisir l'adresse de ramassage sur la carte"
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Choisir l’adresse de ramassage sur la carte (1er clic)
                      </TooltipContent>
                    </Tooltip>
                    {/* GPS Locate Icon */}
                    <Tooltip>
                       <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleUseCurrentLocation}
                          aria-label={hasGpsPermission ? "Utiliser ma position actuelle" : "Activer et utiliser le GPS"}
                        >
                          <Locate className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasGpsPermission ? "Utiliser ma position actuelle" : "Activer et utiliser le GPS"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Destination Input */}
              <div className="mb-4">
                <label htmlFor="destination" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de destination
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="destination"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-10" // Standard padding-right
                    placeholder="Cliquer sur la carte"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    ref={destinationInputRef}
                  />
                   <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleScrollToInput(destinationInputRef)}
                           aria-label="Choisir l'adresse de destination sur la carte"
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                         Choisir l’adresse de destination sur la carte (2ème clic)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

               {/* Action Buttons */}
               <div className="flex gap-2 flex-wrap">
                <Button onClick={calculateRoute} disabled={clickCount !== 2 || !origin || !destination}>Calculer la Route</Button>
                <Button onClick={resetMap} variant="secondary">Réinitialiser</Button>
              </div>
            </div>

            {/* Right side: GPS Alert */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
              {hasGpsPermission === false && !currentLocation && ( // Show only if permission denied and no location yet
                <Alert variant="destructive">
                  <AlertTitle>Accès GPS Refusé</AlertTitle>
                  <AlertDescription>
                     L'accès GPS est nécessaire pour utiliser votre position actuelle. Vous pouvez l'activer dans les paramètres de votre navigateur ou
                     <Button variant="link" className="p-0 h-auto ml-1" onClick={() => setIsGpsDialogOpen(true)}>
                        réessayer
                    </Button>
                    . Vous pouvez aussi définir le point de départ manuellement sur la carte.
                  </AlertDescription>
                </Alert>
              )}
               {hasGpsPermission === null && ( // Show loading/prompt state
                 <Alert>
                     <AlertTitle>Vérification GPS</AlertTitle>
                     <AlertDescription>
                         Vérification de l'autorisation GPS...
                         <Button variant="link" className="p-0 h-auto ml-1" onClick={handleUseCurrentLocation}>
                            Utiliser ma position
                         </Button>
                     </AlertDescription>
                 </Alert>
                )}
            </div>
          </div>

          {/* Delivery Options - Show only after route is calculated */}
          {routeLine && (
            <div className="mt-8 pt-4 border-t">
              <h2 className="text-xl font-semibold mb-4 text-center md:text-left">Options de Livraison</h2>
              <div className="flex flex-col sm:flex-row justify-center sm:justify-start space-y-2 sm:space-y-0 sm:space-x-4">
                <Button variant="outline">Ouvrir une Enchère</Button>
                <Button variant="outline">Trouver un Livreur</Button>
                <Button>MapYOO Service</Button>
              </div>
            </div>
          )}

          {/* GPS Permission Dialog */}
          <AlertDialog open={isGpsDialogOpen} onOpenChange={setIsGpsDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Activer le GPS ?</AlertDialogTitle>
                <AlertDialogDescription>
                  MapYOO souhaite accéder à votre position actuelle pour définir automatiquement le point de départ. Voulez-vous autoriser l'accès GPS ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => handleGpsDialogAction(false)}>
                  Non, spécifier manuellement
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => handleGpsDialogAction(true)}>
                  Oui, Activer GPS
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

    