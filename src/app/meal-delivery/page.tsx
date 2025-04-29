
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
} from '@/components/ui/alert-dialog';
import {Locate, MapPin} from 'lucide-react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import type L from 'leaflet'; // Import Leaflet type

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  cursor: 'crosshair' // Change cursor to crosshair for map clicks
};

const defaultLocation = {
  lat: 34.052235,
  lng: -118.243683,
};

// Define a custom red marker icon (remains unchanged)
let redIcon: L.Icon | undefined;
if (typeof window !== 'undefined') {
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

// Reverse Geocoding function using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`; // Added language preference
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.display_name) {
      // Return address and coordinates
      return `${data.display_name} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    } else {
      // Fallback to coordinates if address not found
       return `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    // Fallback to coordinates on error
    return `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}


const MealDeliveryPage = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null);
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
  const LRef = useRef<typeof L | null>(null);


  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || LRef.current) return;

      try {
        const L = (await import('leaflet')).default;
        LRef.current = L;

        const mapElement = document.getElementById('map');
        if (!mapElement || mapRef.current) return;

        // Ensure the red icon is loaded before creating the map or markers that might use it
        if (!redIcon) {
          redIcon = new L.Icon({ /* ... icon options ... */ });
        }


        const map = L.map(mapElement, {
          center: [defaultLocation.lat, defaultLocation.lng],
          zoom: 10,
          doubleClickZoom: false,
          closePopupOnClick: false, // Keep popups open on map click
          crs: L.CRS.EPSG3857, // Standard web mapping projection
          attributionControl: false, // Hide default attribution
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Add attribution control separately if needed
        L.control.attribution({ position: 'bottomright', prefix: '' }).addTo(map);

        mapRef.current = map;
        setMapLoaded(true);

        // Set map cursor style
        (map.getContainer()).style.cursor = 'crosshair';


        map.on('click', handleMapClick); // Use named function

        // Check initial GPS permission status silently, don't automatically get location
        checkGpsPermission(false); // Pass false to not get location initially


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

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Removed handleMapClick from dependencies to avoid re-renders


  const checkGpsPermission = async (getLocationOnGrant = false) => { // Added parameter
      if (!navigator.geolocation) {
          setHasGpsPermission(false);
          return;
      }
       try {
           const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
           setHasGpsPermission(permissionStatus.state === 'granted');
           // Only get location if permission granted AND requested
           if (permissionStatus.state === 'granted' && getLocationOnGrant) {
                await getCurrentLocationAndSetOrigin();
           }
           permissionStatus.onchange = () => {
               const granted = permissionStatus.state === 'granted';
               setHasGpsPermission(granted);
                if (granted && getLocationOnGrant) { // Check flag again
                    getCurrentLocationAndSetOrigin();
                } else if (!granted) {
                    setCurrentLocation(null);
                }
           };
       } catch (error) {
           console.error("Error checking GPS permission:", error);
           setHasGpsPermission(false);
       }
   };

  const getCurrentLocationAndSetOrigin = async () => {
    if (!LRef.current || !mapRef.current) return;
    const L = LRef.current;

    // Reset click count if GPS is used for origin
    resetMapStateForNewOrigin(); // Clear existing markers/route

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
      setHasGpsPermission(true);

      // Add new red marker for current location
      const newMarker = L.marker([coords.lat, coords.lng], { icon: redIcon }).addTo(mapRef.current).bindPopup("Votre Position Actuelle").openPopup();
      setOriginMarker(newMarker);

      // Get address from coordinates and update state/input
      const address = await reverseGeocode(coords.lat, coords.lng);
      setOrigin(address);
      if (originInputRef.current) {
        originInputRef.current.value = address;
      }

      mapRef.current.setView([coords.lat, coords.lng], 15);
      setClickCount(1); // Set click count to 1, indicating origin is set

      toast({
        title: 'Position Actuelle Définie',
        description: 'Votre position actuelle a été définie comme point de départ.',
      });

    } catch (error: any) {
      console.error('Error accessing GPS location:', error);
       setHasGpsPermission(false);
       setCurrentLocation(null);
      let description = 'Une erreur s’est produite lors de la récupération de votre position.';
       if (error.code === error.PERMISSION_DENIED) {
           description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur.';
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
    if (!LRef.current || !mapRef.current || !originMarker || !destinationMarker) {
       toast({
        variant: 'destructive',
        title: 'Information Manquante',
        description: 'Veuillez définir un point de départ et de destination sur la carte.',
      });
      return;
    }
    const L = LRef.current;

    const originCoords = originMarker.getLatLng();
    const destinationCoords = destinationMarker.getLatLng();


    try {
      // Use OSRM routing service
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destinationCoords.lng},${destinationCoords.lat}?geometries=geojson&overview=full`
      );

      if (!response.ok) {
        throw new Error(`OSRM error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geoJson = route.geometry;
        const distanceKm = (route.distance / 1000).toFixed(2);

        if (routeLine) {
          mapRef.current.removeLayer(routeLine);
        }

        const newRouteLine = L.geoJSON(geoJson, {
          style: {color: 'hsl(var(--primary))', weight: 5}, // Use primary color from theme
        }).addTo(mapRef.current);

        newRouteLine.bindPopup(`Distance: ${distanceKm} km`).openPopup();
        setRouteLine(newRouteLine);

        mapRef.current.fitBounds(newRouteLine.getBounds());

        // Close individual marker popups when route is shown
        originMarker.closePopup();
        destinationMarker.closePopup();

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
        description: `Une erreur s’est produite lors du calcul de l’itinéraire.`,
      });
    }
  };

  const handleScrollToInput = (ref: React.RefObject<HTMLInputElement>) => {
     if (ref.current) {
       ref.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
       ref.current.focus();
     }
   };

  const handleUseCurrentLocation = async () => {
     if (!mapLoaded || !LRef.current || !mapRef.current) {
      toast({ variant: 'destructive', title: 'Carte non prête' });
      return;
    }

    if (hasGpsPermission === false) {
      setIsGpsDialogOpen(true);
    } else if (hasGpsPermission === true) {
       await getCurrentLocationAndSetOrigin(); // Directly get location if permission granted
    } else {
       // Check permission and then decide
       await checkGpsPermission(true); // Pass true to get location if granted
       // If permission becomes false after check, the dialog will be handled by checkGpsPermission's logic or subsequent clicks
        if (navigator.permissions) {
             const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
             if (permissionStatus.state !== 'granted') {
                 setIsGpsDialogOpen(true); // Show dialog if still not granted
             }
         } else {
             // Fallback if permissions API not supported (less likely)
             setIsGpsDialogOpen(true);
         }
    }
  };

   const handleGpsDialogAction = async (allow: boolean) => {
     setIsGpsDialogOpen(false);
     if (allow) {
       await getCurrentLocationAndSetOrigin();
     } else {
       toast({
         title: 'GPS Non Activé',
         description: 'Vous pouvez spécifier votre position manuellement sur la carte.',
       });
     }
   };

  // Clears markers and route, preparing for new origin selection
   const resetMapStateForNewOrigin = () => {
        if (!mapRef.current) return;
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
        // Don't reset currentLocation or hasGpsPermission here
        setClickCount(0); // Reset click count
    };

   const handleMapClick = async (e: L.LeafletMouseEvent) => {
     if (!mapLoaded || !LRef.current || !mapRef.current) {
       toast({ variant: 'destructive', title: 'Carte non prête' });
       return;
     }

     const L = LRef.current;
     const latLng = e.latlng;
     const address = await reverseGeocode(latLng.lat, latLng.lng); // Get address

     if (clickCount === 0) {
       // Set Origin
       resetMapStateForNewOrigin(); // Clear previous state before setting new origin

       setOrigin(address);
       if (originInputRef.current) originInputRef.current.value = address;

       const newOriginMarker = L.marker([latLng.lat, latLng.lng])
         .addTo(mapRef.current)
         .bindPopup(`Départ: ${address.split('(')[0]}`) // Show only address part in popup initially
         .openPopup();
       setOriginMarker(newOriginMarker);

       setClickCount(1);
     } else if (clickCount === 1) {
       // Set Destination
       setDestination(address);
       if (destinationInputRef.current) destinationInputRef.current.value = address;

       if (destinationMarker) {
         mapRef.current.removeLayer(destinationMarker);
       }
       const newDestinationMarker = L.marker([latLng.lat, latLng.lng])
         .addTo(mapRef.current)
         .bindPopup(`Destination: ${address.split('(')[0]}`) // Show only address part in popup initially
         .openPopup();
       setDestinationMarker(newDestinationMarker);

        if (routeLine) { // Remove old route if destination is changed
            mapRef.current.removeLayer(routeLine);
            setRouteLine(null);
        }


       setClickCount(2);
     } else {
       // Reset if clicked again after destination is set
        resetMap();
        // Need to re-trigger the first click after reset
        const firstClickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: e.originalEvent.clientX, // Pass necessary event properties
            clientY: e.originalEvent.clientY,
            // Add other properties if needed by Leaflet or your logic
        });
        // Find the map container and dispatch the event.
        // Note: This might not work perfectly depending on Leaflet's internal handling.
        // A more robust way might be to directly call the logic for the first click.
        // For simplicity, let's call handleMapClick directly after reset:
         await handleMapClick(e); // Simulate the first click again


     }
   };


  const resetMap = () => {
    if (mapRef.current && LRef.current) {
       resetMapStateForNewOrigin(); // Use the clearing function
       // Optionally reset GPS state if desired
       // setCurrentLocation(null);
       // setHasGpsPermission(null); // Or false depending on desired behavior
       mapRef.current.setView([defaultLocation.lat, defaultLocation.lng], 10);
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
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-20"
                    placeholder="Cliquer sur la carte ou utiliser GPS"
                    value={origin} // Controlled component
                    onChange={(e) => setOrigin(e.target.value)} // Allow manual input if needed
                    ref={originInputRef}
                    readOnly // Make read-only if address comes only from map/GPS
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
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
                        {hasGpsPermission ? "Utiliser ma position actuelle (GPS)" : "Activer et utiliser le GPS"}
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
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-10"
                    placeholder="Cliquer sur la carte"
                    value={destination} // Controlled component
                    onChange={(e) => setDestination(e.target.value)} // Allow manual input if needed
                    ref={destinationInputRef}
                    readOnly // Make read-only if address comes only from map
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
                 {/* Enable Calculate Route only when both markers are set */}
                <Button onClick={calculateRoute} disabled={!originMarker || !destinationMarker || !!routeLine}>
                  Calculer la Route
                </Button>
                <Button onClick={resetMap} variant="secondary">Réinitialiser</Button>
              </div>
            </div>

            {/* Right side: GPS Alert */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
              {hasGpsPermission === false && ( // Show only if permission explicitly denied or unavailable
                <Alert variant="destructive">
                  <AlertTitle>Accès GPS Refusé/Indisponible</AlertTitle>
                  <AlertDescription>
                     L'accès GPS est nécessaire pour utiliser votre position actuelle. Vous pouvez essayer de l'activer dans les paramètres de votre navigateur ou
                     <Button variant="link" className="p-0 h-auto ml-1" onClick={() => setIsGpsDialogOpen(true)}>
                        réessayer
                    </Button>
                    . Vous pouvez aussi définir le point de départ manuellement sur la carte.
                  </AlertDescription>
                </Alert>
              )}
               {hasGpsPermission === null && ( // Show initial checking state
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
                {/* You might want an alert for when permission is granted but location is being fetched */}
                {/* {hasGpsPermission === true && currentLocation === null && <Alert>...</Alert>} */}
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
