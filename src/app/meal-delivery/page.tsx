// Force re-transpilation

'use client'; // This directive should be the first non-comment line

import React, {useState, useRef, useEffect, useCallback} from 'react';
import 'leaflet/dist/leaflet.css';
import ReactDOMServer from 'react-dom/server';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useToast} from '@/hooks/use-toast';
import {Locate, MapPin, Search, Pin, PinOff} from 'lucide-react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import type L from 'leaflet'; // Import L type
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
  height: '400px',
  cursor: 'crosshair'
};

const defaultLocation = { // Default to a location in Morocco
  lat: 31.7917,
  lng: -7.0926,
};

// Keep track of Leaflet library and icon instances globally within the module
let LRef: typeof import('leaflet') | null = null; // Store the Leaflet module itself
let originIconInstance: L.DivIcon | undefined;
let destinationIconInstance: L.DivIcon | undefined;
let currentPositionIconInstance: L.DivIcon | undefined;


const createLucideIcon = (IconComponent: React.ElementType, colorClass = 'text-primary', size = 6): L.DivIcon | undefined => {
  if (!LRef) {
    console.error("Leaflet (LRef) is not loaded. Cannot create icon.");
    return undefined;
  }
  const iconHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement('div', { style: { display: 'inline-block', position: 'relative', bottom: '-3px' } },
      React.createElement(IconComponent, { className: `h-${size} w-${size} ${colorClass}` })
    )
  );
  const iconSizeValue = size * 4;
  return LRef.divIcon({
    html: iconHtml,
    className: 'leaflet-lucide-icon', // Keep this class for potential global styling
    iconSize: [iconSizeValue, iconSizeValue], // Leaflet expects [width, height]
    iconAnchor: [iconSizeValue / 2, iconSizeValue], // Anchor point (bottom center)
    popupAnchor: [0, -iconSizeValue] // Popup anchor relative to iconAnchor
  });
};

async function reverseGeocode(lat: number, lng: number): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr&addressdetails=1`;
  console.log(`Reverse geocoding for: ${lat}, ${lng}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MapYOO Web Client/1.0 (contact@mapyoo.com)', // Replace with your actual app name and contact email
      },
    });
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Reverse Geocode Raw Result:", data);

    let displayName = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (data && data.address) {
        const address = data.address;
        const parts = [
            address.road || address.footway || address.pedestrian,
            address.neighbourhood || address.suburb,
            address.city || address.town || address.village || address.hamlet,
            address.state || address.county || address.region,
            address.postcode,
            address.country,
        ].filter(Boolean); // Filter out undefined/null parts

        if (parts.length > 0) {
            displayName = parts.join(', ');
        } else if (data.display_name) {
             displayName = data.display_name.split(',').slice(0, 3).join(',');
        }
       console.log("Formatted Address:", displayName);
    } else {
       console.warn("Reverse geocode: No address details found in response.");
    }

      return {
        lat: parseFloat(data.lat) || lat, // Use Nominatim's lat/lon if available
        lng: parseFloat(data.lon) || lng,
        displayName: displayName,
      };

  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    const coordsStr = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { lat: lat, lng: lng, displayName: coordsStr };
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=fr&countrycodes=ma&addressdetails=1`; // Prioritize Morocco
  console.log(`Geocoding address: ${address}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MapYOO Web Client/1.0 (contact@mapyoo.com)', // Replace with your actual app name and contact email
      },
    });
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Geocode Raw Result:", data);

    if (data && data.length > 0) {
        const result = data[0];
        let displayName = `Coordonnées: ${parseFloat(result.lat).toFixed(5)}, ${parseFloat(result.lon).toFixed(5)}`;

        if (result.address) {
            const addressDetails = result.address;
            const parts = [
                addressDetails.road || addressDetails.footway || addressDetails.pedestrian,
                addressDetails.neighbourhood || addressDetails.suburb,
                addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.hamlet,
                addressDetails.state || addressDetails.county || addressDetails.region,
                addressDetails.postcode,
                addressDetails.country,
            ].filter(Boolean);
             if (parts.length > 0) { // Corrected variable name from filteredParts
                displayName = parts.join(', ');
            } else if (result.display_name) { // Fallback to Nominatim's display_name
                 displayName = result.display_name.split(',').slice(0, 3).join(',');
            }
        } else if (result.display_name) {
             displayName = result.display_name.split(',').slice(0, 3).join(',');
        }

       console.log("Formatted Address from Geocode:", displayName);

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: displayName,
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
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [routeLine, setRouteLine] = useState<L.Polyline | null>(null);
  const [clickMode, setClickMode] = useState<'origin' | 'destination' | 'none'>('none');
  const [mapLoaded, setMapLoaded] = useState(false);
  const currentMapRef = useRef<L.Map | null>(null);


   const calculateRoute = useCallback(async (currentOriginParam?: L.Marker | null, currentDestinationParam?: L.Marker | null) => {
      const originToUse = currentOriginParam ?? originMarker;
      const destinationToUse = currentDestinationParam ?? destinationMarker;
      const currentMap = mapRef.current;


       if (!LRef || !currentMap || !originToUse || !destinationToUse) {
           console.warn("Calculate route skipped: Missing map, leaflet, or markers.", { hasMap: !!currentMap, hasL: !!LRef, hasOrigin: !!originToUse, hasDest: !!destinationToUse });
           toast({
               variant: 'default',
               title: 'Information Manquante',
               description: 'Veuillez définir un point de départ ET de destination sur la carte ou via la recherche.',
           });
           return;
      }

       const originCoords = originToUse.getLatLng();
       const destinationCoords = destinationToUse.getLatLng();
       console.log(`Calculating route from (${originCoords.lat}, ${originCoords.lng}) to (${destinationCoords.lng}, ${destinationCoords.lat})`);

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
                const distanceKm = (route.distance / 1000).toFixed(2);
                const durationMinutes = Math.round(route.duration / 60);

                if (routeLine && currentMap.hasLayer(routeLine)) {
                    console.log("Removing existing route line.");
                    currentMap.removeLayer(routeLine);
                }

                console.log("Adding new route line.");
                const newRouteLine = LRef.geoJSON(geoJson, {
                    style: { color: 'hsl(var(--primary))', weight: 5 },
                }).addTo(currentMap);

                newRouteLine.bindPopup(`Distance: ${distanceKm} km<br>Durée: ~${durationMinutes} min`);
                setRouteLine(newRouteLine as L.Polyline);

                currentMap.fitBounds(newRouteLine.getBounds());

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
                description: `Une erreur s’est produite lors du calcul de l’itinéraire. ${error.message || ''}`
            });
       }
   }, [originMarker, destinationMarker, routeLine, toast]);


   const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
     console.log("Map clicked, current mode:", clickMode);
     const currentMap = mapRef.current;
     if (!mapLoaded || !LRef || !currentMap || clickMode === 'none') {
       if (clickMode === 'none') {
            toast({ variant: 'default', title: 'Mode Sélection Inactif', description: "Cliquez sur l'icône 'Choisir sur la carte' (📍) près d'un champ d'adresse pour activer la sélection." });
       } else {
           console.warn("Map click ignored: Map not loaded or ready.", { mapLoaded, LRef: !!LRef, mapRef: !!currentMap });
            toast({ variant: 'destructive', title: 'Carte non prête' });
       }
       return;
     }

     const latLng = e.latlng;
     console.log("Clicked Coords:", latLng);

     const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Lat: ${latLng.lat.toFixed(5)}, Lng: ${latLng.lng.toFixed(5)}` });
     const geocodeResult = await reverseGeocode(latLng.lat, latLng.lng);

     const finalLatLng = geocodeResult ? new L.LatLng(geocodeResult.lat, geocodeResult.lng) : latLng;
     const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`;

     geocodeToast.update({
        id: geocodeToast.id,
        title: geocodeResult ? "Adresse trouvée" : "Adresse générique (coordonnées)",
        description: address,
        variant: geocodeResult ? 'default' : 'destructive'
      });

     if (clickMode === 'origin') {
        if (!originIconInstance) {
            console.error("Origin icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de départ n'a pas pu être chargée." });
            return;
        }
        console.log("Setting Origin...");
        if (originMarker && currentMap.hasLayer(originMarker)) {
            console.log("Removing previous origin marker.");
            currentMap.removeLayer(originMarker);
        }
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because origin changed.");
             currentMap.removeLayer(routeLine);
            setRouteLine(null);
        }

        setOrigin(address);

         try {
            console.log("Adding new origin marker.");
            const newOriginMarker = LRef.marker([finalLatLng.lat, finalLatLng.lng], { icon: originIconInstance })
                .addTo(currentMap)
                .bindPopup(`Départ: ${address.split(',')[0]}`)
                .openPopup();
            setOriginMarker(newOriginMarker);
            currentMap.setView([finalLatLng.lat, finalLatLng.lng], 15);
            toast({ title: "Point de Départ Mis à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de destination." });

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
        if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
            console.log("Removing previous destination marker.");
            currentMap.removeLayer(destinationMarker);
        }
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because destination changed.");
             currentMap.removeLayer(routeLine);
            setRouteLine(null);
        }

       setDestination(address);

         try {
             console.log("Adding new destination marker.");
             const newDestinationMarker = LRef.marker([finalLatLng.lat, finalLatLng.lng], { icon: destinationIconInstance })
               .addTo(currentMap)
               .bindPopup(`Destination: ${address.split(',')[0]}`)
               .openPopup();
             setDestinationMarker(newDestinationMarker);
             currentMap.setView([finalLatLng.lat, finalLatLng.lng], 15);
             toast({ title: "Destination Mise à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de départ." });

              if (originMarker) {
                   console.log("Calculating route after destination set via click...");
                   await calculateRoute(originMarker, newDestinationMarker);
              }
         } catch (error: any) {
             console.error("Error adding destination marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Destination", description: `Impossible d'ajouter le marqueur de destination. ${error.message || ''}` });
         }
     }
   }, [clickMode, originMarker, destinationMarker, routeLine, toast, calculateRoute, mapLoaded]);

   const checkGpsPermission = useCallback(async (promptUserIfNeeded = true) => {
        console.log(`Checking GPS permission. Prompt if needed: ${promptUserIfNeeded}`);
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                console.log("GPS Permission Status:", permissionStatus.state);
                if (permissionStatus.state === 'granted') {
                    setHasGpsPermission(true);
                    setIsGpsDialogOpen(false); // Don't show dialog if already granted
                    return true;
                } else if (permissionStatus.state === 'prompt') {
                    setHasGpsPermission(null);
                    if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true); // Show dialog if unknown and user needs prompt
                    return null;
                } else {
                    setHasGpsPermission(false);
                    if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true); // Show dialog if denied and user needs prompt
                    return false;
                }
            } catch (error) {
                console.error("Error checking GPS permission:", error);
                setHasGpsPermission(false);
                if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true);
                return false;
            }
        } else {
            console.warn("Navigator.permissions API not available.");
            setHasGpsPermission(null);
            if (promptUserIfNeeded && !isGpsDialogOpen) setIsGpsDialogOpen(true);
            return null;
        }
    }, [isGpsDialogOpen]);

    const handleGpsPermissionResponse = useCallback(async (granted: boolean, fieldTypeToSet: 'origin' | 'destination' = 'origin') => {
        setIsGpsDialogOpen(false);
        if (granted) {
            setHasGpsPermission(true);
            toast({ title: 'Activation GPS demandée...', description: 'Tentative de récupération de votre position.' });
            await getCurrentLocationAndSetField(fieldTypeToSet);
        } else {
            setHasGpsPermission(false); // Explicitly set to false if user chose "Non"
            toast({ title: 'GPS Non Activé', description: 'Vous pouvez définir votre position manuellement.' });
        }
        requestAnimationFrame(() => mapRef.current?.invalidateSize());
    }, [toast]); // Removed getCurrentLocationAndSetField from deps, handle it via hasGpsPermission effect

  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || !document.getElementById('map') || mapRef.current || mapLoaded) {
        console.log("Map initialization skipped:", { hasWindow: typeof window !== 'undefined', mapElementExists: !!document.getElementById('map'), mapRefExists: !!mapRef.current, mapAlreadyLoaded: mapLoaded });
        return;
      }

      try {
        console.log("Initializing map...");
        const L_module = (await import('leaflet')).default;
        LRef = L_module;

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
            console.error("Map element not found after import");
            return;
        }

        if (mapRef.current) {
            console.log("Map already initialized (concurrently), skipping.");
            return;
        }

        const map = LRef.map(mapElement, {
          center: [defaultLocation.lat, defaultLocation.lng],
          zoom: 6,
          doubleClickZoom: false,
          closePopupOnClick: true,
          attributionControl: false,
        });
         console.log("Leaflet map instance created.");

        LRef.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
         console.log("Tile layer added.");

        LRef.control.attribution({ position: 'bottomright', prefix: '' }).addTo(map);
         console.log("Attribution control added.");

        currentMapRef.current = map;
        mapRef.current = map;


        requestAnimationFrame(() => {
            if (currentMapRef.current) {
                console.log("Calling map.invalidateSize() via requestAnimationFrame...");
                currentMapRef.current.invalidateSize();
                console.log("map.invalidateSize() called.");
                setMapLoaded(true);
                console.log("Map initialized and loaded state set AFTER invalidateSize.");
                // After map is loaded, check (don't necessarily prompt) GPS dialog
                checkGpsPermission(true);
            }
        });

        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = 'crosshair';
           console.log("Map container cursor set to crosshair.");
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
    const cleanup = () => {
      console.log("Cleaning up map...");
      const currentMapInstance = currentMapRef.current;
      if (currentMapInstance) {
         console.log("Map instance found for cleanup.");
         try {
           const mapElement = document.getElementById('map');
           if (mapElement && currentMapInstance.getContainer() && mapElement === currentMapInstance.getContainer()) {
                console.log("Removing map instance...");
                currentMapInstance.remove();
                console.log("Map instance removed.");
           } else {
                console.log("Map container already removed or not found.");
           }
         } catch (e) {
           console.warn("Error during map cleanup:", e);
         } finally {
           currentMapRef.current = null;
           mapRef.current = null;
           console.log("Map refs cleared.");
         }
      } else {
         console.log("No map instance found in ref for cleanup.");
      }
      LRef = null;
      originIconInstance = undefined;
      destinationIconInstance = undefined;
      currentPositionIconInstance = undefined;
      setMapLoaded(false);
      console.log("Map cleanup complete.");
    };
    return cleanup;
  }, [toast, checkGpsPermission]);


   const resetMapStateForNewField = (fieldType: 'origin' | 'destination') => {
       console.log(`Resetting map state for new ${fieldType} selection.`);
        const currentMap = mapRef.current;
        if (!currentMap || !LRef) return;

        if (fieldType === 'origin') {
            if (originMarker && currentMap.hasLayer(originMarker)) {
                currentMap.removeLayer(originMarker);
            }
            setOriginMarker(null);
        } else {
            if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
                currentMap.removeLayer(destinationMarker);
            }
            setDestinationMarker(null);
        }

        if (routeLine && currentMap.hasLayer(routeLine)) {
            currentMap.removeLayer(routeLine);
            setRouteLine(null);
        }
    };

  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap && mapLoaded) {
      console.log("Attaching map 'click' listener in separate effect as map is loaded.");
      currentMap.on('click', handleMapClick);
      return () => {
        console.log("Detaching map 'click' listener in separate effect cleanup.");
        if (currentMap && currentMap.hasEventListeners('click')) {
          currentMap.off('click', handleMapClick);
        }
      };
    }
    return () => {};
  }, [mapLoaded, handleMapClick]);


  const getCurrentLocationAndSetField = async (fieldType: 'origin' | 'destination') => {
      console.log(`Attempting to get current location and set as ${fieldType}...`);
      setClickMode('none');

      const currentMap = mapRef.current;
      if (!currentMap || !LRef || !currentPositionIconInstance) {
          console.error("Cannot get location: Map, Leaflet, or currentPositionIconInstance not ready.");
          toast({ variant: 'destructive', title: 'Erreur Carte/Icone', description: 'La carte ou l\'icône de position actuelle n\'a pas pu être chargée.' });
          return;
      }

      resetMapStateForNewField(fieldType);

      const gpsToastId = toast({ title: "Localisation en cours...", description: "Tentative de récupération de votre position GPS." });

      try {
          console.log("Calling navigator.geolocation.getCurrentPosition...");
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true, timeout: 10000, maximumAge: 0
              });
          });
          console.log("Geolocation success:", position);
          setHasGpsPermission(true);
          setIsGpsDialogOpen(false);

          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };

          const geocodeResult = await reverseGeocode(coords.lat, coords.lng);
          const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
          console.log(`GPS Reverse Geocode Result for ${fieldType}:`, address);

          let newMarker: L.Marker | null = null;
          if (!currentPositionIconInstance) throw new Error("currentPositionIconInstance became unavailable");

          newMarker = LRef.marker([coords.lat, coords.lng], { icon: currentPositionIconInstance }).addTo(currentMap);

          if (fieldType === 'origin') {
              setOriginMarker(newMarker);
              setOrigin(address);
              newMarker.bindPopup(`Départ (Actuel): ${address.split(',')[0]}`).openPopup();
          } else {
              setDestinationMarker(newMarker);
              setDestination(address);
              newMarker.bindPopup(`Destination (Actuelle): ${address.split(',')[0]}`).openPopup();
          }

          currentMap.setView([coords.lat, coords.lng], 15);
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


      } catch (error: any) {
          console.error(`Error accessing GPS location for ${fieldType}:`, error);
          let description = 'Une erreur s’est produite.';
          if (error.code === error.PERMISSION_DENIED) {
              description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur.';
              setHasGpsPermission(false);
          } else if (error.code === error.POSITION_UNAVAILABLE) {
              description = 'Votre position actuelle n’est pas disponible.';
          } else if (error.code === error.TIMEOUT) {
              description = 'La demande de géolocalisation a expiré.';
          } else if (error.message) {
              description = error.message;
          }

          gpsToastId.update({
              id: gpsToastId.id,
              variant: 'destructive',
              title: error.code === error.PERMISSION_DENIED ? 'Accès GPS Refusé par Navigateur' : `Erreur GPS (${fieldType})`,
              description: description,
          });
           setIsGpsDialogOpen(false);
      }
  };


    const resetFullMap = () => {
        console.log("Resetting full map state: inputs, markers, route, view.");
        const currentMap = mapRef.current;
        if (currentMap && LRef) {
           resetMapStateForNewField('origin');
           resetMapStateForNewField('destination');
           setOrigin('');
           setDestination('');
           currentMap.setView([defaultLocation.lat, defaultLocation.lng], 6);
           setClickMode('none');
           toast({ title: 'Carte Réinitialisée', description: 'Sélectionnez un nouveau point de départ.' });
        } else {
            console.warn("Cannot reset full map: Map not ready.");
            toast({ variant: 'destructive', title: 'Carte non prête' });
        }
      };


   const handleFocusInputAndSetMode = (ref: React.RefObject<HTMLInputElement>, mode: 'origin' | 'destination') => {
     if (ref.current) {
         console.log(`Setting click mode to '${mode}' and focusing input.`);
       ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
       ref.current.focus();
       setClickMode(mode);
       toast({
           title: `Mode Sélection ${mode === 'origin' ? 'Départ' : 'Destination'} Activé`,
           description: `Cliquez sur la carte pour définir ${mode === 'origin' ? 'le point de départ' : 'la destination'}.`,
       });
     } else {
         console.warn(`Cannot focus input for mode '${mode}': Ref is null.`);
     }
   };

  const handleUseLocationIconClick = async (fieldType: 'origin' | 'destination') => {
      console.log(`'Use Current Location' icon clicked for ${fieldType}.`);
      setClickMode('none');
      if (!mapRef.current || !LRef) {
        console.warn("Cannot use current location: Map not ready.");
        return;
      }

      if (hasGpsPermission === true) {
          await getCurrentLocationAndSetField(fieldType);
      } else if (hasGpsPermission === false) { // Denied previously
          setIsGpsDialogOpen(true); // Re-open dialog to potentially guide to settings
      } else { // null (unknown/prompt)
          setIsGpsDialogOpen(true);
      }
  };

   const handleAddressSearch = async (type: 'origin' | 'destination') => {
       console.log(`Handling address search for: ${type}`);
       setClickMode('none');
       const currentMap = mapRef.current;
       if (!currentMap || !LRef || !originIconInstance || !destinationIconInstance) {
            console.error("Cannot search address: Map, Leaflet, or icons not ready.");
           toast({ variant: "destructive", title: "Carte non prête", description: "La carte ou ses composants ne sont pas encore initialisés." });
           return;
       }
       const address = type === 'origin' ? origin : destination;

       if (!address || address.trim().length < 3) {
           console.warn(`Address search validation failed for ${type}: "${address}"`);
           toast({ variant: 'destructive', title: 'Recherche invalide', description: 'Veuillez entrer une adresse plus complète (au moins 3 caractères).' });
           return;
       }

       const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Recherche de: ${address}` });
       const result = await geocodeAddress(address);

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
           let markerRef = type === 'origin' ? originMarker : destinationMarker;
           const setMarkerState = type === 'origin' ? setOriginMarker : setDestinationMarker;
           const setAddressState = type === 'origin' ? setOrigin : setDestination;

           resetMapStateForNewField(type);

           let newMarker: L.Marker | null = null;
           try {
                console.log(`Adding new ${type} marker at (${lat}, ${lng}).`);
                if (!iconToUse) throw new Error(`${type} icon is not loaded`);
                newMarker = LRef.marker([lat, lng], { icon: iconToUse })
                   .addTo(currentMap)
                   .bindPopup(`${type === 'origin' ? 'Départ' : 'Destination'}: ${displayName.split(',')[0]}`)
                   .openPopup();

               setMarkerState(newMarker);
               setAddressState(displayName);

               currentMap.setView([lat, lng], 15);

                const otherMarker = type === 'origin' ? destinationMarker : originMarker;
                 if (newMarker && otherMarker) {
                     console.log(`Calculating route after ${type} search (both markers exist).`);
                     await calculateRoute(type === 'origin' ? newMarker : originMarker, type === 'destination' ? newMarker : destinationMarker);
                 }

           } catch (error: any) {
               console.error(`Error adding marker for ${type} search:`, error);
               toast({ variant: 'destructive', title: `Erreur Marqueur ${type === 'origin' ? 'Départ' : 'Destination'}`, description: `Impossible d'ajouter le marqueur pour ${address}. ${error.message || ''}` });
               if (newMarker && currentMap.hasLayer(newMarker)) { currentMap.removeLayer(newMarker); }
               setMarkerState(null);
           }
       } else {
            console.warn(`Address search failed for ${type}: "${address}"`);
       }
    };

  const handleInputFocus = () => {
    console.log("Input focused, deactivating clickMode.");
    setClickMode('none');
  };


  return (
    <TooltipProvider delayDuration={100}>
      <div>
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4 bg-gray-200" />

        <style jsx global>{`
          .leaflet-lucide-icon {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            line-height: 0;
            margin: 0 !important;
            padding: 0 !important;
          }
           .leaflet-marker-icon.leaflet-div-icon {
             background: none;
             border: none;
             padding: 0;
             margin: 0;
             box-shadow: none;
             width: auto !important;
             height: auto !important;
           }
           .leaflet-marker-icon .leaflet-lucide-icon div {
              line-height: normal;
           }
            #map {
              min-height: 400px;
              background-color: #f0f0f0;
              z-index: 0;
              position: relative;
            }
            #map.leaflet-container {
                cursor: crosshair !important;
                background-color: #e5e3df;
            }
            .leaflet-container {
                width: 100%;
                height: 400px;
                visibility: ${mapLoaded ? 'visible' : 'hidden'};
            }
            .leaflet-tile-pane {
                visibility: ${mapLoaded ? 'visible' : 'hidden'};
            }
        `}</style>

        <div className="container mx-auto p-4 pt-2">
          <h1 className="text-2xl font-semibold mb-4 text-center md:text-left">Livraison de Repas</h1>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 space-y-4">
              <div className="mb-4">
                <label htmlFor="origin" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de ramassage
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="origin"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-32"
                    placeholder="Entrer l'adresse, utiliser le GPS, ou cliquer sur la carte"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    ref={originInputRef}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('origin')}
                    onFocus={handleInputFocus}
                    aria-label="Adresse de ramassage"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('origin')}
                          aria-label="Rechercher l'adresse de ramassage entrée"
                          disabled={!origin.trim()}
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
                           className={clickMode === 'origin' ? 'text-primary ring-2 ring-primary rounded-full' : ''}
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

              <div className="mb-4">
                <label htmlFor="destination" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de destination
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="destination"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-32"
                    placeholder="Entrer l'adresse ou cliquer sur la carte"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    ref={destinationInputRef}
                     onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')}
                     onFocus={handleInputFocus}
                     aria-label="Adresse de destination"
                  />
                   <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddressSearch('destination')}
                          aria-label="Rechercher l'adresse de destination entrée"
                          disabled={!destination.trim()}
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
                           className={clickMode === 'destination' ? 'text-primary ring-2 ring-primary rounded-full' : ''}
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

               <div className="flex gap-2 flex-wrap">
                <Button onClick={() => calculateRoute()} disabled={!originMarker || !destinationMarker || !mapLoaded}>
                  {routeLine ? 'Recalculer l\'Itinéraire' : 'Calculer l\'Itinéraire'}
                </Button>
                <Button onClick={resetFullMap} variant="secondary" disabled={!mapLoaded}>Réinitialiser Carte</Button>
              </div>
            </div>

            <div className="w-full md:w-1/2 mt-4 md:mt-0 space-y-2">
              {hasGpsPermission === false && (
                <Alert variant="destructive">
                  <Locate className="h-4 w-4" />
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
               {hasGpsPermission === null && !isGpsDialogOpen && mapLoaded && (
                <Alert>
                    <Locate className="h-4 w-4" />
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
               {hasGpsPermission === true && (
                 <Alert variant="default" className="border-green-500">
                     <Locate className="h-4 w-4 text-green-600" />
                     <AlertTitle>GPS Actif et Autorisé</AlertTitle>
                     <AlertDescription>
                        Vous pouvez utiliser votre position actuelle via les icônes GPS.
                     </AlertDescription>
                 </Alert>
                )}
            </div>
          </div>

          {routeLine && mapLoaded && (
            <div className="mt-8 pt-4 border-t">
              <h2 className="text-xl font-semibold mb-4 text-center md:text-left">Options de Livraison</h2>
              <div className="flex flex-col sm:flex-row justify-center sm:justify-start space-y-2 sm:space-y-0 sm:space-x-4">
                <Button variant="outline">Ouvrir une Enchère</Button>
                <Button variant="outline">Trouver un Livreur</Button>
                <Button>MapYOO Service</Button>
              </div>
            </div>
          )}

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
                        <AlertDialogCancel onClick={() => handleGpsPermissionResponse(false, 'origin')}>
                            Non, spécifier manuellement
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleGpsPermissionResponse(true, 'origin')}>
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

