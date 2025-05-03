'use client';

import React, {useState, useRef, useEffect, useCallback} from 'react'; // Import useCallback
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
import {Locate, MapPin, MapPinCheck, Search, Pin, PinOff} from 'lucide-react'; // Use Locate for GPS, MapPin for Origin/Dest Click, MapPinCheck for confirmed Destination
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
const createLucideIcon = (IconComponent: React.ElementType, colorClass = 'text-primary', size = 6): L.DivIcon | undefined => {
  if (!LRef.current) return undefined; // Leaflet not loaded yet
  const L = LRef.current;
  const iconHtml = ReactDOMServer.renderToStaticMarkup(
    // Add a wrapper div to ensure proper styling and centering if needed
    React.createElement('div', { style: { display: 'inline-block', position: 'relative', bottom: '-5px' /* Adjust vertical alignment */ } },
      React.createElement(IconComponent, { className: `h-${size} w-${size} ${colorClass}` })
    )
  );
  const iconSizeValue = size * 4; // Adjust based on h-6/w-6 -> 24px, needs multiplier
  return L.divIcon({
    html: iconHtml,
    className: 'leaflet-lucide-icon', // Custom class to remove default styles
    iconSize: [iconSizeValue, iconSizeValue], // Match h-X w-X
    iconAnchor: [iconSizeValue / 2, iconSizeValue], // Anchor point (bottom center)
    popupAnchor: [0, -iconSizeValue] // Popup position relative to anchor
  });
};

// Define custom icons (will be initialized after Leaflet loads)
let originIcon: L.DivIcon | undefined;
let destinationIcon: L.DivIcon | undefined;
let currentPositionIcon: L.DivIcon | undefined; // Specific icon for GPS location

// Reverse Geocoding function using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`;
  console.log(`Reverse geocoding for: ${lat}, ${lng}`); // Log coords
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Reverse Geocode Raw Result:", data); // Log the full raw result
    if (data && data.display_name) {
        // Construct a more detailed address if possible
        const addressParts = [];
        if (data.address) {
             if (data.address.road) addressParts.push(data.address.road);
            if (data.address.house_number) addressParts.push(data.address.house_number);
            // Prefer more specific city/town/village if available
            if (data.address.city) addressParts.push(data.address.city);
            else if (data.address.town) addressParts.push(data.address.town);
            else if (data.address.village) addressParts.push(data.address.village);
            else if (data.address.suburb) addressParts.push(data.address.suburb); // Add suburb as fallback

            if (data.address.postcode) addressParts.push(data.address.postcode);
            if (data.address.country) addressParts.push(data.address.country);
        }
        const detailedAddress = addressParts.length > 0 ? addressParts.join(', ') : data.display_name.split(',')[0]; // Use first part of display_name as fallback if address parts are empty
        // Include coords in the display name for clarity/debugging only if needed, can be removed for cleaner UI
        // const displayName = `${detailedAddress} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        const displayName = detailedAddress; // Use just the constructed address for cleaner display

       console.log("Formatted Address:", displayName); // Log the formatted address

      return {
        lat: lat,
        lng: lng,
        displayName: displayName, // Use constructed address
      };
    } else {
       console.warn("Reverse geocode: No display_name found in response.");
       // Fallback if address not found or display_name missing
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
  console.log(`Geocoding address: ${address}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Geocode Raw Result:", data); // Log the full raw result
    if (data && data.length > 0) {
      const result = data[0];
      // Format display name similarly to reverse geocode
       const addressParts = [];
        if (result.address) {
            if (result.address.road) addressParts.push(result.address.road);
            if (result.address.house_number) addressParts.push(result.address.house_number);
            if (result.address.city) addressParts.push(result.address.city);
            else if (result.address.town) addressParts.push(result.address.town);
            else if (result.address.village) addressParts.push(result.address.village);
            else if (result.address.suburb) addressParts.push(result.address.suburb);
            if (result.address.postcode) addressParts.push(result.address.postcode);
            if (result.address.country) addressParts.push(result.address.country);
        }
       const detailedAddress = addressParts.length > 0 ? addressParts.join(', ') : result.display_name.split(',')[0];
      // const displayName = `${detailedAddress} (${parseFloat(result.lat).toFixed(5)}, ${parseFloat(result.lon).toFixed(5)})`;
      const displayName = detailedAddress; // Cleaner display
       console.log("Formatted Address from Geocode:", displayName);

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: displayName,
      };
    } else {
      console.warn(`Geocode: Address not found for "${address}"`);
      return null; // Address not found
    }
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
}


const MealDeliveryPage = () => {
  const { toast } = useToast();
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
  const [clickMode, setClickMode] = useState<'origin' | 'destination' | 'none'>('none'); // Track next map click target, default to none


   // Define calculateRoute first so handleMapClick can use it
   const calculateRoute = useCallback(async (currentOrigin?: L.Marker | null, currentDestination?: L.Marker | null) => {
       const originToUse = currentOrigin ?? originMarker;
       const destinationToUse = currentDestination ?? destinationMarker;

       if (!LRef.current || !mapRef.current || !originToUse || !destinationToUse) {
           console.warn("Calculate route skipped: Missing map, leaflet, or markers.", { hasMap: !!mapRef.current, hasL: !!LRef.current, hasOrigin: !!originToUse, hasDest: !!destinationToUse });
           toast({
               variant: 'default',
               title: 'Information Manquante',
               description: 'Veuillez définir un point de départ ET de destination sur la carte ou via la recherche pour calculer l\'itinéraire.',
           });
           return;
       }
       const L = LRef.current;
       const currentMap = mapRef.current; // Use local var

       const originCoords = originToUse.getLatLng();
       const destinationCoords = destinationToUse.getLatLng();
       console.log(`Calculating route from (${originCoords.lat}, ${originCoords.lng}) to (${destinationCoords.lat}, ${destinationCoords.lng})`);

       // Show loading toast for route calculation
       const routeToast = toast({ title: "Calcul de l'itinéraire..." });

       try {
           const response = await fetch(
               `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destinationCoords.lng},${destinationCoords.lat}?geometries=geojson&overview=full`
           );

           if (!response.ok) {
               throw new Error(`OSRM error: ${response.status} ${await response.text()}`);
           }

           const data = await response.json();
           console.log("OSRM Route Data:", data);

           if (data.routes && data.routes.length > 0) {
               const route = data.routes[0];
               const geoJson = route.geometry;
               const distanceKm = (route.distance / 1000).toFixed(2); // Distance in km
               const durationMinutes = Math.round(route.duration / 60); // Duration in minutes

               // Check map instance and layer existence before removing
               if (currentMap && routeLine && currentMap.hasLayer(routeLine)) {
                   console.log("Removing existing route line.");
                   currentMap.removeLayer(routeLine);
               }

                console.log("Adding new route line.");
               const newRouteLine = L.geoJSON(geoJson, {
                   style: { color: 'hsl(var(--primary))', weight: 5 },
               }).addTo(currentMap);

               newRouteLine.bindPopup(`Distance: ${distanceKm} km<br>Durée: ~${durationMinutes} min`); // Don't open popup by default, let user click
               setRouteLine(newRouteLine); // Update state

               currentMap.fitBounds(newRouteLine.getBounds());

                // Close marker popups if open
               if(originToUse.isPopupOpen()) originToUse.closePopup();
               if(destinationToUse.isPopupOpen()) destinationToUse.closePopup();


               routeToast.update({
                   id: routeToast.id,
                   title: 'Itinéraire Calculé',
                   description: `Distance: ${distanceKm} km, Durée: ~${durationMinutes} min. Options de livraison disponibles ci-dessous.`,
               });

           } else {
                console.warn("OSRM: No route found.");
               routeToast.update({
                   id: routeToast.id,
                   variant: 'destructive',
                   title: 'Aucun itinéraire trouvé',
                   description: 'Impossible de calculer un itinéraire entre ces points.',
               });
           }
       } catch (error: any) {
           console.error('Error calculating route:', error);
           routeToast.update({
               id: routeToast.id,
               variant: 'destructive',
               title: 'Erreur de calcul d’itinéraire',
               description: `Une erreur s’est produite lors du calcul de l’itinéraire. ${error.message || ''}`,
           });
           // Ensure map interactivity isn't blocked by a stale loading state
       }
   }, [originMarker, destinationMarker, routeLine, toast]); // Dependencies for calculateRoute

   // Define handleMapClick within the component scope, wrapped in useCallback
   const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
     console.log("Map clicked, current mode:", clickMode); // Debug log
     if (!mapLoaded || !LRef.current || !mapRef.current || clickMode === 'none') {
       if (clickMode === 'none') {
            toast({ variant: 'default', title: 'Mode Sélection Inactif', description: "Cliquez sur l'icône 'Choisir sur la carte' (📍) près d'un champ d'adresse pour activer la sélection." });
       } else {
           console.warn("Map click ignored: Map not loaded or ready.", { mapLoaded, LRef: !!LRef.current, mapRef: !!mapRef.current });
            toast({ variant: 'destructive', title: 'Carte non prête' });
       }
       return;
     }

     const L = LRef.current;
     const currentMap = mapRef.current; // Use local variable
     const latLng = e.latlng;
     console.log("Clicked Coords:", latLng); // Debug log

     // Show loading toast for reverse geocoding
     const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Lat: ${latLng.lat.toFixed(5)}, Lng: ${latLng.lng.toFixed(5)}` });

     const geocodeResult = await reverseGeocode(latLng.lat, latLng.lng);
     console.log("Reverse Geocode Result in click handler:", geocodeResult); // Debug log

     // Update or dismiss the toast based on geocode result
     geocodeToast.update({
        id: geocodeToast.id,
        title: geocodeResult ? "Adresse trouvée" : "Adresse non trouvée",
        description: geocodeResult ? geocodeResult.displayName : `Impossible de trouver une adresse pour ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`,
        variant: geocodeResult ? 'default' : 'destructive'
      });


     // Proceed only if geocoding was successful (even if it's just coordinates)
     if (!geocodeResult) {
         console.warn("Map click aborted: Reverse geocoding failed.");
         setClickMode('none'); // Reset click mode if geocoding fails
         return;
     }

      // This is the address we'll use for the input field and marker popup
     const address = geocodeResult.displayName;


     if (clickMode === 'origin') {
        if (!originIcon) {
            console.error("Origin icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de départ n'a pas pu être chargée." });
            setClickMode('none');
            return;
        }
        console.log("Setting Origin...");
        // Check map instance and layer existence before removing
        if (currentMap && originMarker && currentMap.hasLayer(originMarker)) {
            console.log("Removing previous origin marker.");
             try { currentMap.removeLayer(originMarker); } catch (error) { console.warn("Error removing origin marker:", error); }
        }
        // Remove route if origin changes
        if (currentMap && routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because origin changed.");
             try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
            setRouteLine(null);
        }

        setOrigin(address); // Update STATE for the input field

         try {
             console.log("Adding new origin marker.");
            const newOriginMarker = L.marker([latLng.lat, latLng.lng], { icon: originIcon })
                .addTo(currentMap)
                .bindPopup(`Départ: ${address.split(',')[0]}`) // Show only first part of address
                .openPopup();
            setOriginMarker(newOriginMarker); // Update state with the NEW marker

            console.log("Switching click mode to destination.");
            setClickMode('destination'); // Next click should set destination
            toast({ title: "Point de Départ Défini", description: "Cliquez maintenant sur la carte pour définir la destination, ou utilisez la recherche." });

            // If destination already exists, calculate route immediately
            if (destinationMarker) {
                console.log("Calculating route after origin set via click (destination exists)...");
                await calculateRoute(newOriginMarker, destinationMarker); // Pass the new origin
            }
         } catch (error) {
             console.error("Error adding origin marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Départ", description: "Impossible d'ajouter le marqueur de départ." });
             setClickMode('none'); // Reset click mode on error
         }


     } else if (clickMode === 'destination') {
         if (!destinationIcon) {
            console.error("Destination icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de destination n'a pas pu être chargée." });
            setClickMode('none');
            return;
        }
       console.log("Setting Destination...");
        // Check map instance and layer existence before removing
        if (currentMap && destinationMarker && currentMap.hasLayer(destinationMarker)) {
            console.log("Removing previous destination marker.");
             try { currentMap.removeLayer(destinationMarker); } catch (error) { console.warn("Error removing destination marker:", error); }
        }
        // Remove route if destination changes
        if (currentMap && routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because destination changed.");
             try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
            setRouteLine(null);
        }

       setDestination(address); // Update STATE for the input field

         try {
             console.log("Adding new destination marker.");
             const newDestinationMarker = L.marker([latLng.lat, latLng.lng], { icon: destinationIcon })
               .addTo(currentMap)
               .bindPopup(`Destination: ${address.split(',')[0]}`) // Show only first part of address
               .openPopup();
             setDestinationMarker(newDestinationMarker); // Update state with the NEW marker

             console.log("Deactivating click mode.");
             setClickMode('none'); // Deactivate map clicking after destination is set
             toast({ title: "Destination Définie", description: "Vous pouvez maintenant calculer l'itinéraire ou ajuster les points." });

              // Automatically calculate route if origin also exists
              if (originMarker) {
                   console.log("Calculating route after destination set via click...");
                   await calculateRoute(originMarker, newDestinationMarker); // Pass the new destination
              }
         } catch (error) {
             console.error("Error adding destination marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Destination", description: "Impossible d'ajouter le marqueur de destination." });
              setClickMode('none'); // Reset click mode on error
         }

     } else {
         // Should not happen if initial check passed, but good for safety
         console.warn("Map clicked but clickMode was neither 'origin' nor 'destination'. Mode:", clickMode);
         setClickMode('none'); // Reset just in case
     }
   }, [clickMode, mapLoaded, originMarker, destinationMarker, routeLine, toast, calculateRoute]); // Add calculateRoute to dependencies


  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || !document.getElementById('map') || mapRef.current) {
         console.log("Map initialization skipped:", { hasWindow: typeof window !== 'undefined', mapElementExists: !!document.getElementById('map'), mapRefExists: !!mapRef.current });
         return;
      }

      try {
        console.log("Initializing map...");
        const L = (await import('leaflet')).default;
        LRef.current = L; // Store L reference

        // Initialize icons *after* L is loaded
        console.log("Creating Lucide icons for Leaflet...");
        originIcon = createLucideIcon(Pin, 'text-blue-600', 8); // Blue for origin, larger size
        destinationIcon = createLucideIcon(PinOff, 'text-green-600', 8); // Green for destination, larger size
        currentPositionIcon = createLucideIcon(Locate, 'text-red-600', 8); // Red for GPS, larger size
         if (!originIcon || !destinationIcon || !currentPositionIcon) {
          console.error("Failed to create one or more Leaflet icons.");
          toast({ variant: 'destructive', title: 'Erreur Icone Carte', description: "Impossible de charger les icônes pour la carte." });
          // Potentially return early or handle this state
        } else {
             console.log("Leaflet icons created successfully.");
        }

        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error("Map element not found after import");
            return;
        }

        // Check again if mapRef was set concurrently
        if (mapRef.current) {
            console.log("Map already initialized (concurrently), skipping.");
            return;
        }


        const map = L.map(mapElement, {
          center: [defaultLocation.lat, defaultLocation.lng],
          zoom: 10,
          doubleClickZoom: false, // Keep double click zoom disabled
          closePopupOnClick: true, // Allow popups to close normally
          attributionControl: false, // Disable default attribution
        });
         console.log("Leaflet map instance created.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { // Use https and standard subdomains
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
         console.log("Tile layer added.");

        // Add attribution control manually to ensure it's present but minimal
        L.control.attribution({ position: 'bottomright', prefix: '' }).addTo(map);
         console.log("Attribution control added.");

        mapRef.current = map; // Assign map instance to ref

        // Call invalidateSize AFTER map is fully initialized and added to DOM
        // Use setTimeout to ensure it runs after the current render cycle completes
        setTimeout(() => {
            if (mapRef.current) {
                 console.log("Calling map.invalidateSize()...");
                mapRef.current.invalidateSize();
                 console.log("map.invalidateSize() called.");
                 setMapLoaded(true); // Set map loaded state AFTER invalidateSize
                 console.log("Map initialized and loaded state set AFTER invalidateSize.");
            }
        }, 0);


        // Safely access container after mapRef is set and set cursor
        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = 'crosshair'; // Set cursor style
           console.log("Map container cursor set to crosshair.");
        } else {
            console.warn("Map container not found immediately after initialization.");
        }

        // Attach the click listener here - IMPORTANT: Use the useCallback version
        map.on('click', handleMapClick);
        console.log("Map 'click' listener attached.");

        // Check GPS permission state on load, but don't try to get location yet
        checkGpsPermission(false);
        console.log("Initial GPS permission check performed.");


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
      console.log("Cleaning up map...");
      const currentMap = mapRef.current; // Capture current ref value
      if (currentMap) {
         console.log("Map instance found for cleanup.");
         try {
           // Remove event listeners first - IMPORTANT: Use the same function reference
           currentMap.off('click', handleMapClick);
           console.log("Map 'click' listener removed.");

           // Check if the container exists before calling remove()
           if (currentMap.getContainer() && document.getElementById('map')) { // Also check if element still exists
                console.log("Removing map instance...");
                currentMap.remove(); // Remove map instance from the DOM
                console.log("Map instance removed.");
           } else {
                console.log("Map container already removed or detached, skipping map.remove().");
           }
         } catch (e) {
           console.warn("Error during map cleanup:", e);
         } finally {
           mapRef.current = null; // Clear the ref AFTER cleanup attempts
           console.log("Map ref cleared.");
         }
      } else {
         console.log("No map instance found in ref for cleanup.");
      }
      LRef.current = null; // Clean up L reference
      originIcon = undefined; // Clean up icons
      destinationIcon = undefined;
      currentPositionIcon = undefined;
      setMapLoaded(false); // Reset map loaded state
      console.log("Map cleanup complete.");
    };

    // Return the cleanup function to be called on component unmount
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, handleMapClick]); // handleMapClick is now a dependency due to useCallback


  const checkGpsPermission = async (getLocationOnGrant = false) => {
      console.log(`Checking GPS permission. getLocationOnGrant: ${getLocationOnGrant}`);
      if (!navigator.geolocation) {
           console.warn("Geolocation API not supported by this browser.");
          setHasGpsPermission(false);
          return () => {}; // Return empty cleanup
      }
       try {
           const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
           console.log(`Initial GPS permission state: ${permissionStatus.state}`);
           const granted = permissionStatus.state === 'granted';
           setHasGpsPermission(granted);

           if (granted && getLocationOnGrant) {
                console.log("Permission granted and getLocationOnGrant is true, getting location...");
                // Don't await here, let it run in background, but handle potential errors inside
                getCurrentLocationAndSetOrigin();
           } else if (permissionStatus.state === 'prompt' && getLocationOnGrant) {
               console.log("Permission state is 'prompt', getCurrentLocation will trigger the browser prompt.");
               // Call it directly, it will trigger the prompt
               getCurrentLocationAndSetOrigin();
           } else if (permissionStatus.state === 'denied') {
               console.log("GPS permission denied.");
               // Optionally show a specific message or guide user to settings
           }


           // Use a variable for the listener function to remove it later if needed
           const permissionChangeListener = () => {
               console.log(`GPS permission state changed to: ${permissionStatus.state}`);
               const isGrantedNow = permissionStatus.state === 'granted';
               setHasGpsPermission(isGrantedNow);
                if (isGrantedNow && getLocationOnGrant) {
                    // Only get location if initially requested or user manually triggers again
                    console.log("Permission granted via listener, getting location if requested.");
                    // getCurrentLocationAndSetOrigin(); // Avoid auto-getting location on change unless explicitly desired
                } else if (!isGrantedNow) {
                    setCurrentLocation(null);
                    // Consider removing the current location marker if it exists and permission is revoked
                    console.log("GPS permission revoked or denied via listener.");
                }
           };

           let cleanupFunc = () => {};
           // Use try-catch for adding event listener
           try {
                permissionStatus.addEventListener('change', permissionChangeListener);
                 console.log("Added 'change' listener for geolocation permission.");
                 cleanupFunc = () => {
                    try {
                        permissionStatus.removeEventListener('change', permissionChangeListener);
                         console.log("Removed 'change' listener for geolocation permission.");
                    } catch (e) {
                        console.warn("Error removing geolocation event listener:", e);
                         try { permissionStatus.onchange = null; } catch (e2) {} // Fallback removal
                    }
                };
           } catch (e) {
                console.warn("addEventListener not supported for permission status, using onchange fallback.");
                // Fallback for older browsers
                permissionStatus.onchange = permissionChangeListener;
                 cleanupFunc = () => {
                     try { permissionStatus.onchange = null; } catch (e) { console.warn("Error clearing onchange for geolocation:", e); }
                 };
           }

           // Return the specific cleanup function for this listener
           return cleanupFunc;

       } catch (error) {
           console.error("Error checking GPS permission:", error);
           setHasGpsPermission(false);
           return () => {}; // Return empty cleanup on error
       }
   };

   // Resets markers and route, keeps input values
   const resetMapStateForNewOrigin = () => {
       console.log("Resetting map state (markers, route), keeping inputs.");
        if (!mapRef.current) return;
        const currentMap = mapRef.current; // Use local variable

        // Check map and layer existence before removing
        if (originMarker && currentMap.hasLayer(originMarker)) {
             console.log("Removing origin marker.");
            try { currentMap.removeLayer(originMarker); } catch (e) { console.warn("Error removing origin marker", e); }
        }
        if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
            console.log("Removing destination marker.");
            try { currentMap.removeLayer(destinationMarker); } catch (e) { console.warn("Error removing dest marker", e); }
        }
        if (routeLine && currentMap.hasLayer(routeLine)) {
            console.log("Removing route line.");
             try { currentMap.removeLayer(routeLine); } catch (e) { console.warn("Error removing route line", e); }
        }

        setOriginMarker(null);
        setDestinationMarker(null);
        setRouteLine(null);
        // Don't reset click mode here, let the calling function decide
        // setClickMode('origin'); // Default back to setting origin
    };


  const getCurrentLocationAndSetOrigin = async () => {
      console.log("Attempting to get current location and set as origin...");
    if (!LRef.current || !mapRef.current || !currentPositionIcon) {
        console.error("Cannot get location: Map, Leaflet, or GPS icon not ready.", { mapReady: !!mapRef.current, LReady: !!LRef.current, iconReady: !!currentPositionIcon });
       toast({ variant: 'destructive', title: 'Erreur Carte/Icone', description: 'La carte ou l\'icône GPS n\'a pas pu être chargée.' });
       return;
    }
    const L = LRef.current;
    const currentMap = mapRef.current; // Use local variable

    // Show immediate feedback that we're trying
    const gpsToast = toast({ title: "Localisation en cours...", description: "Tentative de récupération de votre position GPS." });


    resetMapStateForNewOrigin(); // Clear existing markers/route before getting new location

    try {
      console.log("Calling navigator.geolocation.getCurrentPosition...");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, // Request high accuracy
            timeout: 10000, // Increase timeout to 10 seconds
            maximumAge: 0 // Force fresh location data
        });
      });
      console.log("Geolocation success:", position);
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCurrentLocation(coords); // Update state with current coords
      setHasGpsPermission(true); // Confirm permission was granted

      // Proceed only if icon is available (redundant check, but safe)
       if (!currentPositionIcon) throw new Error("Current position icon became unavailable");

        // Try adding marker and reverse geocoding
        let newMarker: L.Marker | null = null;
        try {
           console.log("Adding GPS location marker to map.");
           newMarker = L.marker([coords.lat, coords.lng], { icon: currentPositionIcon }).addTo(currentMap);
           setOriginMarker(newMarker); // Set this as the origin marker

            console.log("Reverse geocoding GPS coordinates...");
           const geocodeResult = await reverseGeocode(coords.lat, coords.lng);
           const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
           console.log("GPS Reverse Geocode Result:", address);

           // Update popup and input field
           newMarker.bindPopup(`Départ (Actuel): ${address.split(',')[0]}`).openPopup(); // Use simple popup
           setOrigin(address); // Update input field STATE

           // Update map view and click mode
           currentMap.setView([coords.lat, coords.lng], 15); // Zoom in closer
           console.log("Setting click mode to 'destination' after GPS success.");
           setClickMode('destination'); // Next click sets destination

            // Update toast to success
            gpsToast.update({
                id: gpsToast.id,
                title: 'Position Actuelle Définie',
                description: `Votre position a été définie comme point de départ: ${address.split(',')[0]}. Choisissez la destination.`,
            });


            // If destination already existed, calculate route immediately
            if (destinationMarker && newMarker) {
                console.log("Calculating route after GPS origin set (destination existed)...");
                await calculateRoute(newMarker, destinationMarker); // Pass the new origin marker
            }

        } catch (markerOrGeocodeError) {
             console.error('Error adding GPS marker or reverse geocoding:', markerOrGeocodeError);
             gpsToast.update({ id: gpsToast.id, variant: 'destructive', title: 'Erreur Affichage Position', description: 'Impossible d\'afficher ou de nommer votre position sur la carte.' });
             // Attempt to remove potentially broken marker if it exists
             if (newMarker && currentMap.hasLayer(newMarker)) {
                 try { currentMap.removeLayer(newMarker); } catch (removeError) { console.warn("Error removing failed GPS marker:", removeError); }
                 setOriginMarker(null);
             }
             // Still set coords in input as fallback and center map
             setOrigin(`Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
             currentMap.setView([coords.lat, coords.lng], 15);
              console.log("Setting click mode to 'destination' even after GPS marker error.");
             setClickMode('destination'); // Still allow setting destination
        }


    } catch (error: any) {
      console.error('Error accessing GPS location:', error);
       setHasGpsPermission(false); // Assume permission denied or error
       setCurrentLocation(null); // Clear current location state

      let description = 'Une erreur s’est produite lors de la récupération de votre position.';
       if (error.code === error.PERMISSION_DENIED) {
           description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur pour utiliser cette fonction.';
           // Open the permission dialog again if denied here
           setIsGpsDialogOpen(true);
       } else if (error.code === error.POSITION_UNAVAILABLE) {
           description = 'Votre position actuelle n’est pas disponible. Vérifiez vos paramètres de localisation.';
       } else if (error.code === error.TIMEOUT) {
           description = 'La demande de géolocalisation a expiré. Veuillez réessayer.';
       }

        // Update toast to failure
       gpsToast.update({
           id: gpsToast.id,
           variant: 'destructive',
           title: 'Erreur GPS',
           description: description,
       });
    }
  };


    // Resets everything: markers, route, input values, map view
    const resetFullMap = () => {
        console.log("Resetting full map state: inputs, markers, route, view.");
        const currentMap = mapRef.current; // Use local variable
        if (currentMap && LRef.current) {
           resetMapStateForNewOrigin(); // Clear markers and route first
           setOrigin(''); // Clear input state
           setDestination(''); // Clear input state
           // Optionally reset GPS state if needed
           // setCurrentLocation(null);
           // setHasGpsPermission(null); // Maybe keep this state as is?
           currentMap.setView([defaultLocation.lat, defaultLocation.lng], 10); // Reset view
           setClickMode('origin'); // Reset click mode to origin
           toast({ title: 'Carte Réinitialisée', description: 'Sélectionnez un nouveau point de départ.' });
        } else {
            console.warn("Cannot reset full map: Map not ready.");
        }
      };


   // Function to focus input and set click mode
   const handleFocusInputAndSetMode = (ref: React.RefObject<HTMLInputElement>, mode: 'origin' | 'destination') => {
     if (ref.current) {
         console.log(`Setting click mode to '${mode}' and focusing input.`);
       ref.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
       ref.current.focus();
       setClickMode(mode); // Set the click mode STATE
       toast({
           title: `Mode Sélection ${mode === 'origin' ? 'Départ' : 'Destination'} Activé`,
           description: `Cliquez sur la carte pour définir ${mode === 'origin' ? 'le point de départ' : 'la destination'}.`,
       });
     } else {
         console.warn(`Cannot focus input for mode '${mode}': Ref is null.`);
     }
   };

  const handleUseCurrentLocation = async () => {
      console.log("'Use Current Location' button clicked.");
     if (!mapLoaded || !LRef.current || !mapRef.current) {
      console.warn("Cannot use current location: Map not ready.");
      toast({ variant: 'destructive', title: 'Carte non prête' });
      return;
    }

     // Use a local variable to store cleanup function from permission check
     let cleanupPermissionListener: (() => void) | undefined;

     console.log("Current hasGpsPermission state:", hasGpsPermission);

    if (hasGpsPermission === false) {
        console.log("Permission previously denied or unavailable. Showing GPS dialog.");
      setIsGpsDialogOpen(true); // Show dialog to ask user again
    } else if (hasGpsPermission === true) {
        console.log("Permission previously granted. Getting location directly.");
       await getCurrentLocationAndSetOrigin(); // Already granted, just get location
    } else {
       // If permission state is null (unknown), try to get it, which might trigger browser prompt
       console.log("Permission state unknown. Checking permission and attempting to get location.");
       try {
          cleanupPermissionListener = await checkGpsPermission(true); // Check and *attempt* to get location if granted/prompted

          // After the check, re-evaluate the permission state (it might have been updated)
          // We need a slight delay or rely on the listener if it was 'prompt' initially
          setTimeout(async () => {
               if (navigator.permissions) {
                   try {
                       const currentStatus = await navigator.permissions.query({ name: 'geolocation' });
                       console.log("Permission status after check/attempt:", currentStatus.state);
                       if (currentStatus.state !== 'granted') {
                           // If still not granted (e.g., user denied prompt), show our dialog as fallback/explanation
                           console.log("Permission still not granted after check. Showing GPS dialog.");
                           setIsGpsDialogOpen(true);
                       }
                       // If granted, getCurrentLocationAndSetOrigin should have been called by checkGpsPermission
                   } catch (queryError) {
                       console.error("Error querying permission status after check:", queryError);
                       // Fallback: If querying fails, assume we need to ask via dialog
                       setIsGpsDialogOpen(true);
                   }
               } else {
                   // Fallback if permissions API not supported, assume need to ask via dialog
                   console.log("Permissions API not supported. Showing GPS dialog.");
                   setIsGpsDialogOpen(true);
               }
          }, 100); // Small delay to allow potential browser prompt to resolve

       } catch (permError) {
          console.error("Error in checkGpsPermission call:", permError);
          // Fallback to showing dialog if the permission check itself fails
          setIsGpsDialogOpen(true);
       }
    }

     // Clean up the listener if it was created during the process
    // Note: This cleanup might be premature if the dialog is shown,
    // but it's complex to manage otherwise. The listener *should* be robust.
    if (cleanupPermissionListener) {
        try {
             console.log("Cleaning up temporary permission listener.");
             cleanupPermissionListener();
        } catch (cleanupError) {
             console.warn("Error during temporary permission listener cleanup:", cleanupError);
        }
    }
  };

   const handleGpsDialogAction = async (allow: boolean) => {
       console.log(`GPS Dialog action: ${allow ? 'Allow' : 'Deny'}`);
     setIsGpsDialogOpen(false);
     if (allow) {
       // User explicitly clicked "Allow" in our dialog, so try getting location.
       // This will trigger the *browser's* permission prompt if needed.
       console.log("User allowed via dialog. Attempting to get location (may trigger browser prompt)...");
       await getCurrentLocationAndSetOrigin();
     } else {
         console.log("User denied via dialog.");
       // User clicked "Deny" or "Cancel"
       toast({
         title: 'GPS Non Activé',
         description: 'Vous pouvez spécifier votre position manuellement en cliquant sur la carte.',
       });
       // Optionally, activate map click for origin if not already set
       if (!originMarker) {
            console.log("Activating origin map click after GPS dialog denial.");
            handleFocusInputAndSetMode(originInputRef, 'origin');
       }
     }
   };


   // Handle address search from input fields
   const handleAddressSearch = async (type: 'origin' | 'destination') => {
       console.log(`Handling address search for: ${type}`);
       if (!mapRef.current || !LRef.current || !originIcon || !destinationIcon) {
            console.error("Cannot search address: Map, Leaflet, or icons not ready.", { mapReady: !!mapRef.current, LReady: !!LRef.current, iconsReady: !!originIcon && !!destinationIcon });
           toast({ variant: "destructive", title: "Carte non prête", description: "La carte ou ses composants ne sont pas encore initialisés." });
           return;
       }
       const L = LRef.current;
       const currentMap = mapRef.current; // Use local variable
       const address = type === 'origin' ? origin : destination; // Get address from STATE

       if (!address || address.trim().length < 3) { // Basic validation
           console.warn(`Address search validation failed for ${type}: "${address}"`);
           toast({ variant: 'destructive', title: 'Recherche invalide', description: 'Veuillez entrer une adresse plus complète (au moins 3 caractères).' });
           return;
       }

       // Show loading toast for geocoding
       const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Recherche de: ${address}` });

       const result = await geocodeAddress(address); // Perform geocoding

        // Update or dismiss the toast based on result
       geocodeToast.update({
           id: geocodeToast.id,
           title: result ? "Adresse trouvée" : "Adresse non trouvée",
           description: result ? result.displayName : `Impossible de localiser: ${address}`,
           variant: result ? 'default' : 'destructive'
       });

       if (result) {
           console.log(`Geocode successful for ${type}:`, result);
           const { lat, lng, displayName } = result;
           // Use blue Pin for origin search result, green PinOff for destination
           const iconToUse = type === 'origin' ? originIcon : destinationIcon;
           let markerRef = type === 'origin' ? originMarker : destinationMarker;
           const setMarkerState = type === 'origin' ? setOriginMarker : setDestinationMarker;
           const setAddressState = type === 'origin' ? setOrigin : setDestination;

           // Remove existing marker of the same type
           if (markerRef && currentMap.hasLayer(markerRef)) {
               console.log(`Removing previous ${type} marker.`);
               try { currentMap.removeLayer(markerRef); } catch (error) { console.warn(`Error removing ${type} marker:`, error); }
           }
            // Remove route line if address changes via search
            if (routeLine && currentMap.hasLayer(routeLine)) {
                console.log(`Removing route line because ${type} changed via search.`);
               try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
               setRouteLine(null); // Clear route state
           }

           // Add new marker
           let newMarker: L.Marker | null = null;
           try {
                console.log(`Adding new ${type} marker at (${lat}, ${lng}).`);
                if (!iconToUse) throw new Error(`${type} icon is not loaded`); // Should not happen due to initial check, but safe
               newMarker = L.marker([lat, lng], { icon: iconToUse })
                   .addTo(currentMap)
                   .bindPopup(`${type === 'origin' ? 'Départ' : 'Destination'}: ${displayName.split(',')[0]}`)
                   .openPopup();

               setMarkerState(newMarker); // Update marker STATE
               setAddressState(displayName); // Update address STATE with formatted name

               currentMap.setView([lat, lng], 15); // Center map on the result

               // Determine next logical click mode
               const otherMarkerExists = type === 'origin' ? !!destinationMarker : !!originMarker;
               if (!otherMarkerExists) {
                    const nextMode = type === 'origin' ? 'destination' : 'origin';
                    console.log(`Setting click mode to '${nextMode}' after ${type} search.`);
                    setClickMode(nextMode);
                    toast({ title: `${type === 'origin' ? 'Point de Départ' : 'Destination'} Trouvé`, description: `Sélectionnez maintenant ${nextMode === 'origin' ? 'le point de départ' : 'la destination'} sur la carte ou via la recherche.`});
               } else {
                   console.log(`Deactivating click mode after ${type} search (both points exist).`);
                   setClickMode('none'); // Both points set or search initiated it
                   // toast({ title: 'Adresse Trouvée', description: displayName }); // Toast already shown by geocode result
               }


                // Automatically calculate route if both markers now exist after this search
                const currentOriginMarker = type === 'origin' ? newMarker : originMarker;
                const currentDestinationMarker = type === 'destination' ? newMarker : destinationMarker;
                 if (currentOriginMarker && currentDestinationMarker) {
                     console.log(`Calculating route after ${type} search (both markers exist).`);
                     await calculateRoute(currentOriginMarker, currentDestinationMarker); // Pass markers explicitly
                 }

           } catch (error) {
               console.error(`Error adding marker for ${type} search:`, error);
               toast({ variant: 'destructive', title: `Erreur Marqueur ${type === 'origin' ? 'Départ' : 'Destination'}`, description: `Impossible d'ajouter le marqueur pour ${address}.` });
               // Attempt to remove potentially failed marker
               if (newMarker && currentMap.hasLayer(newMarker)) {
                    try { currentMap.removeLayer(newMarker); } catch (removeError) { console.warn("Error removing failed search marker:", removeError); }
                    setMarkerState(null); // Clear marker state on error
               }
               // Reset click mode potentially
               setClickMode('none');
           }

       } else {
            console.warn(`Address search failed for ${type}: "${address}"`);
           // Toast already shown by geocode result update
           // toast({ variant: 'destructive', title: 'Adresse Non Trouvée', description: 'Impossible de localiser cette adresse. Essayez différemment ou cliquez sur la carte.' });
       }
    };



  return (
    <TooltipProvider delayDuration={100}> {/* Reduced delay */}
      <div>
        {/* The map container */}
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4" />

        {/* Add CSS for leaflet-lucide-icon to prevent default Leaflet icon background/border */}
        <style jsx global>{`
          /* Reset Leaflet's default icon styles for our custom divIcons */
          .leaflet-lucide-icon {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            line-height: 0; /* Prevent extra space */
            margin: 0 !important; /* Reset margins */
            padding: 0 !important; /* Reset padding */
          }
           /* Ensure the divIcon container itself doesn't have weird styles */
           .leaflet-marker-icon.leaflet-div-icon {
             background: none;
             border: none;
             padding: 0;
             margin: 0; /* Reset margin for the marker container */
             box-shadow: none;
             /* Let the icon size be determined by the divIcon options */
             width: auto !important;
             height: auto !important;
           }
           /* Fine-tune the inner div wrapper if needed */
           .leaflet-marker-icon .leaflet-lucide-icon div {
              line-height: normal; /* Or adjust as needed */
           }
           /* Ensure map container is visible and has a minimum height */
            #map {
              min-height: 400px; /* Ensure map has a minimum height */
              background-color: #eee; /* Light grey background while loading */
              z-index: 0; /* Ensure map is behind interactive elements if needed, but visible */
            }
            /* Style for the crosshair cursor (already set inline, but good fallback) */
            #map.leaflet-container {
                cursor: crosshair !important;
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
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-32" // Increased padding-right for 3 icons
                    placeholder="Entrer l'adresse, utiliser le GPS, ou cliquer sur la carte"
                    value={origin} // Controlled input: value comes from state
                    onChange={(e) => setOrigin(e.target.value)} // Update state on change
                    ref={originInputRef}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('origin')} // Search on Enter
                    aria-label="Adresse de ramassage"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    {/* Search Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('origin')}
                          aria-label="Rechercher l'adresse de ramassage entrée"
                          disabled={!origin.trim()} // Disable if input is empty
                        >
                           <Search className="h-5 w-5 text-gray-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Rechercher l'adresse entrée
                      </TooltipContent>
                    </Tooltip>
                    {/* Map Pick Button */}
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
                    {/* GPS Button */}
                    <Tooltip>
                       <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleUseCurrentLocation}
                           aria-label={
                            hasGpsPermission === true
                              ? "Utiliser ma position actuelle (GPS)"
                              : hasGpsPermission === false
                              ? "Activer GPS (accès refusé)"
                              : "Activer et utiliser le GPS"
                          }
                        >
                          <Locate className={`h-5 w-5 ${hasGpsPermission === false ? 'text-destructive' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasGpsPermission === true ? "Utiliser ma position actuelle (GPS)" : "Activer et utiliser le GPS"}
                         {hasGpsPermission === false && " (accès refusé)"}
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
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-20" // Padding for 2 icons
                    placeholder="Entrer l'adresse ou cliquer sur la carte"
                    value={destination} // Controlled input: value comes from state
                    onChange={(e) => setDestination(e.target.value)} // Update state on change
                    ref={destinationInputRef}
                     onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')} // Search on Enter
                     aria-label="Adresse de destination"
                  />
                   <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                     {/* Search Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('destination')}
                          aria-label="Rechercher l'adresse de destination entrée"
                          disabled={!destination.trim()} // Disable if input is empty
                        >
                           <Search className="h-5 w-5 text-gray-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Rechercher l'adresse entrée
                      </TooltipContent>
                    </Tooltip>
                     {/* Map Pick Button */}
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
                <Button onClick={() => calculateRoute()} disabled={!originMarker || !destinationMarker}>
                  {routeLine ? 'Recalculer l\'Itinéraire' : 'Calculer l\'Itinéraire'}
                </Button>
                <Button onClick={resetFullMap} variant="secondary">Réinitialiser Carte</Button>
              </div>
            </div>

            {/* Right side: GPS Alert Area */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
               {/* Show only one alert based on GPS status */}
              {hasGpsPermission === false && (
                <Alert variant="destructive">
                  <Locate className="h-4 w-4" /> {/* Add icon to alert */}
                  <AlertTitle>Accès GPS Refusé/Indisponible</AlertTitle>
                  <AlertDescription>
                     L'accès à votre position est désactivé ou non disponible. Vous pouvez essayer de
                     <Button variant="link" className="p-0 h-auto ml-1 text-destructive underline" onClick={handleUseCurrentLocation}>
                        l'activer
                    </Button>
                     , ou définir le point de départ manuellement sur la carte ou par recherche.
                  </AlertDescription>
                </Alert>
              )}
               {hasGpsPermission === null && (
                 <Alert>
                    <Locate className="h-4 w-4" /> {/* Add icon to alert */}
                     <AlertTitle>Autorisation GPS Requise</AlertTitle>
                     <AlertDescription>
                         Pour utiliser votre position actuelle comme point de départ, veuillez
                         <Button variant="link" className="p-0 h-auto ml-1" onClick={handleUseCurrentLocation}>
                            activer le GPS
                         </Button>
                         . Sinon, définissez le départ manuellement.
                     </AlertDescription>
                 </Alert>
                )}
                 {/* Optional: Positive confirmation when GPS is active */}
                {hasGpsPermission === true && currentLocation && (
                 <Alert variant="default" className="border-green-500">
                     <Locate className="h-4 w-4 text-green-600" />
                     <AlertTitle>GPS Actif</AlertTitle>
                     <AlertDescription>
                         Votre position actuelle est utilisée. Vous pouvez la
                          <Button variant="link" className="p-0 h-auto ml-1" onClick={handleUseCurrentLocation}>
                            réactualiser
                         </Button>
                         ou choisir un autre point de départ.
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
                {/* Add appropriate onClick handlers or links later */}
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
                  MapYOO souhaite accéder à votre position actuelle pour définir automatiquement le point de départ. Voulez-vous autoriser l'accès GPS via votre navigateur ?
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
