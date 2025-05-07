
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
import type L from 'leaflet';
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


const mapContainerStyle = {
  width: '100%',
  height: '400px',
  cursor: 'crosshair'
};

const defaultLocation = {
  lat: 34.052235, // Default to LA
  lng: -118.243683,
};

let LRef: React.MutableRefObject<typeof L | null> = { current: null };

const createLucideIcon = (IconComponent: React.ElementType, colorClass = 'text-primary', size = 6): L.DivIcon | undefined => {
  if (!LRef.current) return undefined;
  const L = LRef.current;
  const iconHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement('div', { style: { display: 'inline-block', position: 'relative', bottom: '-5px' } },
      React.createElement(IconComponent, { className: `h-${size} w-${size} ${colorClass}` })
    )
  );
  const iconSizeValue = size * 4;
  return L.divIcon({
    html: iconHtml,
    className: 'leaflet-lucide-icon',
    iconSize: [iconSizeValue, iconSizeValue],
    iconAnchor: [iconSizeValue / 2, iconSizeValue],
    popupAnchor: [0, -iconSizeValue]
  });
};

let originIcon: L.DivIcon | undefined;
let destinationIcon: L.DivIcon | undefined;
let currentPositionIcon: L.DivIcon | undefined;

async function reverseGeocode(lat: number, lng: number): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr&addressdetails=1`;
  console.log(`Reverse geocoding for: ${lat}, ${lng}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Reverse Geocode Raw Result:", data);

    let displayName = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (data && data.address) {
        const address = data.address;
        const parts = [
            address.city || address.town || address.village || address.hamlet,
            address.road || address.footway || address.pedestrian,
            address.state || address.region,
            address.postcode,
            address.country,
        ];
        const filteredParts = parts.filter(part => part);
        if (filteredParts.length > 0) {
            displayName = filteredParts.join(', ');
        } else if (data.display_name) {
             displayName = data.display_name.split(',').slice(0, 3).join(',');
        }
       console.log("Formatted Address:", displayName);
    } else {
       console.warn("Reverse geocode: No address details found in response.");
    }

      return {
        lat: lat,
        lng: lng,
        displayName: displayName,
      };

  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    const coordsStr = `Coordonnées: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { lat: lat, lng: lng, displayName: coordsStr };
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=fr&countrycodes=ma&addressdetails=1`;
  console.log(`Geocoding address: ${address}`);
  try {
    const response = await fetch(url);
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
                addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.hamlet,
                addressDetails.road || addressDetails.footway || addressDetails.pedestrian,
                addressDetails.state || addressDetails.region,
                addressDetails.postcode,
                addressDetails.country,
            ];
            const filteredParts = parts.filter(part => part);
             if (filteredParts.length > 0) {
                displayName = filteredParts.join(', ');
            } else if (result.display_name) {
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
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null);
  const [isGpsDialogOpen, setIsGpsDialogOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [routeLine, setRouteLine] = useState<L.GeoJSON | null>(null);
  const [clickMode, setClickMode] = useState<'origin' | 'destination' | 'none'>('none');
  const [mapLoaded, setMapLoaded] = useState(false);


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
       const currentMap = mapRef.current;

       if (!currentMap) {
           console.error("Map instance not available for route calculation.");
            toast({ variant: 'destructive', title: 'Erreur Carte', description: 'La carte n\'est pas prête pour le calcul d\'itinéraire.' });
           return;
       }
       
       await currentMap.whenReady(async () => { // Ensure map is ready
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
                    const newRouteLine = L.geoJSON(geoJson, {
                        style: { color: 'hsl(var(--primary))', weight: 5 },
                    }).addTo(currentMap);

                    newRouteLine.bindPopup(`Distance: ${distanceKm} km<br>Durée: ~${durationMinutes} min`);
                    setRouteLine(newRouteLine);

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
                    description: `Une erreur s’est produite lors du calcul de l’itinéraire. ${error.message || ''}`,
                });
            }
        });
   }, [originMarker, destinationMarker, routeLine, toast]);


   const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
     console.log("Map clicked, current mode:", clickMode);
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
     const currentMap = mapRef.current;
     const latLng = e.latlng;
     console.log("Clicked Coords:", latLng);

     const geocodeToast = toast({ title: "Recherche d'adresse...", description: `Lat: ${latLng.lat.toFixed(5)}, Lng: ${latLng.lng.toFixed(5)}` });
     const geocodeResult = await reverseGeocode(latLng.lat, latLng.lng);
     console.log("Reverse Geocode Result in click handler:", geocodeResult);

     geocodeToast.update({
        id: geocodeToast.id,
        title: geocodeResult ? "Adresse trouvée" : "Adresse non trouvée",
        description: geocodeResult ? geocodeResult.displayName : `Impossible de trouver une adresse pour ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`,
        variant: geocodeResult ? 'default' : 'destructive'
      });

     if (!geocodeResult) {
         console.warn("Map click aborted: Reverse geocoding failed.");
         return;
     }

     const address = geocodeResult.displayName;

     if (clickMode === 'origin') {
        if (!originIcon) {
            console.error("Origin icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de départ n'a pas pu être chargée." });
            setClickMode('none');
            return;
        }
        console.log("Setting Origin...");
        if (originMarker && currentMap.hasLayer(originMarker)) {
            console.log("Removing previous origin marker.");
             try { currentMap.removeLayer(originMarker); } catch (error) { console.warn("Error removing origin marker:", error); }
        }
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because origin changed.");
             try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
            setRouteLine(null);
        }

        setOrigin(address);

         try {
             console.log("Adding new origin marker.");
            const newOriginMarker = L.marker([latLng.lat, latLng.lng], { icon: originIcon })
                .addTo(currentMap)
                .bindPopup(`Départ: ${address.split(',')[0]}`)
                .openPopup();
            setOriginMarker(newOriginMarker);
            toast({ title: "Point de Départ Mis à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de destination." });

            if (destinationMarker) {
                console.log("Calculating route after origin set via click (destination exists)...");
                await calculateRoute(newOriginMarker, destinationMarker);
            }
         } catch (error: any) {
             console.error("Error adding origin marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Départ", description: `Impossible d'ajouter le marqueur de départ. ${error.message || ''}` });
             setClickMode('none');
         }


     } else if (clickMode === 'destination') {
         if (!destinationIcon) {
            console.error("Destination icon not loaded!");
            toast({ variant: 'destructive', title: 'Erreur Interne', description: "L'icône de destination n'a pas pu être chargée." });
            setClickMode('none');
            return;
        }
       console.log("Setting Destination...");
        if (destinationMarker && currentMap.hasLayer(destinationMarker)) {
            console.log("Removing previous destination marker.");
             try { currentMap.removeLayer(destinationMarker); } catch (error) { console.warn("Error removing destination marker:", error); }
        }
        if (routeLine && currentMap.hasLayer(routeLine)) {
             console.log("Removing route line because destination changed.");
             try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
            setRouteLine(null);
        }

       setDestination(address);

         try {
             console.log("Adding new destination marker.");
             const newDestinationMarker = L.marker([latLng.lat, latLng.lng], { icon: destinationIcon })
               .addTo(currentMap)
               .bindPopup(`Destination: ${address.split(',')[0]}`)
               .openPopup();
             setDestinationMarker(newDestinationMarker);
             toast({ title: "Destination Mise à Jour", description: "Cliquez à nouveau pour ajuster ou activez la sélection de départ." });

              if (originMarker) {
                   console.log("Calculating route after destination set via click...");
                   await calculateRoute(originMarker, newDestinationMarker);
              }
         } catch (error: any) {
             console.error("Error adding destination marker:", error);
             toast({ variant: "destructive", title: "Erreur Marqueur Destination", description: `Impossible d'ajouter le marqueur de destination. ${error.message || ''}` });
              setClickMode('none');
         }

     } else {
         console.warn("Map clicked but clickMode was neither 'origin' nor 'destination'. Mode:", clickMode);
         setClickMode('none');
     }
   }, [clickMode, originMarker, destinationMarker, routeLine, toast, calculateRoute, mapLoaded]);

   const checkGpsPermission = async (promptUserIfNeeded = true) => {
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                if (permissionStatus.state === 'granted') {
                    setHasGpsPermission(true);
                    setIsGpsDialogOpen(false); // Close dialog if permission already granted
                    return true;
                } else if (permissionStatus.state === 'prompt') {
                    setHasGpsPermission(null);
                    if (promptUserIfNeeded) setIsGpsDialogOpen(true);
                    return null; // Will be determined by user action
                } else { // denied
                    setHasGpsPermission(false);
                    if (promptUserIfNeeded) setIsGpsDialogOpen(true); // Still show dialog to inform user
                    return false;
                }
            } catch (error) {
                console.error("Error checking GPS permission:", error);
                setHasGpsPermission(false); // Assume denied on error
                if (promptUserIfNeeded) setIsGpsDialogOpen(true);
                return false;
            }
        } else {
            console.warn("Navigator.permissions API not available. Opening dialog for manual prompt.");
            setHasGpsPermission(null); // Cannot determine, rely on dialog
            if (promptUserIfNeeded) setIsGpsDialogOpen(true);
            return null;
        }
    };
    
    const handleGpsPermissionResponse = (granted: boolean) => {
        setIsGpsDialogOpen(false); // Close the dialog
        if (granted) {
             // User clicked "Oui, Activer GPS"
             // We don't call getCurrentLocationAndSetOrigin here directly.
             // The user must click the "Use Current Location" icon AFTER granting permission.
             // This function just updates the permission state.
             setHasGpsPermission(true);
             toast({ title: 'Autorisation GPS Accordée', description: 'Cliquez sur l\'icône GPS pour utiliser votre position.' });
             // The map should invalidateSize if it was hidden by the dialog
             if (mapRef.current) {
                requestAnimationFrame(() => mapRef.current?.invalidateSize());
             }
        } else {
            // User clicked "Non, spécifier manuellement" or denied via browser prompt
            setHasGpsPermission(false);
            toast({ title: 'GPS Non Activé', description: 'Vous pouvez définir votre position manuellement.' });
             if (mapRef.current) {
                requestAnimationFrame(() => mapRef.current?.invalidateSize());
             }
        }
    };


  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || !document.getElementById('map') || mapRef.current || mapLoaded) {
        console.log("Map initialization skipped:", { hasWindow: typeof window !== 'undefined', mapElementExists: !!document.getElementById('map'), mapRefExists: !!mapRef.current, mapAlreadyLoaded: mapLoaded });
        return;
      }

      try {
        console.log("Initializing map...");
        const L = (await import('leaflet')).default;
        LRef.current = L;

        console.log("Creating Lucide icons for Leaflet...");
        originIcon = createLucideIcon(Pin, 'text-blue-600', 8);
        destinationIcon = createLucideIcon(PinOff, 'text-green-600', 8);
        currentPositionIcon = createLucideIcon(Locate, 'text-red-600', 8);
         if (!originIcon || !destinationIcon || !currentPositionIcon) {
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

        const map = L.map(mapElement, {
          center: [defaultLocation.lat, defaultLocation.lng],
          zoom: 10,
          doubleClickZoom: false,
          closePopupOnClick: true,
          attributionControl: false,
        });
         console.log("Leaflet map instance created.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
         console.log("Tile layer added.");

        L.control.attribution({ position: 'bottomright', prefix: '' }).addTo(map);
         console.log("Attribution control added.");

        mapRef.current = map;

        requestAnimationFrame(() => {
            if (mapRef.current) {
                console.log("Calling map.invalidateSize() via requestAnimationFrame...");
                mapRef.current.invalidateSize();
                console.log("map.invalidateSize() called.");
                setMapLoaded(true);
                console.log("Map initialized and loaded state set AFTER invalidateSize.");
                 // After map is loaded and invalidated, check GPS permission
                checkGpsPermission(); // This will open dialog if needed
            }
        });


        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = 'crosshair';
           console.log("Map container cursor set to crosshair.");
        } else {
            console.warn("Map container not found immediately after initialization.");
        }

        map.on('click', handleMapClick);
        console.log("Map 'click' listener attached.");


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
      const currentMap = mapRef.current;
      if (currentMap) {
         console.log("Map instance found for cleanup.");
         try {
           currentMap.off('click', handleMapClick);
           console.log("Map 'click' listener removed.");
           const mapElement = document.getElementById('map');
           if (mapElement && currentMap.getContainer() && mapElement === currentMap.getContainer()) {
                console.log("Removing map instance...");
                currentMap.remove();
                console.log("Map instance removed.");
           } else {
                console.log("Map container already removed, detached, or element not found, skipping map.remove().");
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
      LRef.current = null;
      originIcon = undefined;
      destinationIcon = undefined;
      currentPositionIcon = undefined;
      setMapLoaded(false);
      console.log("Map cleanup complete.");
    };
    return cleanup;
  }, [toast, handleMapClick]);


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


  const getCurrentLocationAndSetOrigin = async () => {
      console.log("Attempting to get current location and set as origin via getCurrentPosition...");
    if (!mapRef.current || !LRef.current || !currentPositionIcon) {
        console.error("Cannot get location: Map, Leaflet, or currentPositionIcon not ready.", { mapReady: !!mapRef.current, LReady: !!LRef.current, iconReady: !!currentPositionIcon });
       toast({ variant: 'destructive', title: 'Erreur Carte/Icone', description: 'La carte ou l\'icône de position actuelle n\'a pas pu être chargée.' });
       return;
    }
    const L = LRef.current;
    const currentMap = mapRef.current;
    resetMapStateForNewOrigin();

    const gpsToastId = toast({ title: "Localisation en cours...", description: "Tentative de récupération de votre position GPS." });

    try {
      console.log("Calling navigator.geolocation.getCurrentPosition...");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
      });
      console.log("Geolocation success:", position);
      setHasGpsPermission(true);
      setIsGpsDialogOpen(false); // Ensure dialog is closed on success
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCurrentLocation(coords);

       if (!currentPositionIcon) throw new Error("currentPositionIcon became unavailable");

        let newMarker: L.Marker | null = null;
        try {
           console.log("Adding GPS location marker to map using currentPositionIcon.");
           newMarker = L.marker([coords.lat, coords.lng], { icon: currentPositionIcon }).addTo(currentMap);
           setOriginMarker(newMarker);

            console.log("Reverse geocoding GPS coordinates...");
           const geocodeResult = await reverseGeocode(coords.lat, coords.lng);
           const address = geocodeResult ? geocodeResult.displayName : `Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
           console.log("GPS Reverse Geocode Result:", address);

           newMarker.bindPopup(`Départ (Actuel): ${address.split(',')[0]}`).openPopup();
           setOrigin(address);

           currentMap.setView([coords.lat, coords.lng], 15);
           console.log("Setting click mode to 'none' after GPS success.");
           setClickMode('none');

            gpsToast.update({
                id: gpsToastId.id,
                title: 'Position Actuelle Définie',
                description: `Départ: ${address}. Choisissez la destination.`,
            });


            if (destinationMarker && newMarker) {
                console.log("Calculating route after GPS origin set (destination existed)...");
                await calculateRoute(newMarker, destinationMarker);
            }

        } catch (markerOrGeocodeError: any) {
             console.error('Error adding GPS marker or reverse geocoding:', markerOrGeocodeError);
             gpsToast.update({ id: gpsToastId.id, variant: 'destructive', title: 'Erreur Affichage Position', description: `Impossible d'afficher ou de nommer votre position sur la carte. ${markerOrGeocodeError.message || ''}` });
             if (newMarker && currentMap.hasLayer(newMarker)) {
                 try { currentMap.removeLayer(newMarker); } catch (removeError) { console.warn("Error removing failed GPS marker:", removeError); }
                 setOriginMarker(null);
             }
             setOrigin(`Coordonnées: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
             currentMap.setView([coords.lat, coords.lng], 15);
             console.log("Setting click mode to 'none' after GPS marker error."); 
             setClickMode('none');
        }


    } catch (error: any) {
      console.error('Error accessing GPS location:', error);
       setHasGpsPermission(false);
       setIsGpsDialogOpen(false); // Ensure dialog closes on error too
       setCurrentLocation(null);

      let description = 'Une erreur s’est produite lors de la récupération de votre position.';
       if (error.code === error.PERMISSION_DENIED) {
           description = 'Veuillez autoriser l’accès GPS dans les paramètres de votre navigateur pour utiliser cette fonction.';
       } else if (error.code === error.POSITION_UNAVAILABLE) {
           description = 'Votre position actuelle n’est pas disponible. Vérifiez vos paramètres de localisation.';
       } else if (error.code === error.TIMEOUT) {
           description = 'La demande de géolocalisation a expiré. Veuillez réessayer.';
       } else if (error.message) {
           description = error.message;
       }
      
      gpsToast.update({
          id: gpsToastId.id,
          variant: 'destructive',
          title: error.code === error.PERMISSION_DENIED ? 'Accès GPS Refusé' : 'Erreur GPS',
          description: description,
      });
    }
  };


    const resetFullMap = () => {
        console.log("Resetting full map state: inputs, markers, route, view.");
        const currentMap = mapRef.current;
        if (currentMap && LRef.current) {
           resetMapStateForNewOrigin();
           setOrigin('');
           setDestination('');
           currentMap.setView([defaultLocation.lat, defaultLocation.lng], 10);
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
       ref.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
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

  const handleUseCurrentLocation = async () => {
      console.log("'Use Current Location' button clicked.");
     if (!mapRef.current || !LRef.current) {
      console.warn("Cannot use current location: Map not ready.");
      return;
    }
     // First, check/request permission.
     const permissionGranted = await checkGpsPermission(true); // promptUserIfNeeded = true

     if (permissionGranted === true) { // Explicitly true, not null
         await getCurrentLocationAndSetOrigin();
     } else if (permissionGranted === false) {
         // Permission denied, toast is handled by checkGpsPermission or getCurrentLocationAndSetOrigin
     } else {
         // Permission is 'prompt' (null), dialog is open. User will interact with dialog.
     }
  };

   const handleAddressSearch = async (type: 'origin' | 'destination') => {
       console.log(`Handling address search for: ${type}`);
       const currentMap = mapRef.current;
       if (!currentMap || !LRef.current || !originIcon || !destinationIcon) {
            console.error("Cannot search address: Map, Leaflet, or icons not ready.", { mapReady: !!currentMap, LReady: !!LRef.current, iconsReady: !!originIcon && !!destinationIcon });
           toast({ variant: "destructive", title: "Carte non prête", description: "La carte ou ses composants ne sont pas encore initialisés." });
           return;
       }
       const L = LRef.current;
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
           const { lat, lng, displayName } = result;
           const iconToUse = type === 'origin' ? originIcon : destinationIcon;
           let markerRef = type === 'origin' ? originMarker : destinationMarker;
           const setMarkerState = type === 'origin' ? setOriginMarker : setDestinationMarker;
           const setAddressState = type === 'origin' ? setOrigin : setDestination;

           if (markerRef && currentMap.hasLayer(markerRef)) {
               console.log(`Removing previous ${type} marker.`);
               try { currentMap.removeLayer(markerRef); } catch (error) { console.warn(`Error removing ${type} marker:`, error); }
           }
            if (routeLine && currentMap.hasLayer(routeLine)) {
                console.log(`Removing route line because ${type} changed via search.`);
               try { currentMap.removeLayer(routeLine); } catch (error) { console.warn("Error removing route line:", error); }
               setRouteLine(null);
           }

           let newMarker: L.Marker | null = null;
           try {
                console.log(`Adding new ${type} marker at (${lat}, ${lng}).`);
                if (!iconToUse) throw new Error(`${type} icon is not loaded`);
                newMarker = L.marker([lat, lng], { icon: iconToUse })
                   .addTo(currentMap)
                   .bindPopup(`${type === 'origin' ? 'Départ' : 'Destination'}: ${displayName.split(',')[0]}`)
                   .openPopup();

               setMarkerState(newMarker);
               setAddressState(displayName);

               currentMap.setView([lat, lng], 15);

               const otherMarkerExists = type === 'origin' ? !!destinationMarker : !!originMarker;
               if (!otherMarkerExists) {
                    const nextMode = type === 'origin' ? 'destination' : 'origin';
                    console.log(`Setting click mode to '${nextMode}' after ${type} search.`);
                    setClickMode(nextMode);
                    toast({ title: `${type === 'origin' ? 'Point de Départ' : 'Destination'} Trouvé`, description: `Sélectionnez maintenant ${nextMode === 'origin' ? 'le point de départ' : 'la destination'} sur la carte ou via la recherche.`});
               } else {
                   console.log(`Deactivating click mode after ${type} search (both points exist).`);
                   setClickMode('none');
               }


                const currentOriginMarker = type === 'origin' ? newMarker : originMarker;
                const currentDestinationMarker = type === 'destination' ? newMarker : destinationMarker;
                 if (currentOriginMarker && currentDestinationMarker) {
                     console.log(`Calculating route after ${type} search (both markers exist).`);
                     await calculateRoute(currentOriginMarker, currentDestinationMarker);
                 }

           } catch (error: any) {
               console.error(`Error adding marker for ${type} search:`, error);
               toast({ variant: 'destructive', title: `Erreur Marqueur ${type === 'origin' ? 'Départ' : 'Destination'}`, description: `Impossible d'ajouter le marqueur pour ${address}. ${error.message || ''}` });
               if (newMarker && currentMap.hasLayer(newMarker)) {
                    try { currentMap.removeLayer(newMarker); } catch (removeError) { console.warn("Error removing failed search marker:", removeError); }
               }
               setMarkerState(null);
               setClickMode('none');
           }

       } else {
            console.warn(`Address search failed for ${type}: "${address}"`);
       }
    };



  return (
    <TooltipProvider delayDuration={100}>
      <div>
        <div id="map" style={mapContainerStyle} className="rounded-md shadow-md mb-4" />

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
              background-color: #eee;
              z-index: 0;
              position: relative;
            }
            #map.leaflet-container {
                cursor: crosshair !important;
            }
            .leaflet-container {
                width: 100%;
                height: 400px;
                visibility: visible;
            }
        `}</style>

        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-semibold mb-4 text-center md:text-left">Snack et Restauration</h1>

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
                           className={clickMode === 'origin' ? 'text-primary ring-2 ring-primary rounded-full' : ''}
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

              <div className="mb-4">
                <label htmlFor="destination" className="block text-sm font-medium text-foreground mb-1">
                  Adresse de destination
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="destination"
                    type="text"
                    className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md pr-20"
                    placeholder="Entrer l'adresse ou cliquer sur la carte"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    ref={destinationInputRef}
                     onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')}
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
                           className={clickMode === 'destination' ? 'text-primary ring-2 ring-primary rounded-full' : ''}
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

               <div className="flex gap-2 flex-wrap">
                <Button onClick={() => calculateRoute()} disabled={!originMarker || !destinationMarker}>
                  {routeLine ? 'Recalculer l\'Itinéraire' : 'Calculer l\'Itinéraire'}
                </Button>
                <Button onClick={resetFullMap} variant="secondary">Réinitialiser Carte</Button>
              </div>
            </div>

            <div className="w-full md:w-1/2 mt-4 md:mt-0">
              {hasGpsPermission === false && (
                <Alert variant="destructive">
                  <Locate className="h-4 w-4" />
                  <AlertTitle>Accès GPS Refusé/Indisponible</AlertTitle>
                  <AlertDescription>
                     L'accès à votre position est désactivé ou non disponible. Vous pouvez essayer de
                     <Button variant="link" className="p-0 h-auto ml-1 text-destructive underline" onClick={() => handleUseCurrentLocation()}>
                        l'activer
                    </Button>
                     , ou définir le point de départ manuellement sur la carte ou par recherche.
                  </AlertDescription>
                </Alert>
              )}
               {hasGpsPermission === null && !isGpsDialogOpen && (
                <Alert>
                    <Locate className="h-4 w-4" />
                     <AlertTitle>Autorisation GPS Requise</AlertTitle>
                     <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center">
                        Pour utiliser votre position actuelle comme point de départ, veuillez utiliser l'icône GPS à côté du champ 'Adresse de ramassage' pour l'activer.
                         . Sinon, définissez le départ manuellement.
                     </AlertDescription>
                 </Alert>
                )}
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
                        <AlertDialogCancel onClick={() => handleGpsPermissionResponse(false)}>
                            Non, spécifier manuellement
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleGpsPermissionResponse(true)}>
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

