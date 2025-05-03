
'use client';

import React, {useState, useRef, useEffect} from 'react';
import 'leaflet/dist/leaflet.css';
import ReactDOMServer from 'react-dom/server';
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
import {Locate, MapPin, MapPinCheck, Search} from 'lucide-react'; // Use Locate for GPS, MapPin for Origin/Dest Click, MapPinCheck for confirmed Destination
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

// Keep L reference accessible outside component scope for helper function
let LRef: React.MutableRefObject<typeof L | null> = { current: null };

// Function to create Leaflet DivIcon from Lucide React component
const createLucideIcon = (IconComponent: React.ElementType, colorClass = 'text-primary'): L.DivIcon | undefined => {
  if (!LRef.current) return undefined; // Leaflet not loaded yet
  const L = LRef.current;
  const iconHtml = ReactDOMServer.renderToStaticMarkup(
    // Add a wrapper div to ensure proper styling and centering if needed
    React.createElement('div', { style: { display: 'inline-block', position: 'relative', bottom: '-5px' /* Adjust vertical alignment */ } },
      React.createElement(IconComponent, { className: `h-6 w-6 ${colorClass}` })
    )
  );
  return L.divIcon({
    html: iconHtml,
    className: 'leaflet-lucide-icon', // Custom class to remove default styles
    iconSize: [24, 24], // Match h-6 w-6
    iconAnchor: [12, 24], // Anchor point (bottom center)
    popupAnchor: [0, -24] // Popup position relative to anchor
  });
};

// Define custom icons (will be initialized after Leaflet loads)
let originIcon: L.DivIcon | undefined;
let destinationIcon: L.DivIcon | undefined;
let currentPositionIcon: L.DivIcon | undefined; // Specific icon for GPS location

// Reverse Geocoding function using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.display_name) {
      return {
        lat: lat,
        lng: lng,
        displayName: data.display_name,
      };
    } else {
       // Fallback if address not found
       const coordsStr = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
       return { lat: lat, lng: lng, displayName: coordsStr };
    }
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    // Fallback on error
    const coordsStr = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { lat: lat, lng: lng, displayName: coordsStr };
  }
}

// Geocoding function using Nominatim search
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=fr&countrycodes=ma`; // Limit search, prioritize FR/MA
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
      };
    } else {
      return null; // Address not found
    }
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
}


const MealDeliveryPage = () => {
  const { toast } = useToast(); // Moved inside the component
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null);
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [routeLine, setRouteLine] = useState<L.GeoJSON | null>(null);
  const [clickMode, setClickMode] = useState<'origin' | 'destination' | 'none'>('origin'); // Track next map click target


   // Define handleMapClick within the component scope
   const handleMapClick = async (e: L.LeafletMouseEvent) => {
     if (!mapLoaded || !LRef.current || !mapRef.current || clickMode === 'none') {
       if (clickMode === 'none') {
            toast({ variant: 'default', title: 'Mode Sélection Inactif', description: "Cliquez sur l'icône 'Choisir sur la carte' (📍) près d'un champ d'adresse pour activer la sélection." });
       } else {
            toast({ variant: 'destructive', title: 'Carte non prête' });
       }
       return;
     }

     const L = LRef.current;
     const latLng = e.latlng;
     const geocodeResult = await reverseGeocode(latLng.lat, latLng.lng);
     const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`;

     if (clickMode === 'origin' && originIcon) {
        if (originMarker) mapRef.current.removeLayer(originMarker); // Remove previous origin marker
        if (routeLine) { // Remove route if origin changes
            mapRef.current.removeLayer(routeLine);
            setRouteLine(null);
        }

        setOrigin(address); // Update state
        if (originInputRef.current) originInputRef.current.value = address; // Update input field directly

        const newOriginMarker = L.marker([latLng.lat, latLng.lng], { icon: originIcon })
         .addTo(mapRef.current)
         .bindPopup(`Départ: ${address.split(',')[0]}`) // Show only first part of address
         .openPopup();
       setOriginMarker(newOriginMarker);

       setClickMode('destination'); // Next click should set destination
       toast({ title: "Point de Départ Défini", description: "Cliquez maintenant sur la carte pour définir la destination, ou utilisez la recherche." });
     } else if (clickMode === 'destination' && destinationIcon) {
        if (destinationMarker) mapRef.current.removeLayer(destinationMarker); // Remove previous destination marker
         if (routeLine) { // Remove route if destination changes
            mapRef.current.removeLayer(routeLine);
            setRouteLine(null);
        }

       setDestination(address); // Update state
       if (destinationInputRef.current) destinationInputRef.current.value = address; // Update input field directly

       const newDestinationMarker = L.marker([latLng.lat, latLng.lng], { icon: destinationIcon })
         .addTo(mapRef.current)
         .bindPopup(`Destination: ${address.split(',')[0]}`) // Show only first part of address
         .openPopup();
       setDestinationMarker(newDestinationMarker);

       setClickMode('none'); // Deactivate map clicking after destination is set
       toast({ title: "Destination Définie", description: "Vous pouvez maintenant calculer l'itinéraire ou ajuster les points." });

        // Automatically calculate route if origin also exists
        if (originMarker) {
            await calculateRoute();
        }

     }
   };


  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || LRef.current) return;

      try {
        const L = (await import('leaflet')).default;
        LRef.current = L; // Store L reference

        // Initialize icons *after* L is loaded
        originIcon = createLucideIcon(MapPin, 'text-blue-600'); // Blue for origin
        destinationIcon = createLucideIcon(MapPinCheck, 'text-green-600'); // Green for destination
        currentPositionIcon = createLucideIcon(Locate, 'text-red-600'); // Red for GPS

        const mapElement = document.getElementById('map');
        if (!mapElement || mapRef.current) return;


        const map = L.map(mapElement, {
          center: [defaultLocation.lat, defaultLocation.lng],
          zoom: 10,
          doubleClickZoom: false,
          closePopupOnClick: true, // Allow popups to close normally
          //crs: L.CRS.EPSG3857, // default, not needed
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { // Use https and standard subdomains
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        L.control.attribution({ position: 'bottomright', prefix: '' }).addTo(map);

        mapRef.current = map;
        setMapLoaded(true);

        (map.getContainer()).style.cursor = 'crosshair';

        // Attach the click listener here
        map.on('click', handleMapClick);

        checkGpsPermission(false); // Don't get location on initial load

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

    // Cleanup function
    const cleanup = () => {
      if (mapRef.current) {
         // Clean up map event listener
         mapRef.current.off('click', handleMapClick);
         // Check if the map container still exists before removing
         if (mapRef.current.getContainer()) {
            try {
              mapRef.current.remove();
            } catch (e) {
              console.warn("Error removing map:", e)
            }
         }
         mapRef.current = null;
      }
      LRef.current = null; // Clean up L reference
    };

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Removed handleMapClick from dependencies as it's defined above now


  const checkGpsPermission = async (getLocationOnGrant = false) => {
      if (!navigator.geolocation) {
          setHasGpsPermission(false);
          return;
      }
       try {
           const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
           setHasGpsPermission(permissionStatus.state === 'granted');
           if (permissionStatus.state === 'granted' && getLocationOnGrant) {
                await getCurrentLocationAndSetOrigin();
           }
           // Use a variable for the listener function to remove it later if needed
           const permissionChangeListener = () => {
               const granted = permissionStatus.state === 'granted';
               setHasGpsPermission(granted);
                if (granted && getLocationOnGrant) {
                    getCurrentLocationAndSetOrigin();
                } else if (!granted) {
                    setCurrentLocation(null);
                    // Maybe remove the current location marker if it exists
                }
           };
           // Use try-catch for adding event listener
           try {
                permissionStatus.addEventListener('change', permissionChangeListener);
           } catch (e) {
                // Fallback for older browsers
                permissionStatus.onchange = permissionChangeListener;
           }

           // Return a cleanup function for the permission listener
           return () => {
                try {
                    permissionStatus.removeEventListener('change', permissionChangeListener);
                } catch (e) {
                    permissionStatus.onchange = null;
                }
           };

       } catch (error) {
           console.error("Error checking GPS permission:", error);
           setHasGpsPermission(false);
           return () => {}; // Return empty cleanup on error
       }
   };

  const getCurrentLocationAndSetOrigin = async () => {
    if (!LRef.current || !mapRef.current || !currentPositionIcon) {
       toast({ variant: 'destructive', title: 'Erreur Carte/Icone', description: 'La carte ou l\'icône GPS n\'a pas pu être chargée.' });
       return;
    }
    const L = LRef.current;

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

      // Add new marker for current location using the specific icon (red Locate icon)
      const newMarker = L.marker([coords.lat, coords.lng], { icon: currentPositionIcon }).addTo(mapRef.current);
      setOriginMarker(newMarker); // Still consider it the origin

      const geocodeResult = await reverseGeocode(coords.lat, coords.lng);
      const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      newMarker.bindPopup(`Départ (Actuel): ${address.split(',')[0]}`).openPopup(); // Use simple popup

      setOrigin(address);
      if (originInputRef.current) {
        originInputRef.current.value = address; // Update input field directly
      }

      mapRef.current.setView([coords.lat, coords.lng], 15);
      setClickMode('destination'); // Next click sets destination

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
        variant: 'default', // Changed to default as it's informational
        title: 'Information Manquante',
        description: 'Veuillez définir un point de départ ET de destination sur la carte ou via la recherche pour calculer l\'itinéraire.',
      });
      return;
    }
    const L = LRef.current;

    const originCoords = originMarker.getLatLng();
    const destinationCoords = destinationMarker.getLatLng();


    try {
      // Using OSRM demo server - replace with your own instance for production
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
        const distanceKm = (route.distance / 1000).toFixed(2); // Distance in km
        const durationMinutes = Math.round(route.duration / 60); // Duration in minutes

        if (routeLine) {
          mapRef.current.removeLayer(routeLine);
        }

        const newRouteLine = L.geoJSON(geoJson, {
          style: {color: 'hsl(var(--primary))', weight: 5}, // Use primary color from theme
        }).addTo(mapRef.current);

        newRouteLine.bindPopup(`Distance: ${distanceKm} km<br>Durée: ~${durationMinutes} min`).openPopup();
        setRouteLine(newRouteLine);

        mapRef.current.fitBounds(newRouteLine.getBounds());

        // Optionally close the origin/destination popups once route is shown
        originMarker.closePopup();
        destinationMarker.closePopup();

         toast({
          title: 'Itinéraire Calculé',
          description: `Distance: ${distanceKm} km, Durée: ~${durationMinutes} min. Options de livraison disponibles ci-dessous.`,
        });

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
        description: `Une erreur s’est produite lors du calcul de l’itinéraire. ${error.message || ''}`,
      });
    }
  };

   // Function to focus input and set click mode
   const handleFocusInputAndSetMode = (ref: React.RefObject<HTMLInputElement>, mode: 'origin' | 'destination') => {
     if (ref.current) {
       ref.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
       ref.current.focus();
       setClickMode(mode);
       toast({
           title: "Mode Sélection Activé",
           description: `Cliquez sur la carte pour définir ${mode === 'origin' ? 'le point de départ' : 'la destination'}.`,
       });
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
       await getCurrentLocationAndSetOrigin();
    } else {
       // If permission state is unknown, try to get it, possibly prompting the user
       let cleanupPermissionListener: (() => void) | undefined;
       cleanupPermissionListener = await checkGpsPermission(true); // Attempt to get location after check
        if (navigator.permissions) {
             // Re-check permission status after attempting to get it
             const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
             if (permissionStatus.state !== 'granted') {
                 setIsGpsDialogOpen(true); // Show dialog if still not granted after check
             }
         } else {
             // Fallback if permissions API not supported, assume need to ask via dialog
             setIsGpsDialogOpen(true);
         }
         // Clean up the listener if it was created
        if (cleanupPermissionListener) {
            cleanupPermissionListener();
        }
    }
  };

   const handleGpsDialogAction = async (allow: boolean) => {
     setIsGpsDialogOpen(false);
     if (allow) {
       // The browser permission prompt will be triggered by getCurrentPosition
       await getCurrentLocationAndSetOrigin();
     } else {
       toast({
         title: 'GPS Non Activé',
         description: 'Vous pouvez spécifier votre position manuellement sur la carte.',
       });
     }
   };

   // Resets markers and route, keeps input values
   const resetMapStateForNewOrigin = () => {
        if (!mapRef.current) return;
        if (originMarker) mapRef.current.removeLayer(originMarker);
        if (destinationMarker) mapRef.current.removeLayer(destinationMarker);
        if (routeLine) mapRef.current.removeLayer(routeLine);

        setOriginMarker(null);
        setDestinationMarker(null);
        setRouteLine(null);
        setClickMode('origin'); // Default back to setting origin
    };

    // Resets everything: markers, route, input values, map view
    const resetFullMap = () => {
        if (mapRef.current && LRef.current) {
           resetMapStateForNewOrigin(); // Clear markers and route
           setOrigin('');
           setDestination('');
           if (originInputRef.current) originInputRef.current.value = '';
           if (destinationInputRef.current) destinationInputRef.current.value = '';
           // Optionally reset GPS state if needed
           // setCurrentLocation(null);
           // setHasGpsPermission(null);
           mapRef.current.setView([defaultLocation.lat, defaultLocation.lng], 10);
           setClickMode('origin'); // Reset click mode to origin
           toast({ title: 'Carte Réinitialisée', description: 'Sélectionnez un nouveau point de départ.' });
        }
      };




   // Handle address search from input fields
   const handleAddressSearch = async (type: 'origin' | 'destination') => {
      if (!mapRef.current || !LRef.current) return;
      const L = LRef.current;
      const address = type === 'origin' ? origin : destination;

      if (!address || address.trim().length < 3) { // Basic validation
          toast({ variant: 'destructive', title: 'Recherche invalide', description: 'Veuillez entrer une adresse plus complète.' });
          return;
      }

      const result = await geocodeAddress(address);

      if (result) {
          const { lat, lng, displayName } = result;
          // Use blue MapPin for origin search result, green MapPinCheck for destination
          const icon = type === 'origin' ? originIcon : destinationIcon;
          let markerRef = type === 'origin' ? originMarker : destinationMarker;
          const setMarker = type === 'origin' ? setOriginMarker : setDestinationMarker;
          const setAddressState = type === 'origin' ? setOrigin : setDestination;
          const inputRef = type === 'origin' ? originInputRef : destinationInputRef;

          if (!icon) {
             toast({ variant: 'destructive', title: 'Erreur Icone', description: "L'icône de la carte n'a pas pu être chargée." });
             return;
          }

          // Remove existing marker of the same type
          if (markerRef) {
              mapRef.current.removeLayer(markerRef);
          }
           // Remove route line if address changes via search
           if (routeLine) {
              mapRef.current.removeLayer(routeLine);
              setRouteLine(null);
          }

          // Add new marker
          const newMarker = L.marker([lat, lng], { icon: icon })
              .addTo(mapRef.current)
              .bindPopup(`${type === 'origin' ? 'Départ' : 'Destination'}: ${displayName.split(',')[0]}`)
              .openPopup();

          setMarker(newMarker);
          setAddressState(displayName); // Update state with full address from search
          if (inputRef.current) {
              inputRef.current.value = displayName; // Update input field directly
          }

          mapRef.current.setView([lat, lng], 15); // Center map on the result

          // Set click mode based on what was just set
          if (type === 'origin' && !destinationMarker) {
              setClickMode('destination'); // If destination not set, next click sets destination
              toast({ title: 'Point de Départ Trouvé', description: 'Sélectionnez maintenant la destination sur la carte ou via la recherche.'});
          } else if (type === 'destination' && !originMarker) {
              setClickMode('origin'); // If origin not set, next click sets origin
               toast({ title: 'Destination Trouvée', description: 'Sélectionnez maintenant le point de départ sur la carte ou via la recherche.'});
          }
           else {
              setClickMode('none'); // Otherwise, deactivate clicking if both are set or search initiated it
               toast({ title: 'Adresse Trouvée', description: displayName });
          }


           // Automatically calculate route if both markers now exist
           const currentOrigin = type === 'origin' ? newMarker : originMarker;
           const currentDestination = type === 'destination' ? newMarker : destinationMarker;
            if (currentOrigin && currentDestination) {
                await calculateRoute();
            }

      } else {
          toast({ variant: 'destructive', title: 'Adresse Non Trouvée', description: 'Impossible de localiser cette adresse. Essayez différemment ou cliquez sur la carte.' });
      }
   };



  return (
    <TooltipProvider delayDuration={100}> {/* Reduced delay */}
      <div>
        {/* The map container */}
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4" />

        {/* Add CSS for leaflet-lucide-icon to prevent default Leaflet icon background/border */}
        <style jsx global>{`
          .leaflet-lucide-icon {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            line-height: 0; /* Prevent extra space */
          }
           /* Target the default marker icon specifically if needed */
           .leaflet-marker-icon.leaflet-div-icon {
             background: none;
             border: none;
             padding: 0;
             margin: 0;
             box-shadow: none;
             width: auto !important; /* Override default width/height if necessary */
             height: auto !important;
           }
           .leaflet-marker-icon .leaflet-lucide-icon div {
              /* Ensure the inner div doesn't cause issues */
              line-height: normal; /* Reset line-height if needed */
           }
        `}</style>

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
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-32" // Increased padding-right for 3 icons
                    placeholder="Entrer l'adresse, utiliser le GPS, ou cliquer sur la carte"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    ref={originInputRef}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('origin')}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('origin')}
                          aria-label="Rechercher l'adresse de ramassage"
                        >
                           <Search className="h-5 w-5 text-gray-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Rechercher l'adresse entrée
                      </TooltipContent>
                    </Tooltip>
                     <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                           onClick={() => handleFocusInputAndSetMode(originInputRef, 'origin')}
                          aria-label="Choisir l'adresse de ramassage sur la carte"
                           className={clickMode === 'origin' ? 'text-primary ring-2 ring-primary rounded-full' : ''} // Indicate active mode with ring and rounded
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Activer la sélection du point de départ sur la carte ({clickMode === 'origin' ? 'Actif' : 'Inactif'})
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                       <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleUseCurrentLocation}
                          aria-label={hasGpsPermission ? "Utiliser ma position actuelle (GPS)" : "Activer et utiliser le GPS"}
                        >
                          <Locate className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasGpsPermission === true ? "Utiliser ma position actuelle (GPS)" : "Activer et utiliser le GPS"}
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
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md pr-20" // Padding for 2 icons
                    placeholder="Entrer l'adresse ou cliquer sur la carte"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    ref={destinationInputRef}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')}
                  />
                   <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('destination')}
                          aria-label="Rechercher l'adresse de destination"
                        >
                           <Search className="h-5 w-5 text-gray-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Rechercher l'adresse entrée
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleFocusInputAndSetMode(destinationInputRef, 'destination')}
                           aria-label="Choisir l'adresse de destination sur la carte"
                           className={clickMode === 'destination' ? 'text-primary ring-2 ring-primary rounded-full' : ''} // Indicate active mode with ring and rounded
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                         Activer la sélection de la destination sur la carte ({clickMode === 'destination' ? 'Actif' : 'Inactif'})
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

               {/* Action Buttons */}
               <div className="flex gap-2 flex-wrap">
                <Button onClick={calculateRoute} disabled={!originMarker || !destinationMarker}>
                  {routeLine ? 'Recalculer la Route' : 'Calculer la Route'}
                </Button>
                <Button onClick={resetFullMap} variant="secondary">Réinitialiser</Button>
              </div>
            </div>

            {/* Right side: GPS Alert */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
              {hasGpsPermission === false && (
                <Alert variant="destructive">
                  <Locate className="h-4 w-4" /> {/* Add icon to alert */}
                  <AlertTitle>Accès GPS Refusé/Indisponible</AlertTitle>
                  <AlertDescription>
                     L'accès GPS est nécessaire pour utiliser votre position actuelle. Vous pouvez essayer de l'activer dans les paramètres de votre navigateur ou
                     <Button variant="link" className="p-0 h-auto ml-1 text-destructive underline" onClick={() => setIsGpsDialogOpen(true)}>
                        réessayer d'activer
                    </Button>
                    . Vous pouvez aussi définir le point de départ manuellement.
                  </AlertDescription>
                </Alert>
              )}
               {hasGpsPermission === null && (
                 <Alert>
                    <Locate className="h-4 w-4" /> {/* Add icon to alert */}
                     <AlertTitle>Vérification GPS</AlertTitle>
                     <AlertDescription>
                         Vérification de l'autorisation GPS...
                         <Button variant="link" className="p-0 h-auto ml-1" onClick={handleUseCurrentLocation}>
                            Utiliser ma position
                         </Button>
                     </AlertDescription>
                 </Alert>
                )}
                {/* Optional: Alert for loading GPS location after permission */}
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

