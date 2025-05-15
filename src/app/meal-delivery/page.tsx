
'use client'; // This directive should be the first non-comment line

import React, {useState, useRef, useEffect, useCallback} from 'react';
import 'leaflet/dist/leaflet.css';
import ReactDOMServer from 'react-dom/server';
import type L from 'leaflet'; // Import L type

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useToast} from '@/hooks/use-toast';
import {Locate, MapPin, Search, Pin, PinOff} from 'lucide-react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
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


const mapContainerStyle = {
  width: '100%',
  height: '400px', // Ensure map has a defined height
  cursor: 'crosshair' // Default cursor for map
};

const defaultLocation = { // Default to a location in Morocco
  lat: 31.7917,
  lng: -7.0926,
};

// Store Leaflet library and icon instances
let LRefGlobal: typeof import('leaflet') | null = null;
let originIconInstance: L.DivIcon | undefined;
let destinationIconInstance: L.DivIcon | undefined;
let currentPositionIconInstance: L.DivIcon | undefined;


const createLucideIcon = (IconComponent: React.ElementType, colorClass = 'text-primary', size = 6): L.DivIcon | undefined => {
  if (!LRefGlobal) {
    console.error("Leaflet (LRefGlobal) is not loaded. Cannot create icon.");
    return undefined;
  }
  const iconHtml = ReactDOMServer.renderToStaticMarkup(
    // Added a wrapper div with relative positioning and a slight bottom adjustment
    // This helps with vertical alignment of the icon within the marker.
    React.createElement('div', { style: { display: 'inline-block', position: 'relative', bottom: '-3px' } },
      React.createElement(IconComponent, { className: `h-${size} w-${size} ${colorClass}` })
    )
  );
  const iconSizeValue = size * 4; // Adjust size as needed, e.g., size * 4
  return LRefGlobal.divIcon({
    html: iconHtml,
    className: 'leaflet-lucide-icon', // Keep this class for potential global styling
    iconSize: [iconSizeValue, iconSizeValue], // Leaflet expects [width, height]
    iconAnchor: [iconSizeValue / 2, iconSizeValue], // Anchor point (bottom center of the icon)
    popupAnchor: [0, -iconSizeValue] // Popup anchor relative to iconAnchor
  });
};

async function reverseGeocode(lat: number, lng: number): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr&addressdetails=1`;
  console.log(`Reverse geocoding for: ${lat}, ${lng}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MapYOO Web Client/1.0 (contact@mapyoo.com)',
      },
    });
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Reverse Geocode Raw Result:", data);

    let displayName = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback display name

    if (data && data.address) {
        const address = data.address;
        // Construct a more readable address. Order might need adjustment based on typical local formats.
        const parts = [
            address.road || address.footway || address.pedestrian, // Street name
            address.neighbourhood || address.suburb,            // Neighborhood or suburb
            address.city || address.town || address.village || address.hamlet, // City/Town/Village
            address.state || address.county || address.region, // State/County/Region
            address.postcode,                                   // Postal code
            address.country,                                    // Country
        ].filter(Boolean); // Filter out undefined/null parts

        if (parts.length > 0) {
            displayName = parts.join(', ');
        } else if (data.display_name) { // Fallback to Nominatim's display_name if address parts are sparse
             // Take first 3 parts of display_name as a concise fallback
             displayName = data.display_name.split(',').slice(0, 3).join(',');
        }
       console.log("Formatted Address:", displayName);
    } else {
       console.warn("Reverse geocode: No address details found in response. Using raw display_name or coordinates.");
        if (data.display_name) { // If address object is missing, but display_name exists
            displayName = data.display_name.split(',').slice(0, 3).join(',');
        }
    }

      // Return Nominatim's lat/lon if available, otherwise the input lat/lon
      return {
        lat: parseFloat(data.lat) || lat,
        lng: parseFloat(data.lon) || lng,
        displayName: displayName,
      };

  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    // Fallback to coordinates string on error
    const coordsStr = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { lat: lat, lng: lng, displayName: coordsStr };
  }
}


async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  // Prioritize Morocco (ma) in search, allow other countries if not found in MA.
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=jsonv2&limit=1&accept-language=fr&countrycodes=ma&addressdetails=1`;
  console.log(`Geocoding address: ${address}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MapYOO Web Client/1.0 (contact@mapyoo.com)',
      },
    });
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Geocode Raw Result:", data);

    if (data && data.length > 0) {
        const result = data[0]; // Take the first result
        let displayName = `Coordonnées: ${parseFloat(result.lat).toFixed(5)}, ${parseFloat(result.lon).toFixed(5)}`; // Fallback

        if (result.address) {
            const addressDetails = result.address;
            const parts = [
                addressDetails.road || addressDetails.footway || addressDetails.pedestrian,
                addressDetails.neighbourhood || addressDetails.suburb,
                addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.hamlet,
                addressDetails.state || addressDetails.county || addressDetails.region,
                addressDetails.postcode,
                addressDetails.country,
            ].filter(Boolean); // Filter out undefined/null parts

             if (parts.length > 0) {
                displayName = parts.join(', ');
            } else if (result.display_name) { // Fallback to Nominatim's display_name
                 displayName = result.display_name.split(',').slice(0, 3).join(',');
            }
        } else if (result.display_name) { // If no address object, use display_name
             displayName = result.display_name.split(',').slice(0, 3).join(',');
        }

       console.log("Formatted Address from Geocode:", displayName);

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: displayName, // Use the formatted or fallback display name
      };
    } else {
      console.warn(`Geocode: Address not found for "${address}"`);
      return null;
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
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null); // null = unknown, true = granted, false = denied/unavailable
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false); // Initially false, shown on first GPS attempt or if needed
  const mapRef = useRef<L.Map | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [routeLine, setRouteLine] = useState<L.Polyline | null>(null); // Using L.Polyline for OSRM GeoJSON
  const [clickMode, setClickMode] = useState<'origin' | 'destination' | 'none'>('none');
  const [mapLoaded, setMapLoaded] = useState(false); // Track if map is fully initialized


   // Define calculateRoute first so handleMapClick can use it
   const calculateRoute = useCallback(async (currentOriginParam?: L.Marker | null, currentDestinationParam?: L.Marker | null) => {
      const originToUse = currentOriginParam ?? originMarker;
      const destinationToUse = currentDestinationParam ?? destinationMarker;
      const currentMap = mapRef.current;


       if (!LRefGlobal || !currentMap || !originToUse || !destinationToUse) {
           console.warn("Calculate route skipped: Missing map, leaflet, or markers.", { hasMap: !!currentMap, hasL: !!LRefGlobal, hasOrigin: !!originToUse, hasDest: !!destinationToUse });
           toast({
               variant: 'default',
               title: 'Information Manquante',
               description: 'Veuillez définir un point de départ ET de destination sur la carte ou via la recherche.',
           });
           return;
       }
       const L = LRefGlobal;


       const originCoords = originToUse.getLatLng();
       const destinationCoords = destinationToUse.getLatLng();
       console.log(`Calculating route from (${originCoords.lat}, ${originCoords.lng}) to (${destinationCoords.lng}, ${destinationCoords.lat})`); // Corrected destination log


       const routeToast = toast({ title: "Calcul de l'itinéraire..." });


       try {
           // OSRM expects {lon},{lat};{lon},{lat}
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
                const geoJson = route.geometry; // This is already a GeoJSON geometry object
                const distanceKm = (route.distance / 1000).toFixed(2); // Distance in km
                const durationMinutes = Math.round(route.duration / 60); // Duration in minutes


                // Check map instance and layer existence before removing
                if (routeLine && currentMap.hasLayer(routeLine)) {
                    console.log("Removing existing route line.");
                    currentMap.removeLayer(routeLine);
                }


                 console.log("Adding new route line.");
                const newRouteLine = L.geoJSON(geoJson, {
                    style: { color: 'hsl(var(--primary))', weight: 5 }, // Teal color for route
                }).addTo(currentMap);


                newRouteLine.bindPopup(`Distance: ${distanceKm} km<br>Durée: ~${durationMinutes} min`);
                setRouteLine(newRouteLine as L.Polyline); // Cast to L.Polyline if needed for type safety elsewhere


                currentMap.fitBounds(newRouteLine.getBounds());


                // Close marker popups if open to avoid overlap with route info
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
       }
   }, [originMarker, destinationMarker, routeLine, toast]);


   // Define handleMapClick within the component scope, wrapped in useCallback
   const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
     console.log("Map clicked, current mode:", clickMode);
     const currentMap = mapRef.current;
     if (!mapLoaded || !LRefGlobal || !currentMap || clickMode === 'none') {
       if (clickMode === 'none') {
            toast({ variant: 'default', title: 'Mode Sélection Inactif', description: "Cliquez sur l'icône 'Choisir sur la carte' (📍) près d'un champ d'adresse pour activer la sélection." });
       } else {
           console.warn("Map click ignored: Map not loaded or ready.", { mapLoaded, LRefGlobal: !!LRefGlobal, mapRef: !!currentMap });
            toast({ variant: 'destructive', title: 'Carte non prête' });
       }
       return;
     }
     const L = LRefGlobal; // Safe to use L here

     const latLng = e.latlng;
     console.log("Clicked Coords:", latLng);

     // Show loading toast for reverse geocoding
     const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Lat: ${latLng.lat.toFixed(5)}, Lng: ${latLng.lng.toFixed(5)}` });
     const geocodeResult = await reverseGeocode(latLng.lat, latLng.lng);

     // Use Nominatim's returned lat/lng if available, otherwise the clicked lat/lng
     const finalLatLng = geocodeResult ? new L.LatLng(geocodeResult.lat, geocodeResult.lng) : latLng;
     const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`;

     // Update toast with geocoding result
      geocodeToast.update({
        id: geocodeToast.id,
        title: geocodeResult ? "Adresse trouvée" : "Adresse générique (coordonnées)",
        description: address,
        variant: geocodeResult ? 'default' : 'destructive' // 'destructive' if geocoding failed to find a proper address
      });


     if (clickMode === 'origin') {
        if (!originIconInstance) {
            console.error("Origin icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de départ n'a pas pu être chargée." });
            return;
        }
        console.log("Setting Origin...");
        // Remove previous origin marker if it exists
        if (originMarker && currentMap.hasLayer(originMarker)) {
            console.log("Removing previous origin marker.");
            currentMap.removeLayer(originMarker);
        }
        // Remove route line if origin changes
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because origin changed.");
             currentMap.removeLayer(routeLine);
            setRouteLine(null); // Clear routeLine state
        }

        setOrigin(address); // Update input field

         try {
            console.log("Adding new origin marker.");
            const newOriginMarker = L.marker([finalLatLng.lat, finalLatLng.lng], { icon: originIconInstance })
                .addTo(currentMap)
                .bindPopup(`Départ: ${address.split(',')[0]}`) // Show first part of address as popup
                .openPopup();
            setOriginMarker(newOriginMarker);
            currentMap.setView([finalLatLng.lat, finalLatLng.lng], 15); // Zoom to the new marker
            toast({ title: "Point de Départ Mis à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de destination." }); // Inform user

            // If destination exists, calculate route
            if (destinationMarker) {
                console.log("Calculating route after origin set via click (destination exists)...");
                await calculateRoute(newOriginMarker, destinationMarker);
            }
         } catch (error: any) {
             console.error("Error adding origin marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Départ", description: `Impossible d'ajouter le marqueur de départ. ${error.message || ''}` });
         }


     } else if (clickMode === 'destination') {
         if (!destinationIconInstance) {
            console.error("Destination icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de destination n'a pas pu être chargée." });
            return;
        }
       console.log("Setting Destination...");
        // Remove previous destination marker
        if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
            console.log("Removing previous destination marker.");
            currentMap.removeLayer(destinationMarker);
        }
        // Remove route line if destination changes
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because destination changed.");
             currentMap.removeLayer(routeLine);
            setRouteLine(null);
        }

       setDestination(address); // Update input field

         try {
             console.log("Adding new destination marker.");
             const newDestinationMarker = L.marker([finalLatLng.lat, finalLatLng.lng], { icon: destinationIconInstance })
               .addTo(currentMap)
               .bindPopup(`Destination: ${address.split(',')[0]}`)
               .openPopup();
             setDestinationMarker(newDestinationMarker);
             currentMap.setView([finalLatLng.lat, finalLatLng.lng], 15);
             toast({ title: "Destination Mise à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de départ." });

              // If origin exists, calculate route
              if (originMarker) {
                   console.log("Calculating route after destination set via click...");
                   await calculateRoute(originMarker, newDestinationMarker);
              }
         } catch (error: any) {
             console.error("Error adding destination marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Destination", description: `Impossible d'ajouter le marqueur de destination. ${error.message || ''}` });
         }
     }
     // clickMode remains active for adjustments, as per user requirement.
   }, [clickMode, originMarker, destinationMarker, routeLine, toast, calculateRoute, mapLoaded]);


   // Function to check GPS permission status
   const checkGpsPermission = useCallback(async (promptUserIfNeeded = true) => {
        console.log(`Checking GPS permission. Prompt if needed: ${promptUserIfNeeded}`);
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                console.log("GPS Permission Status:", permissionStatus.state);
                if (permissionStatus.state === 'granted') {
                    setHasGpsPermission(true);
                    // Don't show dialog if already granted AND we are not in an explicit prompt phase
                    if (isGpsDialogOpen && promptUserIfNeeded) setIsGpsDialogOpen(false);
                    return true;
                } else if (permissionStatus.state === 'prompt') {
                    setHasGpsPermission(null); // Unknown
                    if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true); // Show dialog if unknown and user needs prompt
                    return null;
                } else { // 'denied'
                    setHasGpsPermission(false);
                    if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true); // Show dialog if denied and user needs prompt
                    return false;
                }
            } catch (error) { // Error querying permission (e.g., browser doesn't fully support it)
                console.error("Error checking GPS permission:", error);
                setHasGpsPermission(false); // Assume denied or unavailable on error
                if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true);
                return false;
            }
        } else { // navigator.permissions API not available (older browsers)
            console.warn("Navigator.permissions API not available. Will rely on direct geolocation attempt.");
            setHasGpsPermission(null); // Treat as unknown
            // For older browsers, we might directly try getCurrentPosition which will prompt
            // Or, if we always want the dialog first:
            if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true);
            return null;
        }
    }, [isGpsDialogOpen]); // isGpsDialogOpen is a dependency to prevent re-opening if already open

    // Handles user response from the GPS permission dialog
    const handleGpsPermissionResponse = useCallback(async (granted: boolean, fieldTypeToSet: 'origin' | 'destination' = 'origin') => {
        setIsGpsDialogOpen(false); // Close dialog regardless of choice
        if (granted) {
            setHasGpsPermission(true); // User explicitly granted via our dialog flow
            toast({ title: 'Activation GPS demandée...', description: 'Tentative de récupération de votre position.' });
            await getCurrentLocationAndSetField(fieldTypeToSet);
        } else {
            setHasGpsPermission(false); // Explicitly set to false if user chose "Non"
            toast({ title: 'GPS Non Activé', description: 'Vous pouvez définir votre position manuellement.' });
        }
        // Ensure map resizes correctly if dialog was covering it
        requestAnimationFrame(() => mapRef.current?.invalidateSize());
    }, [toast]); // Removed getCurrentLocationAndSetField from deps, handle it via hasGpsPermission effect


  useEffect(() => {
    const initializeMap = async () => {
      // If map already initialized by this ref, or no window/document, skip.
      if (typeof window === 'undefined' || !document.getElementById('map') || mapRef.current) {
        if (mapRef.current && !mapLoaded) { // If ref exists but mapLoaded is false, maybe it needs invalidation
             console.log("Map ref exists but not marked as loaded. Attempting invalidateSize.");
             requestAnimationFrame(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize();
                    setMapLoaded(true); // Mark as loaded after this attempt
                }
            });
        } else {
            console.log("Map initialization skipped:", {
                hasWindow: typeof window !== 'undefined',
                mapElementExists: !!document.getElementById('map'),
                mapRefExists: !!mapRef.current,
             });
        }
        return;
      }

      try {
        console.log("Initializing map...");
        const L_module = (await import('leaflet')).default;
        LRefGlobal = L_module;

        console.log("Creating Lucide icons for Leaflet...");
        originIconInstance = createLucideIcon(Pin, 'text-blue-600', 8);
        destinationIconInstance = createLucideIcon(PinOff, 'text-green-600', 8);
        currentPositionIconInstance = createLucideIcon(Locate, 'text-red-600', 8);
         if (!originIconInstance || !destinationIconInstance || !currentPositionIconInstance) {
          console.error("Failed to create one or more Leaflet icons.");
          toast({ variant: 'destructive', title: 'Erreur Icone Carte', description: "Impossible de charger les icônes pour la carte." });
        } else {
             console.log("Leaflet icons created successfully.");
        }

        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error("Map element not found after dynamic import of Leaflet.");
            toast({ variant: 'destructive', title: 'Erreur Carte', description: "Conteneur de carte introuvable." });
            return;
        }

        // Ensure mapElement has dimensions before initializing Leaflet map
        // This check might be redundant if mapContainerStyle guarantees height, but good for safety
        if (mapElement.offsetHeight === 0 || mapElement.offsetWidth === 0) {
             console.warn("Map element has no dimensions prior to Leaflet init. Delaying slightly.");
             // Wait a tick for layout
             await new Promise(resolve => setTimeout(resolve, 0));
             if (mapElement.offsetHeight === 0 || mapElement.offsetWidth === 0) {
                 console.error("Map element still has no dimensions. Leaflet might fail.");
                 toast({ variant: 'destructive', title: 'Erreur Carte', description: "Le conteneur de la carte n'a pas de dimensions."});
             }
        }


        const map = LRefGlobal.map(mapElement, {
          center: [defaultLocation.lat, defaultLocation.lng],
          zoom: 6, // Start with a broader view of Morocco
          doubleClickZoom: false,
          closePopupOnClick: true,
          attributionControl: false,
        });
         console.log("Leaflet map instance created.");

        LRefGlobal.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
         console.log("Tile layer added.");

        LRefGlobal.control.attribution({ position: 'bottomright', prefix: '' }).addTo(map);
         console.log("Attribution control added.");

        mapRef.current = map; // Assign map instance to ref


        // Attach the click listener here
        map.on('click', handleMapClick);
        console.log("Map 'click' listener attached during initialization.");

        setMapLoaded(true); // Set map loaded state true
        console.log("mapLoaded state set to true.");


        // Use requestAnimationFrame to ensure invalidateSize runs after the DOM is ready
        // and potentially after mapLoaded state has caused CSS to make container visible.
        requestAnimationFrame(() => {
            if (mapRef.current) {
                console.log("Calling map.invalidateSize() via requestAnimationFrame...");
                mapRef.current.invalidateSize();
                console.log("map.invalidateSize() called after mapLoaded=true and rAF.");
            }
        });

        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = 'crosshair';
           console.log("Map container cursor set to crosshair.");
        }

        // Initial check for GPS permission - show dialog if needed
        checkGpsPermission(true);
        console.log("Initial GPS permission check (with prompt if needed) performed.");


      } catch (error) {
        console.error('Failed to load Leaflet or initialize map:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur de carte',
          description: 'Impossible de charger la carte. Veuillez réessayer plus tard.',
        });
      }
    };
    initializeMap(); // Call the async function

    // Cleanup function
    const cleanup = () => {
      console.log("Cleaning up map...");
      const currentMapInstance = mapRef.current;
      if (currentMapInstance) {
         console.log("Map instance found for cleanup.");
         try {
           // Remove event listeners first
           if (currentMapInstance.hasEventListeners('click')) {
               currentMapInstance.off('click', handleMapClick);
               console.log("Map 'click' listener removed.");
           }


           const mapElement = document.getElementById('map');
           if (mapElement && currentMapInstance.getContainer() && mapElement === currentMapInstance.getContainer()) {
                console.log("Removing map instance...");
                currentMapInstance.remove();
                console.log("Map instance removed.");
           } else {
                console.log("Map container already removed or not found, skipping map.remove().");
           }
         } catch (e) {
           console.warn("Error during map cleanup:", e);
         } finally {
           mapRef.current = null;
           console.log("Map ref cleared.");
         }
      } else {
         console.log("No map instance found in ref for cleanup.");
      }
      LRefGlobal = null;
      originIconInstance = undefined;
      destinationIconInstance = undefined;
      currentPositionIconInstance = undefined;
      setMapLoaded(false);
      console.log("Map cleanup complete.");
    };
    // Return the cleanup function to be called on component unmount
    return cleanup;
  }, [toast, checkGpsPermission, handleMapClick]); // Minimal stable dependencies


   const resetMapStateForNewField = (fieldType: 'origin' | 'destination') => {
       console.log(`Resetting map state for new ${fieldType} selection.`);
        const currentMap = mapRef.current;
        if (!currentMap || !LRefGlobal) return;

        if (fieldType === 'origin') {
            if (originMarker && currentMap.hasLayer(originMarker)) {
                currentMap.removeLayer(originMarker);
            }
            setOriginMarker(null);
            // Do not clear origin input here, user might be adjusting
        } else { // destination
            if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
                currentMap.removeLayer(destinationMarker);
            }
            setDestinationMarker(null);
            // Do not clear destination input here
        }

        // Clear route if either point is being reset for a new selection method
        if (routeLine && currentMap.hasLayer(routeLine)) {
            currentMap.removeLayer(routeLine);
            setRouteLine(null);
        }
    };


  // Function to get current location and set it for origin or destination
  const getCurrentLocationAndSetField = async (fieldType: 'origin' | 'destination') => {
      console.log(`Attempting to get current location and set as ${fieldType}...`);
      setClickMode('none'); // Deactivate any map click mode

      const currentMap = mapRef.current;
      if (!currentMap || !LRefGlobal || !currentPositionIconInstance) {
          console.error("Cannot get location: Map, Leaflet, or currentPositionIconInstance not ready.");
          toast({ variant: 'destructive', title: 'Erreur Carte/Icone', description: 'La carte ou l\'icône de position actuelle n\'a pas pu être chargée.' });
          return;
      }
      const L = LRefGlobal;

      // Clear the specific marker and route before getting new location
      resetMapStateForNewField(fieldType);


      const gpsToastId = toast({ title: "Localisation en cours...", description: "Tentative de récupération de votre position GPS." });

      try {
          console.log("Calling navigator.geolocation.getCurrentPosition...");
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true, timeout: 10000, maximumAge: 0 // Get fresh location
              });
          });
          console.log("Geolocation success:", position);
          setHasGpsPermission(true); // Should already be true if dialog led here, but confirm
          setIsGpsDialogOpen(false); // Ensure dialog is closed


          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };


          const geocodeResult = await reverseGeocode(coords.lat, coords.lng);
          const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
          console.log(`GPS Reverse Geocode Result for ${fieldType}:`, address);


          let newMarker: L.Marker | null = null;
          if (!currentPositionIconInstance) throw new Error("currentPositionIconInstance became unavailable");


          newMarker = L.marker([coords.lat, coords.lng], { icon: currentPositionIconInstance }).addTo(currentMap);


          if (fieldType === 'origin') {
              setOriginMarker(newMarker);
              setOrigin(address); // Update input field
              newMarker.bindPopup(`Départ (Actuel): ${address.split(',')[0]}`).openPopup();
          } else { // 'destination'
              setDestinationMarker(newMarker);
              setDestination(address); // Update input field
              newMarker.bindPopup(`Destination (Actuelle): ${address.split(',')[0]}`).openPopup();
          }


          currentMap.setView([coords.lat, coords.lng], 15); // Center map and zoom in
          gpsToastId.update({
              id: gpsToastId.id,
              title: `Position Actuelle Définie comme ${fieldType === 'origin' ? 'Départ' : 'Destination'}`,
              description: `${fieldType === 'origin' ? 'Départ' : 'Destination'}: ${address}.`,
          });


          // Check if both are now set (newMarker is the one just set)
           const currentOriginForRoute = fieldType === 'origin' ? newMarker : originMarker;
           const currentDestinationForRoute = fieldType === 'destination' ? newMarker : destinationMarker;


           if (currentOriginForRoute && currentDestinationForRoute) {
               await calculateRoute(currentOriginForRoute, currentDestinationForRoute);
           }


      } catch (error: any) { // Geolocation API error
          console.error(`Error accessing GPS location for ${fieldType}:`, error);
          let description = 'Une erreur s’est produite.';
          if (error.code === error.PERMISSION_DENIED) {
              description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur.';
              setHasGpsPermission(false); // Update permission state
          } else if (error.code === error.POSITION_UNAVAILABLE) {
              description = 'Votre position actuelle n’est pas disponible.';
          } else if (error.code === error.TIMEOUT) {
              description = 'La demande de géolocalisation a expiré.';
          } else if (error.message) { // Other errors
              description = error.message;
          }


          gpsToastId.update({
              id: gpsToastId.id,
              variant: 'destructive',
              title: error.code === error.PERMISSION_DENIED ? 'Accès GPS Refusé par Navigateur' : `Erreur GPS (${fieldType})`,
              description: description,
          });
           setIsGpsDialogOpen(false); // Ensure dialog closes on error too
      }
  };


    const resetFullMap = () => {
        console.log("Resetting full map state: inputs, markers, route, view.");
        const currentMap = mapRef.current;
        if (currentMap && LRefGlobal) {
           // Remove markers
           if (originMarker && currentMap.hasLayer(originMarker)) currentMap.removeLayer(originMarker);
           if (destinationMarker && currentMap.hasLayer(destinationMarker)) currentMap.removeLayer(destinationMarker);
           setOriginMarker(null);
           setDestinationMarker(null);

           // Remove route
           if (routeLine && currentMap.hasLayer(routeLine)) currentMap.removeLayer(routeLine);
           setRouteLine(null);

           // Clear inputs
           setOrigin('');
           setDestination('');

           // Reset view and click mode
           currentMap.setView([defaultLocation.lat, defaultLocation.lng], 6);
           setClickMode('none');
           toast({ title: 'Carte Réinitialisée', description: 'Sélectionnez un nouveau point de départ.' });
        } else {
            console.warn("Cannot reset full map: Map not ready.");
            toast({ variant: 'destructive', title: 'Carte non prête' });
        }
      };


   // Activates map click mode for origin or destination and focuses the input
   const handleFocusInputAndSetMode = (ref: React.RefObject<HTMLInputElement>, mode: 'origin' | 'destination') => {
     if (ref.current) {
         console.log(`Setting click mode to '${mode}' and focusing input.`);
       ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Scroll to input
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


  // Handles click on "Use Current Location" icon
  const handleUseLocationIconClick = async (fieldType: 'origin' | 'destination') => {
      console.log(`'Use Current Location' icon clicked for ${fieldType}.`);
      setClickMode('none'); // Always deactivate map click mode first
      if (!mapRef.current || !LRefGlobal) {
        console.warn("Cannot use current location: Map not ready.");
        toast({variant: "destructive", title: "Carte Non Prête", description: "La carte n'est pas encore initialisée."});
        return;
      }

      // Check current permission state
      if (hasGpsPermission === true) { // Already granted
          await getCurrentLocationAndSetField(fieldType);
      } else if (hasGpsPermission === false) { // Denied previously
          setIsGpsDialogOpen(true); // Re-open dialog to potentially guide to settings or re-request
      } else { // null (unknown/prompt state)
          // Check permission again, this time it WILL prompt if state is 'prompt'
          const permissionGranted = await checkGpsPermission(true);
          if (permissionGranted === true) { // Granted after this check
             await getCurrentLocationAndSetField(fieldType);
          } else if (permissionGranted === false) { // Denied after this check
             // Dialog should have been shown by checkGpsPermission if it was 'prompt' or 'denied'
             // If it's still false, it means user denied in browser or it's blocked
             toast({ variant: "destructive", title: "GPS Refusé", description: "Veuillez activer la localisation dans les paramètres de votre navigateur." });
          }
          // If permissionGranted is null, dialog is likely open or will be by checkGpsPermission
      }
  };


   // Handles address search from input fields
   const handleAddressSearch = async (type: 'origin' | 'destination') => {
       console.log(`Handling address search for: ${type}`);
       setClickMode('none'); // Deactivate map click mode
       const currentMap = mapRef.current;
       if (!currentMap || !LRefGlobal || !originIconInstance || !destinationIconInstance) {
            console.error("Cannot search address: Map, Leaflet, or icons not ready.");
           toast({ variant: "destructive", title: "Carte non prête", description: "La carte ou ses composants ne sont pas encore initialisés." });
           return;
       }
       const L = LRefGlobal;
       const address = type === 'origin' ? origin : destination;

       // Basic validation for address input
       if (!address || address.trim().length < 3) { // Require at least 3 chars for a search
           console.warn(`Address search validation failed for ${type}: "${address}"`);
           toast({ variant: 'destructive', title: 'Recherche invalide', description: 'Veuillez entrer une adresse plus complète (au moins 3 caractères).' });
           return;
       }

       const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Recherche de: ${address}` });
       const result = await geocodeAddress(address); // Perform geocoding

       geocodeToast.update({
           id: geocodeToast.id,
           title: result ? "Adresse trouvée" : "Adresse non trouvée",
           description: result ? result.displayName : `Impossible de localiser: ${address}`,
           variant: result ? 'default' : 'destructive'
       });

       if (result) {
           console.log(`Geocode successful for ${type}:`, result);
           const {lat, lng, displayName} = result;
            const iconToUse = type === 'origin' ? originIconInstance : destinationIconInstance;
           let currentMarkerRef = type === 'origin' ? originMarker : destinationMarker;
           const setMarkerState = type === 'origin' ? setOriginMarker : setDestinationMarker;
           const setAddressState = type === 'origin' ? setOrigin : setDestination;

           // Clear previous marker of this type and route
           resetMapStateForNewField(type);

           let newMarker: L.Marker | null = null;
           try {
                console.log(`Adding new ${type} marker at (${lat}, ${lng}).`);
                if (!iconToUse) throw new Error(`${type} icon is not loaded`); // Should not happen due to initial check, but safe
               newMarker = L.marker([lat, lng], { icon: iconToUse })
                   .addTo(currentMap)
                   .bindPopup(`${type === 'origin' ? 'Départ' : 'Destination'}: ${displayName.split(',')[0]}`)
                   .openPopup();

               setMarkerState(newMarker); // Update state with new marker
               setAddressState(displayName); // Update input field with formatted address

               currentMap.setView([lat, lng], 15); // Center map on new marker

                // If the other marker exists, calculate route
                const otherMarker = type === 'origin' ? destinationMarker : originMarker;
                 if (newMarker && otherMarker) {
                     console.log(`Calculating route after ${type} search (both markers exist).`);
                     await calculateRoute(type === 'origin' ? newMarker : originMarker, type === 'destination' ? newMarker : destinationMarker);
                 }

           } catch (error: any) {
               console.error(`Error adding marker for ${type} search:`, error);
               toast({ variant: 'destructive', title: `Erreur Marqueur ${type === 'origin' ? 'Départ' : 'Destination'}`, description: `Impossible d'ajouter le marqueur pour ${address}. ${error.message || ''}` });
               if (newMarker && currentMap.hasLayer(newMarker)) { currentMap.removeLayer(newMarker); } // Cleanup if marker add failed mid-way
               setMarkerState(null); // Reset marker state on error
           }
       } else {
            console.warn(`Address search failed for ${type}: "${address}"`);
            // Toast already updated by geocodeResult
       }
    };


  // When input field is focused, deactivate map click mode
  const handleInputFocus = () => {
    console.log("Input focused, deactivating clickMode.");
    setClickMode('none');
  };




  return (
    <TooltipProvider delayDuration={100}>
      <div>
        {/* The map container div */}
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4 bg-gray-200" />

        {/* Global styles for Leaflet icons and map container */}
        <style jsx global>{`
          /* Reset default Leaflet icon styles for custom Lucide icons */
          .leaflet-lucide-icon {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            line-height: 0; /* Important for aligning Lucide icons */
            margin: 0 !important; /* Reset margins */
            padding: 0 !important; /* Reset paddings */
          }
           /* Ensure div icons (which Lucide icons become) have no background/border */
           .leaflet-marker-icon.leaflet-div-icon {
             background: none;
             border: none;
             padding: 0;
             margin: 0;
             box-shadow: none;
             width: auto !important; /* Let content define width */
             height: auto !important; /* Let content define height */
           }
           /* Fine-tune line-height within the icon's inner div if needed */
           .leaflet-marker-icon .leaflet-lucide-icon div {
              line-height: normal; /* Or specific value if alignment issues persist */
           }

            /* Styles for the map container itself */
            #map {
              min-height: 400px; /* Ensure it always has a height */
              background-color: #f0f0f0; /* Default background if tiles don't load */
              z-index: 0; /* Ensure it's in the base stacking context */
              position: relative; /* Needed for potential overlays or absolute positioned children */
            }
            #map.leaflet-container { /* This class is added by Leaflet AFTER init */
                cursor: crosshair !important; /* Ensure crosshair cursor */
                background-color: #e5e3df; /* Leaflet's own map background color */
            }
            /* Removed dynamic visibility from .leaflet-container and .leaflet-tile-pane
               The #map div itself will be rendered, and Leaflet initializes into it.
               Loading states can be managed by overlaying a spinner on #map if !mapLoaded.
            */
            .leaflet-container {
                width: 100%;
                height: 400px;
            }
        `}</style>

        <div className="container mx-auto p-4 pt-2"> {/* Reduced top padding */}
          <h1 className="text-2xl font-semibold mb-4 text-center md:text-left">Livraison de Repas</h1>

          {/* Main layout: flex column on small, row on medium+ */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left Column: Address Inputs & Controls */}
            <div className="w-full md:w-1/2 space-y-4">
              {/* Origin Address */}
              <div className="mb-4">
                <label htmlFor="origin" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de ramassage
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="origin"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-32" // Padding right for icons
                    placeholder="Entrer l'adresse, utiliser le GPS, ou cliquer sur la carte"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    ref={originInputRef}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('origin')} // Search on Enter
                    onFocus={handleInputFocus} // Deactivate map click mode on focus
                    aria-label="Adresse de ramassage"
                  />
                  {/* Icons container for origin */}
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
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
                      <TooltipContent>Rechercher l'adresse entrée</TooltipContent>
                    </Tooltip>
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
                      <TooltipContent>Activer la sélection du point de départ sur la carte ({clickMode === 'origin' ? 'Actif' : 'Inactif'})</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                       <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUseLocationIconClick('origin')}
                           aria-label={hasGpsPermission === true ? "Utiliser ma position actuelle (GPS)" : "Activer et utiliser le GPS"}
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

              {/* Destination Address */}
              <div className="mb-4">
                <label htmlFor="destination" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de destination
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="destination"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-32" // Padding right for icons
                    placeholder="Entrer l'adresse ou cliquer sur la carte"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    ref={destinationInputRef}
                     onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')} // Search on Enter
                     onFocus={handleInputFocus} // Deactivate map click mode
                     aria-label="Adresse de destination"
                  />
                   {/* Icons container for destination */}
                   <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('destination')}
                          aria-label="Rechercher l'adresse de destination entrée"
                          disabled={!destination.trim()} // Disable if input empty
                        >
                           <Search className="h-5 w-5 text-gray-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Rechercher l'adresse entrée</TooltipContent>
                    </Tooltip>
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
                      <TooltipContent>Activer la sélection de la destination sur la carte ({clickMode === 'destination' ? 'Actif' : 'Inactif'})</TooltipContent>
                    </Tooltip>
                     <Tooltip>
                       <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUseLocationIconClick('destination')}
                           aria-label={hasGpsPermission === true ? "Utiliser ma position actuelle pour destination (GPS)" : "Activer GPS pour destination"}
                        >
                          <Locate className={`h-5 w-5 ${hasGpsPermission === false ? 'text-destructive' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasGpsPermission === true ? "Utiliser ma position actuelle pour destination (GPS)" : "Activer GPS pour destination"}
                         {hasGpsPermission === false && " (accès refusé)"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
               <div className="flex gap-2 flex-wrap"> {/* flex-wrap for responsiveness */}
                <Button onClick={() => calculateRoute()} disabled={!originMarker || !destinationMarker || !mapLoaded}>
                  {routeLine ? 'Recalculer l\'Itinéraire' : 'Calculer l\'Itinéraire'}
                </Button>
                <Button onClick={resetFullMap} variant="secondary" disabled={!mapLoaded}>Réinitialiser Carte</Button>
              </div>
            </div>

            {/* Right Column: Status Messages & Alerts */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0 space-y-2"> {/* Space for alerts */}
              {/* GPS Permission Denied Alert */}
              {hasGpsPermission === false && ( // Only show if explicitly denied
                <Alert variant="destructive">
                  <Locate className="h-4 w-4" /> {/* Lucide icon */}
                  <AlertTitle>Accès GPS Non Accordé ou Indisponible</AlertTitle>
                  <AlertDescription>
                     L'accès à votre position est désactivé ou non disponible. Vous pouvez
                     <Button variant="link" className="p-0 h-auto ml-1 text-destructive underline" onClick={() => setIsGpsDialogOpen(true)}>
                        réessayer d'activer le GPS
                    </Button>
                     , ou définir vos points manuellement.
                  </AlertDescription>
                </Alert>
              )}
              {/* GPS Permission Unknown/Prompt (and dialog not already open) */}
               {hasGpsPermission === null && !isGpsDialogOpen && mapLoaded && ( // Only show if unknown, dialog not open, and map is loaded
                <Alert>
                    <Locate className="h-4 w-4" /> {/* Lucide icon */}
                     <AlertTitle>Autorisation GPS en Attente</AlertTitle>
                     <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center">
                        Pour utiliser votre position actuelle,
                        <Button variant="link" className="p-0 h-auto ml-1 mr-1" onClick={() => setIsGpsDialogOpen(true)}>
                            activez le GPS
                        </Button>
                         via la boîte de dialogue. Sinon, définissez les points manuellement.
                     </AlertDescription>
                 </Alert>
                )}
                {/* GPS Permission Granted Alert */}
               {hasGpsPermission === true && (
                 <Alert variant="default" className="border-green-500"> {/* Custom border for success-like indication */}
                     <Locate className="h-4 w-4 text-green-600" /> {/* Green Lucide icon */}
                     <AlertTitle>GPS Actif et Autorisé</AlertTitle>
                     <AlertDescription>
                        Vous pouvez utiliser votre position actuelle via les icônes GPS.
                     </AlertDescription>
                 </Alert>
                )}
            </div>
          </div>

          {/* Delivery Options Section (shown only if route is calculated and map loaded) */}
          {routeLine && mapLoaded && (
            <div className="mt-8 pt-4 border-t"> {/* Add some top margin and border */}
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
                        <AlertDialogTitle>Activation de la Géolocalisation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Pour utiliser votre position actuelle, veuillez autoriser MapYOO à accéder à votre localisation GPS.
                            Si vous préférez, vous pouvez spécifier votre position manuellement sur la carte.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => handleGpsPermissionResponse(false, 'origin')}> {/* Default to origin if type not specified */}
                            Non, spécifier manuellement
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleGpsPermissionResponse(true, 'origin')}> {/* Default to origin */}
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
