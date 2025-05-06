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
import {Locate, MapPin, Search, Pin, PinOff} from 'lucide-react'; // Use Locate for GPS, MapPin for Origin/Dest Click, Pin and PinOff for markers
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import type L from 'leaflet'; // Import Leaflet type

const mapContainerStyle = {
  width: '100%',
  height: '400px', // Ensure a fixed height
  cursor: 'crosshair' // Change cursor to crosshair for map clicks
};

const defaultLocation = {
  lat: 34.052235, // Default to LA
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
let currentPositionIcon: L.DivIcon | undefined; // Specific icon for GPS location (e.g., a dot or crosshair)

// Reverse Geocoding function using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr&addressdetails=1`; // Add addressdetails=1
  console.log(`Reverse geocoding for: ${lat}, ${lng}`); // Log coords
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Reverse Geocode Raw Result:", data); // Log the full raw result

    let displayName = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback display name

    if (data && data.address) {
        // Construct a more detailed address in the desired format: 'ville, street, province, code postal, pays'
        const address = data.address;
        const parts = [
            address.city || address.town || address.village || address.hamlet, // Ville
            address.road || address.footway || address.pedestrian, // Street/Road
            address.state || address.region, // Province/State
            address.postcode, // Code postal
            address.country, // Pays
        ];
        // Filter out undefined/null parts and join
        const filteredParts = parts.filter(part => part);
        if (filteredParts.length > 0) {
            displayName = filteredParts.join(', ');
        } else if (data.display_name) {
             // Fallback to display_name if address parts are insufficient
             displayName = data.display_name.split(',').slice(0, 3).join(','); // Take first few parts as fallback
        }
       console.log("Formatted Address:", displayName); // Log the formatted address
    } else {
       console.warn("Reverse geocode: No address details found in response.");
    }

      return {
        lat: lat,
        lng: lng,
        displayName: displayName, // Use constructed or fallback address
      };

  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    // Fallback on error, return coordinates
    const coordsStr = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { lat: lat, lng: lng, displayName: coordsStr };
  }
}


// Geocoding function using Nominatim search
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=fr&countrycodes=ma&addressdetails=1`; // Limit search, prioritize FR/MA, get details
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
        let displayName = `Coordonnées: ${parseFloat(result.lat).toFixed(5)}, ${parseFloat(result.lon).toFixed(5)}`; // Fallback

        if (result.address) {
            // Format display name similarly to reverse geocode
            const addressDetails = result.address;
            const parts = [
                addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.hamlet, // Ville
                addressDetails.road || addressDetails.footway || addressDetails.pedestrian, // Street/Road
                addressDetails.state || addressDetails.region, // Province/State
                addressDetails.postcode, // Code postal
                addressDetails.country, // Pays
            ];
            const filteredParts = parts.filter(part => part);
             if (filteredParts.length > 0) {
                displayName = filteredParts.join(', ');
            } else if (result.display_name) {
                 displayName = result.display_name.split(',').slice(0, 3).join(','); // Fallback
            }
        } else if (result.display_name) {
             displayName = result.display_name.split(',').slice(0, 3).join(','); // Fallback if no address details
        }

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
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null); // null: undetermined, true: granted, false: denied
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [routeLine, setRouteLine] = useState<L.GeoJSON | null>(null);
  const [clickMode, setClickMode] = useState<'origin' | 'destination' | 'none'>('none'); // Track next map click target
  const [mapLoaded, setMapLoaded] = useState(false);


   // Define calculateRoute first so handleMapClick can use it
   const calculateRoute = useCallback(async (currentOrigin?: L.Marker | null, currentDestination?: L.Marker | null) => {
       const originToUse = currentOrigin ?? originMarker;
       const destinationToUse = currentDestination ?? destinationMarker;

       if (!LRef.current || !mapRef.current || !originToUse || !destinationToUse) {
           console.warn("Calculate route skipped: Missing map, leaflet, or markers.", { hasMap: !!mapRef.current, hasL: !!LRef.current, hasOrigin: !!originToUse, hasDest: !!destinationToUse });
           toast({
               variant: 'default',
               title: 'Information Manquante',
               description: 'Veuillez définir un point de départ ET de destination sur la carte ou via la recherche.',
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

                // Explicit check before adding the new layer
                if (!mapRef.current) {
                    console.warn("Map instance became unavailable before adding route line.");
                    throw new Error("Map instance is not available.");
                }

                 console.log("Adding new route line.");
               const newRouteLine = L.geoJSON(geoJson, {
                   style: { color: 'hsl(var(--primary))', weight: 5 },
               }).addTo(mapRef.current); // Use checked mapRef.current

               newRouteLine.bindPopup(`Distance: ${distanceKm} km<br>Durée: ~${durationMinutes} min`); // Don't open popup by default, let user click
               setRouteLine(newRouteLine); // Update state

               mapRef.current.fitBounds(newRouteLine.getBounds()); // Use checked mapRef.current

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
   }, [originMarker, destinationMarker, routeLine, toast]);


   // Define handleMapClick within the component scope, wrapped in useCallback
   const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
     console.log("Map clicked, current mode:", clickMode); // Debug log
     if (!mapLoaded || !LRef.current || !mapRef.current || clickMode === 'none') { // Check mapLoaded
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
     console.log("Clicked Coords:", latLng);

     // Show loading toast for reverse geocoding
     const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Lat: ${latLng.lat.toFixed(5)}, Lng: ${latLng.lng.toFixed(5)}` });

     const geocodeResult = await reverseGeocode(latLng.lat, latLng.lng);
     console.log("Reverse Geocode Result in click handler:", geocodeResult);

     // Update toast based on geocoding result
     geocodeToast.update({
        id: geocodeToast.id,
        title: geocodeResult ? "Adresse trouvée" : "Adresse non trouvée",
        description: geocodeResult ? geocodeResult.displayName : `Impossible de trouver une adresse pour ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`,
        variant: geocodeResult ? 'default' : 'destructive'
      });


     // If geocoding fails, do not proceed
     if (!geocodeResult) {
         console.warn("Map click aborted: Reverse geocoding failed.");
         return;
     }

     const address = geocodeResult.displayName; // Use the display name from geocoding

     if (clickMode === 'origin') {
        if (!originIcon) {
            console.error("Origin icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de départ n'a pas pu être chargée." });
            setClickMode('none'); // Reset click mode
            return;
        }
        console.log("Setting Origin...");
        // Remove previous origin marker if it exists
        if (originMarker && currentMap.hasLayer(originMarker)) {
            console.log("Removing previous origin marker.");
             try { currentMap.removeLayer(originMarker); } catch (error) { console.warn("Error removing origin marker:", error); }
        }
        // Remove route line if origin changes
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because origin changed.");
             try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
            setRouteLine(null); // Reset route line state
        }

        setOrigin(address); // Set origin input field with the geocoded address

         try {
             console.log("Adding new origin marker.");
            const newOriginMarker = L.marker([latLng.lat, latLng.lng], { icon: originIcon })
                .addTo(currentMap)
                .bindPopup(`Départ: ${address.split(',')[0]}`) // Show only first part of address in popup
                .openPopup(); // Open popup immediately
            setOriginMarker(newOriginMarker); // Update state
            toast({ title: "Point de Départ Mis à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de destination." });

            // If destination marker already exists, calculate route
            if (destinationMarker) {
                console.log("Calculating route after origin set via click (destination exists)...");
                await calculateRoute(newOriginMarker, destinationMarker);
            }
         } catch (error: any) {
             console.error("Error adding origin marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Départ", description: `Impossible d'ajouter le marqueur de départ. ${error.message || ''}` });
             setClickMode('none'); // Reset on error
         }


     } else if (clickMode === 'destination') {
         if (!destinationIcon) {
            console.error("Destination icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de destination n'a pas pu être chargée." });
            setClickMode('none'); // Reset click mode
            return;
        }
       console.log("Setting Destination...");
        // Remove previous destination marker
        if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
            console.log("Removing previous destination marker.");
             try { currentMap.removeLayer(destinationMarker); } catch (error) { console.warn("Error removing destination marker:", error); }
        }
        // Remove route line if destination changes
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because destination changed.");
             try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
            setRouteLine(null); // Reset route line state
        }

       setDestination(address); // Set destination input field

         try {
             console.log("Adding new destination marker.");
             const newDestinationMarker = L.marker([latLng.lat, latLng.lng], { icon: destinationIcon })
               .addTo(currentMap)
               .bindPopup(`Destination: ${address.split(',')[0]}`)
               .openPopup();
             setDestinationMarker(newDestinationMarker);
             toast({ title: "Destination Mise à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de départ." });

             // If origin marker exists, calculate route
              if (originMarker) {
                   console.log("Calculating route after destination set via click...");
                   await calculateRoute(originMarker, newDestinationMarker);
              }
         } catch (error: any) {
             console.error("Error adding destination marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Destination", description: `Impossible d'ajouter le marqueur de destination. ${error.message || ''}` });
              setClickMode('none'); // Reset on error
         }

     } else {
         // Should not happen if clickMode is managed correctly
         console.warn("Map clicked but clickMode was neither 'origin' nor 'destination'. Mode:", clickMode);
         setClickMode('none'); // Reset to safe state
     }
     // Optionally, reset clickMode to 'none' after a successful pick,
     // or keep it active for quick re-picking. Current behavior keeps it active.
     // setClickMode('none');
   }, [clickMode, originMarker, destinationMarker, routeLine, toast, calculateRoute, mapLoaded]); // mapLoaded is a dependency


  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || !document.getElementById('map') || mapRef.current || mapLoaded) { // Check mapLoaded
        console.log("Map initialization skipped:", { hasWindow: typeof window !== 'undefined', mapElementExists: !!document.getElementById('map'), mapRefExists: !!mapRef.current, mapAlreadyLoaded: mapLoaded });
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

        // Use requestAnimationFrame to ensure invalidateSize runs after the DOM is ready
        requestAnimationFrame(() => {
            if (mapRef.current) {
                console.log("Calling map.invalidateSize() via requestAnimationFrame...");
                mapRef.current.invalidateSize();
                console.log("map.invalidateSize() called.");
                setMapLoaded(true); // Set map loaded state AFTER invalidateSize
                console.log("Map initialized and loaded state set AFTER invalidateSize.");
            }
        });


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

        // Show GPS dialog immediately if permission is undetermined
        if (hasGpsPermission === null) {
            console.log("Initial GPS permission state is undetermined, showing dialog.");
            setIsGpsDialogOpen(true); // Show dialog to ask for permission
        } else if (hasGpsPermission === false) {
            // User previously denied. They can re-attempt via the GPS button or manual settings.
            // No automatic dialog here to avoid being intrusive.
            console.log("GPS permission was previously denied. User might need to enable manually or re-prompt via button.");
        } else {
             // GPS permission was previously granted, but don't automatically get location.
             // User should explicitly click the GPS button or pick on map.
             console.log("GPS permission was previously granted. User can use GPS button or pick on map.");
        }


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
           // Also check if the map element still exists in the DOM
           const mapElement = document.getElementById('map');
           if (mapElement && currentMap.getContainer() && mapElement === currentMap.getContainer()) {
                console.log("Removing map instance...");
                currentMap.remove(); // Remove map instance from the DOM
                console.log("Map instance removed.");
           } else {
                console.log("Map container already removed, detached, or element not found, skipping map.remove().");
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
  }, [toast, handleMapClick]); // handleMapClick is now a dependency due to useCallback, mapLoaded added
  // hasGpsPermission and mapLoaded were removed to prevent re-initialization loop.
  // The dialog is now shown based on initial hasGpsPermission state.


  // Check GPS permission status (but don't trigger browser prompt yet)
  const checkGpsPermission = async (promptIfUndetermined = false) => {
      console.log(`Checking GPS permission. Prompt if undetermined: ${promptIfUndetermined}`);
      if (!navigator.geolocation) {
           console.warn("Geolocation API not supported by this browser.");
          setHasGpsPermission(false); // Set to false if not supported
          setIsGpsDialogOpen(true); // Show dialog to inform user
          return false; // Indicate failure
      }

       try {
           const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
           console.log(`Current GPS permission state: ${permissionStatus.state}`);
           
           if (permissionStatus.state === 'granted') {
               setHasGpsPermission(true);
               return true;
           } else if (permissionStatus.state === 'denied') {
               setHasGpsPermission(false);
               setIsGpsDialogOpen(true); // Show dialog if explicitly denied, user might need to unblock
               return false;
           } else if (permissionStatus.state === 'prompt' && promptIfUndetermined) {
                // We want to prompt via our dialog first if it's undetermined
                setIsGpsDialogOpen(true);
                // The actual browser prompt will be triggered by getCurrentLocationAndSetOrigin
                return false; // Wait for user interaction with dialog
           } else {
                // State is 'prompt' but we are not prompting now (e.g. initial load check)
                setHasGpsPermission(null); // Keep as undetermined for now
                return false;
           }

       } catch (error) {
           console.error("Error checking GPS permission:", error);
           setHasGpsPermission(false); // Assume false on error
           setIsGpsDialogOpen(true); // Show dialog on error
           return false;
       }
   };

   // Reset markers and route, but keep input field values
   const resetMapStateForNewOrigin = () => {
       console.log("Resetting map state (markers, route), keeping inputs.");
        if (!mapRef.current) return;
        const currentMap = mapRef.current;

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
    };


  // Get current location and set it as origin
  const getCurrentLocationAndSetOrigin = async () => {
      console.log("Attempting to get current location and set as origin...");
    if (!mapRef.current || !LRef.current || !originIcon) { // Use originIcon for consistency
        console.error("Cannot get location: Map, Leaflet, or origin icon not ready.", { mapReady: !!mapRef.current, LReady: !!LRef.current, iconReady: !!originIcon });
       toast({ variant: 'destructive', title: 'Erreur Carte/Icone', description: 'La carte ou l\'icône de départ n\'a pas pu être chargée.' });
       return;
    }
    const L = LRef.current;
    const currentMap = mapRef.current;

    const gpsToast = toast({ title: "Localisation en cours...", description: "Tentative de récupération de votre position GPS." });

    resetMapStateForNewOrigin(); // Clear existing markers and route

    try {
      console.log("Calling navigator.geolocation.getCurrentPosition...");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, // Request high accuracy
            timeout: 10000, // 10 seconds timeout
            maximumAge: 0 // Force fresh location
        });
      });
      console.log("Geolocation success:", position);
      setHasGpsPermission(true); // Permission was granted
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCurrentLocation(coords); // Store current location if needed elsewhere

       if (!originIcon) throw new Error("Origin icon became unavailable"); // Should be loaded by now

        let newMarker: L.Marker | null = null;
        try {
           console.log("Adding GPS location marker to map using originIcon.");
           newMarker = L.marker([coords.lat, coords.lng], { icon: originIcon }).addTo(currentMap);
           setOriginMarker(newMarker); // Set as the origin marker

            console.log("Reverse geocoding GPS coordinates...");
           const geocodeResult = await reverseGeocode(coords.lat, coords.lng);
           const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
           console.log("GPS Reverse Geocode Result:", address);

           newMarker.bindPopup(`Départ (Actuel): ${address.split(',')[0]}`).openPopup();
           setOrigin(address); // Update origin input field

           currentMap.setView([coords.lat, coords.lng], 15); // Center map on new location
           console.log("Setting click mode to 'none' after GPS success."); 
           setClickMode('none'); // Deactivate map click mode

            gpsToast.update({
                id: gpsToast.id,
                title: 'Position Actuelle Définie',
                description: `Départ: ${address}. Choisissez la destination.`, // Updated message
            });


            // If destination already exists, calculate route
            if (destinationMarker && newMarker) {
                console.log("Calculating route after GPS origin set (destination existed)...");
                await calculateRoute(newMarker, destinationMarker);
            }

        } catch (markerOrGeocodeError: any) {
             console.error('Error adding GPS marker or reverse geocoding:', markerOrGeocodeError);
             gpsToast.update({ id: gpsToast.id, variant: 'destructive', title: 'Erreur Affichage Position', description: `Impossible d'afficher ou de nommer votre position sur la carte. ${markerOrGeocodeError.message || ''}` });
             // Clean up failed marker
             if (newMarker && currentMap.hasLayer(newMarker)) {
                 try { currentMap.removeLayer(newMarker); } catch (removeError) { console.warn("Error removing failed GPS marker:", removeError); }
                 setOriginMarker(null);
             }
             setOrigin(`Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`); // Fallback to coords in input
              currentMap.setView([coords.lat, coords.lng], 15); // Still center map
             console.log("Setting click mode to 'none' after GPS marker error."); 
             setClickMode('none'); // Deactivate map click mode
        }


    } catch (error: any) {
      console.error('Error accessing GPS location:', error);
       setHasGpsPermission(false); // Set to false on error (e.g., denial)
       setCurrentLocation(null);

      let description = 'Une erreur s’est produite lors de la récupération de votre position.';
       if (error.code === error.PERMISSION_DENIED) {
           description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur pour utiliser cette fonction.';
           setIsGpsDialogOpen(true); // Re-show dialog if denied by browser
       } else if (error.code === error.POSITION_UNAVAILABLE) {
           description = 'Votre position actuelle n’est pas disponible. Vérifiez vos paramètres de localisation.';
           setIsGpsDialogOpen(true); // Re-show dialog if unavailable
       } else if (error.code === error.TIMEOUT) {
           description = 'La demande de géolocalisation a expiré. Veuillez réessayer.';
       }

       gpsToast.update({
           id: gpsToast.id,
           variant: 'destructive',
           title: 'Erreur GPS',
           description: description,
       });
    }
  };


    // Reset entire map state including inputs and view
    const resetFullMap = () => {
        console.log("Resetting full map state: inputs, markers, route, view.");
        const currentMap = mapRef.current;
        if (currentMap && LRef.current) {
           resetMapStateForNewOrigin(); // Clears markers and route
           setOrigin(''); // Clear origin input
           setDestination(''); // Clear destination input
           currentMap.setView([defaultLocation.lat, defaultLocation.lng], 10); // Reset map view
           setClickMode('none'); // Deactivate click mode
           toast({ title: 'Carte Réinitialisée', description: 'Sélectionnez un nouveau point de départ.' });
        } else {
            console.warn("Cannot reset full map: Map not ready.");
            toast({ variant: 'destructive', title: 'Carte non prête' });
        }
      };


   // Focus input and set map click mode
   const handleFocusInputAndSetMode = (ref: React.RefObject<HTMLInputElement>, mode: 'origin' | 'destination') => {
     if (ref.current) {
         console.log(`Setting click mode to '${mode}' and focusing input.`);
       // Scroll to input for better UX on mobile
       ref.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
       ref.current.focus(); // Focus the input field
       setClickMode(mode); // Set the map click mode
       toast({
           title: `Mode Sélection ${mode === 'origin' ? 'Départ' : 'Destination'} Activé`,
           description: `Cliquez sur la carte pour définir ${mode === 'origin' ? 'le point de départ' : 'la destination'}.`,
       });
     } else {
         console.warn(`Cannot focus input for mode '${mode}': Ref is null.`);
     }
   };

  // Handle click on "Use Current Location" (GPS icon)
  const handleUseCurrentLocation = async () => {
      console.log("'Use Current Location' button clicked.");
     if (!mapRef.current || !LRef.current) { // Check if map and Leaflet are ready
      console.warn("Cannot use current location: Map not ready.");
      toast({ variant: 'destructive', title: 'Carte non prête' });
      return;
    }
    
    // If permission is already denied, show the dialog to explain how to re-enable.
    // If undetermined, show dialog to ask for permission.
    // If granted, directly get location.
    if (hasGpsPermission === false) {
        console.log("GPS permission previously denied. Showing dialog to re-prompt or explain.");
        setIsGpsDialogOpen(true); // This will guide the user
    } else if (hasGpsPermission === null) {
        console.log("GPS permission undetermined. Showing dialog to prompt.");
        setIsGpsDialogOpen(true); // This will ask for permission
    } else { // hasGpsPermission is true
        console.log("GPS permission already granted. Getting location...");
        await getCurrentLocationAndSetOrigin(); // Directly get location
    }
  };

   // Handle user's choice from the GPS permission dialog
   const handleGpsDialogAction = async (allow: boolean) => {
       console.log(`GPS Dialog action: ${allow ? 'Allow' : 'Deny'}`);
     setIsGpsDialogOpen(false); // Close dialog regardless of choice
     if (allow) {
       setHasGpsPermission(null); // Set to null to re-trigger browser permission request flow if needed
       console.log("User allowed via dialog. Attempting to get location (may trigger browser prompt)...");
       await getCurrentLocationAndSetOrigin(); // Attempt to get location, which will trigger browser prompt if needed
     } else {
       setHasGpsPermission(false); // User explicitly denied via our dialog
       console.log("User denied via dialog.");
       toast({
         title: 'GPS Non Activé',
         description: 'Vous pouvez spécifier votre position manuellement en cliquant sur la carte.',
       });
       // If user denies, activate manual origin selection mode
       console.log("Activating origin map click after GPS dialog denial.");
        handleFocusInputAndSetMode(originInputRef, 'origin');
     }
   };


   // Handle address search from input fields
   const handleAddressSearch = async (type: 'origin' | 'destination') => {
       console.log(`Handling address search for: ${type}`);
       const currentMap = mapRef.current;
       // Ensure map and icons are loaded before proceeding
       if (!currentMap || !LRef.current || !originIcon || !destinationIcon) {
            console.error("Cannot search address: Map, Leaflet, or icons not ready.", { mapReady: !!currentMap, LReady: !!LRef.current, iconsReady: !!originIcon && !!destinationIcon });
           toast({ variant: "destructive", title: "Carte non prête", description: "La carte ou ses composants ne sont pas encore initialisés." });
           return;
       }
       const L = LRef.current;
       const address = type === 'origin' ? origin : destination;

       // Basic validation for address input
       if (!address || address.trim().length < 3) {
           console.warn(`Address search validation failed for ${type}: "${address}"`);
           toast({ variant: 'destructive', title: 'Recherche invalide', description: 'Veuillez entrer une adresse plus complète (au moins 3 caractères).' });
           return;
       }

       const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Recherche de: ${address}` });

       const result = await geocodeAddress(address); // Geocode the entered address

       // Update toast based on geocoding result
       geocodeToast.update({
           id: geocodeToast.id,
           title: result ? "Adresse trouvée" : "Adresse non trouvée",
           description: result ? result.displayName : `Impossible de localiser: ${address}`,
           variant: result ? 'default' : 'destructive'
       });

       if (result) {
           console.log(`Geocode successful for ${type}:`, result);
           const { lat, lng, displayName } = result;
           const iconToUse = type === 'origin' ? originIcon : destinationIcon;
           let markerRef = type === 'origin' ? originMarker : destinationMarker;
           const setMarkerState = type === 'origin' ? setOriginMarker : setDestinationMarker;
           const setAddressState = type === 'origin' ? setOrigin : setDestination;

           // Remove previous marker for this type
           if (markerRef && currentMap.hasLayer(markerRef)) {
               console.log(`Removing previous ${type} marker.`);
               try { currentMap.removeLayer(markerRef); } catch (error) { console.warn(`Error removing ${type} marker:`, error); }
           }
            // Remove route line if this point changes
            if (routeLine && currentMap.hasLayer(routeLine)) {
                console.log(`Removing route line because ${type} changed via search.`);
               try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
               setRouteLine(null); // Reset route line state
           }

           let newMarker: L.Marker | null = null;
           try {
                console.log(`Adding new ${type} marker at (${lat}, ${lng}).`);
                if (!iconToUse) throw new Error(`${type} icon is not loaded`); // Should not happen due to initial check, but safe
                newMarker = L.marker([lat, lng], { icon: iconToUse })
                   .addTo(currentMap)
                   .bindPopup(`${type === 'origin' ? 'Départ' : 'Destination'}: ${displayName.split(',')[0]}`)
                   .openPopup();

               setMarkerState(newMarker); // Update state with new marker
               setAddressState(displayName); // Update input field with full display name

               currentMap.setView([lat, lng], 15); // Center map on new marker

               // Check if the other marker exists to determine next action
               const otherMarkerExists = type === 'origin' ? !!destinationMarker : !!originMarker;
               if (!otherMarkerExists) {
                    // If the other point isn't set, activate its selection mode
                    const nextMode = type === 'origin' ? 'destination' : 'origin';
                    console.log(`Setting click mode to '${nextMode}' after ${type} search.`);
                    setClickMode(nextMode);
                    toast({ title: `${type === 'origin' ? 'Point de Départ' : 'Destination'} Trouvé`, description: `Sélectionnez maintenant ${nextMode === 'origin' ? 'le point de départ' : 'la destination'} sur la carte ou via la recherche.`});
               } else {
                   // If both points exist, deactivate click mode
                   console.log(`Deactivating click mode after ${type} search (both points exist).`);
                   setClickMode('none');
               }


                // If both markers are now set, calculate route
                const currentOriginMarker = type === 'origin' ? newMarker : originMarker;
                const currentDestinationMarker = type === 'destination' ? newMarker : destinationMarker;
                 if (currentOriginMarker && currentDestinationMarker) {
                     console.log(`Calculating route after ${type} search (both markers exist).`);
                     await calculateRoute(currentOriginMarker, currentDestinationMarker);
                 }

           } catch (error: any) {
               console.error(`Error adding marker for ${type} search:`, error);
               toast({ variant: 'destructive', title: `Erreur Marqueur ${type === 'origin' ? 'Départ' : 'Destination'}`, description: `Impossible d'ajouter le marqueur pour ${address}. ${error.message || ''}` });
               // Clean up failed marker
               if (newMarker && currentMap.hasLayer(newMarker)) {
                    try { currentMap.removeLayer(newMarker); } catch (removeError) { console.warn("Error removing failed search marker:", removeError); }
               }
               setMarkerState(null); // Reset marker state on error
               setClickMode('none'); // Reset click mode
           }

       } else {
            console.warn(`Address search failed for ${type}: "${address}"`);
            // Optionally, clear the input or provide more feedback
       }
    };



  return (
    <TooltipProvider delayDuration={100}> {/* Reduced delay for faster tooltips */}
      <div>
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4" />

        {/* Global styles for Leaflet icons and map container */}
        <style jsx global>{`
          /* Reset default Leaflet divIcon styles for Lucide icons */
          .leaflet-lucide-icon {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            line-height: 0; /* Important for proper alignment of SVG inside */
            margin: 0 !important; /* Reset margins */
            padding: 0 !important; /* Reset paddings */
          }
           /* Ensure the container for the divIcon itself has no background/border */
           .leaflet-marker-icon.leaflet-div-icon {
             background: none;
             border: none;
             padding: 0;
             margin: 0;
             box-shadow: none;
             /* Allow Lucide icon to define size */
             width: auto !important;
             height: auto !important;
           }
           /* Adjust line-height if the Lucide icon component has its own wrapper */
           .leaflet-marker-icon .leaflet-lucide-icon div {
              line-height: normal; /* Or whatever is appropriate for Lucide */
           }
            /* Ensure map container is visible and has dimensions */
            #map {
              min-height: 400px; /* Fallback if style prop doesn't apply */
              background-color: #eee; /* Fallback background for map loading */
              z-index: 0; /* Ensure map is not overlapped by absolutely positioned elements unintentionally */
              position: relative; /* Needed for z-index to work */
            }
            #map.leaflet-container {
                cursor: crosshair !important; /* Ensure crosshair cursor always applies */
            }
            /* Ensure map container is visible and has dimensions */
            .leaflet-container {
                width: 100%;
                height: 400px; /* Ensure this matches mapContainerStyle height */
                visibility: visible; /* Explicitly set visibility */
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
                    value={origin} // Controlled component
                    onChange={(e) => setOrigin(e.target.value)} // Update state on change
                    ref={originInputRef} // Ref for focusing
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('origin')} // Trigger search on Enter
                    aria-label="Adresse de ramassage"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    {/* Search button */}
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
                    {/* Pick on Map button */}
                     <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                           onClick={() => handleFocusInputAndSetMode(originInputRef, 'origin')}
                          aria-label="Choisir l'adresse de ramassage sur la carte"
                           className={clickMode === 'origin' ? 'text-primary ring-2 ring-primary rounded-full' : ''} // Highlight if active
                        >
                          <MapPin className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Activer la sélection du point de départ sur la carte ({clickMode === 'origin' ? 'Actif' : 'Inactif'})
                      </TooltipContent>
                    </Tooltip>
                    {/* Use GPS button */}
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
                    value={destination} // Controlled component
                    onChange={(e) => setDestination(e.target.value)} // Update state on change
                    ref={destinationInputRef} // Ref for focusing
                     onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')} // Trigger search on Enter
                     aria-label="Adresse de destination"
                  />
                   <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    {/* Search button */}
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
                    {/* Pick on Map button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleFocusInputAndSetMode(destinationInputRef, 'destination')}
                           aria-label="Choisir l'adresse de destination sur la carte"
                           className={clickMode === 'destination' ? 'text-primary ring-2 ring-primary rounded-full' : ''} // Highlight if active
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

            {/* Right side: Alerts and Information */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
              {/* GPS Permission Alerts */}
              {hasGpsPermission === false && !isGpsDialogOpen && ( // Show if denied AND dialog is closed
                <Alert variant="destructive">
                  <Locate className="h-4 w-4" />
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
               {hasGpsPermission === null && !isGpsDialogOpen && ( // Show if undetermined AND dialog is closed
                 <Alert>
                    <Locate className="h-4 w-4" />
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
                {hasGpsPermission === true && currentLocation && ( // Show if granted AND location is set
                 <Alert variant="default" className="border-green-500"> {/* Custom styling for success */}
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

          {/* Delivery Options - Show only if route is calculated */}
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
          <AlertDialog open={isGpsDialogOpen} onOpenChange={(open) => {
              // If dialog is closed by clicking outside or pressing Esc,
              // and permission is still undetermined, treat it as "specify manually" for now.
              if (!open && hasGpsPermission === null) {
                  console.log("GPS Dialog closed without explicit choice, defaulting to manual.");
                  handleGpsDialogAction(false); // Treat as "No, specify manually"
              } else {
                  setIsGpsDialogOpen(open); // Standard open/close behavior
              }
          }}>
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
