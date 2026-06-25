'use client';

import { useState, useEffect, useRef } from 'react';
import { createReport } from '@/lib/api';
import { useView } from '@/context/ViewContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Camera, 
    Video, 
    Paperclip, 
    X, 
    Image as ImageIcon, 
    MapPin, 
    Calendar, 
    AlertTriangle, 
    FileText, 
    Check, 
    ArrowRight, 
    ArrowLeft, 
    Send, 
    Navigation, 
    Sparkles, 
    Trash2 
} from 'lucide-react';

interface PreviewFile {
    file: File;
    url: string;
    type: 'image' | 'video';
}

export default function ReportCreateView() {
    const { setView } = useView();
    
    // Formulaire consolidé sur une page unique
    
    // État local pour les champs textuels du formulaire
    const [formData, setFormData] = useState({
        severity: 'low',
        incident_type: 'dangerous_situation',
        location: '',
        description: '',
        incident_date: '',
    });

    // Fichiers sélectionnés avec leurs URLs d'aperçu
    const [attachedFiles, setAttachedFiles] = useState<PreviewFile[]>([]);
    
    // Pour la gestion du glisser-déposer
    const [isDragOver, setIsDragOver] = useState(false);
    
    // Indicateur de présence d'un brouillon à restaurer
    const [hasDraft, setHasDraft] = useState(false);
    const [geolocating, setGeolocating] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // États pour le support du géocodage et de l'autocomplétion
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchingSuggestions, setSearchingSuggestions] = useState(false);
    const [isManualTyping, setIsManualTyping] = useState(false);

    // États pour le support de la carte Leaflet
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [mapAddress, setMapAddress] = useState('');
    const [mapSearchQuery, setMapSearchQuery] = useState('');
    const [mapSearchSuggestions, setMapSearchSuggestions] = useState<any[]>([]);
    const [isSearchingMap, setIsSearchingMap] = useState(false);

    const [googleLoaded, setGoogleLoaded] = useState(false);

    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [mapLayerType, setMapLayerType] = useState<'streets' | 'satellite'>('streets');
    const streetsLayerRef = useRef<any>(null);
    const satelliteLayerRef = useRef<any>(null);

    // Chargement dynamique de Google Maps Places API
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!googleMapsApiKey) {
            console.log("Clé Google Maps absente. Repli automatique sur Photon API.");
            return;
        }

        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
            setGoogleLoaded(true);
            return;
        }

        const existingScript = document.getElementById('google-maps-places-sdk');
        if (existingScript) {
            existingScript.addEventListener('load', () => setGoogleLoaded(true));
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-places-sdk';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&language=fr`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            setGoogleLoaded(true);
        };
        script.onerror = () => {
            console.error("Erreur lors du chargement de l'API Google Maps");
        };
        document.head.appendChild(script);
    }, []);

    // Chargement dynamique de Leaflet depuis le CDN
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if ((window as any).L) {
            setLeafletLoaded(true);
            return;
        }

        // Ajouter la feuille de style Leaflet dans le head
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);

        // Ajouter le script Leaflet
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';
        script.onload = () => {
            const L = (window as any).L;
            if (L) {
                // Configurer les icônes de marqueurs par défaut avec les assets CDN de Leaflet
                const DefaultIcon = L.icon({
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });
                L.Marker.prototype.options.icon = DefaultIcon;
                setLeafletLoaded(true);
            }
        };
        document.body.appendChild(script);
    }, []);

    // Vérifie si un brouillon existe dans le localStorage au montage
    useEffect(() => {
        const draft = localStorage.getItem('report_create_draft');
        if (draft) {
            setHasDraft(true);
        }
    }, []);

    // Sauvegarde automatique des données textuelles à chaque changement
    useEffect(() => {
        if (formData.location || formData.description || formData.incident_date) {
            localStorage.setItem('report_create_draft', JSON.stringify(formData));
        }
    }, [formData]);

    // Libère les URLs d'aperçu pour éviter les fuites de mémoire
    useEffect(() => {
        return () => {
            attachedFiles.forEach(file => URL.revokeObjectURL(file.url));
        };
    }, []);

    // Recherche d'adresses en temps réel pour l'autocomplétion (Google Maps ou Photon API)
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (formData.location.trim().length > 3 && isManualTyping) {
                setSearchingSuggestions(true);

                // Cas 1 : Google Maps est chargé
                if (googleLoaded && (window as any).google?.maps?.places) {
                    try {
                        const autocompleteService = new (window as any).google.maps.places.AutocompleteService();
                        const request: any = {
                            input: formData.location,
                            componentRestrictions: { country: 'fr' },
                        };
                        
                        // Ajouter un biais de localisation si les coordonnées sont disponibles
                        if (mapCoords) {
                            request.location = new (window as any).google.maps.LatLng(mapCoords.lat, mapCoords.lng);
                            request.radius = 20000; // 20km
                        }

                        autocompleteService.getPlacePredictions(request, (predictions: any[], status: any) => {
                            if (status === 'OK' && predictions) {
                                const formatted = predictions.map((pred: any) => {
                                    const mainText = pred.structured_formatting?.main_text || '';
                                    const secondaryText = pred.structured_formatting?.secondary_text || '';
                                    return {
                                        display_name: pred.description,
                                        name: mainText,
                                        road: '',
                                        city: secondaryText,
                                        place_id: pred.place_id,
                                        source: 'google'
                                    };
                                });
                                setSuggestions(formatted);
                                setShowSuggestions(formatted.length > 0);
                                setSearchingSuggestions(false);
                            } else {
                                fetchPhoton(formData.location);
                            }
                        });
                    } catch (err) {
                        console.error("Erreur d'autocomplétion Google Maps:", err);
                        fetchPhoton(formData.location);
                    }
                } else {
                    // Cas 2 : Utilisation de l'API Photon
                    fetchPhoton(formData.location);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 500); // Debounce de 500ms

        const fetchPhoton = async (query: string) => {
            try {
                let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=fr`;
                if (mapCoords) {
                    url += `&lat=${mapCoords.lat}&lon=${mapCoords.lng}`;
                }
                url += `&filter=countrycode:FR`;

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    const formatted = data.features.map((feature: any) => {
                        const props = feature.properties;
                        const coords = feature.geometry.coordinates; // [lon, lat]
                        
                        const name = props.name || '';
                        const street = props.street || '';
                        const postcode = props.postcode || '';
                        const city = props.city || '';
                        
                        let display_name = name;
                        if (street && name !== street) display_name += `, ${street}`;
                        if (postcode || city) {
                            display_name += ` (${postcode} ${city})`.replace('()', '');
                        }

                        return {
                            display_name: display_name,
                            name: name,
                            road: street,
                            city: city,
                            lat: coords[1].toString(),
                            lon: coords[0].toString(),
                            source: 'photon'
                        };
                    });
                    setSuggestions(formatted);
                    setShowSuggestions(formatted.length > 0);
                } else {
                    fetchNominatim(query);
                }
            } catch (err) {
                console.error("Erreur Photon API:", err);
                fetchNominatim(query);
            } finally {
                setSearchingSuggestions(false);
            }
        };

        const fetchNominatim = async (query: string) => {
            try {
                let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=fr&limit=5&addressdetails=1`;
                if (mapCoords) {
                    const offset = 0.15;
                    const left = mapCoords.lng - offset;
                    const right = mapCoords.lng + offset;
                    const bottom = mapCoords.lat - offset;
                    const top = mapCoords.lat + offset;
                    url += `&viewbox=${left},${top},${right},${bottom}`;
                }
                const response = await fetch(url, {
                    headers: {
                        'Accept-Language': 'fr-FR,fr;q=0.9',
                        'User-Agent': 'WebMASE-App'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    const formatted = data.map((item: any) => ({
                        display_name: item.display_name,
                        name: item.name || '',
                        road: item.address?.road || '',
                        city: item.address?.city || item.address?.town || item.address?.village || '',
                        lat: item.lat,
                        lon: item.lon,
                        source: 'nominatim'
                    }));
                    setSuggestions(formatted);
                    setShowSuggestions(formatted.length > 0);
                }
            } catch (err) {
                console.error("Erreur Nominatim fallback:", err);
            } finally {
                setSearchingSuggestions(false);
            }
        };

        return () => clearTimeout(delayDebounceFn);
    }, [formData.location, isManualTyping, mapCoords, googleLoaded]);

    // Restaure les données du brouillon
    const restoreDraft = () => {
        try {
            const draft = localStorage.getItem('report_create_draft');
            if (draft) {
                const parsed = JSON.parse(draft);
                setFormData(parsed);
                setHasDraft(false);
            }
        } catch (e) {
            console.error('Erreur de restauration du brouillon:', e);
        }
    };

    // Supprime le brouillon
    const discardDraft = () => {
        localStorage.removeItem('report_create_draft');
        setHasDraft(false);
    };

    // Récupère les détails de coordonnées GPS pour un place_id Google Maps
    const getGooglePlaceDetails = (placeId: string): Promise<{ lat: number; lng: number }> => {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !(window as any).google) {
                reject("Google Maps SDK non chargé");
                return;
            }
            try {
                const container = document.createElement('div');
                const service = new (window as any).google.maps.places.PlacesService(container);
                service.getDetails({
                    placeId: placeId,
                    fields: ['geometry']
                }, (place: any, status: any) => {
                    if (status === 'OK' && place?.geometry?.location) {
                        resolve({
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng()
                        });
                    } else {
                        reject(`Erreur Place Details : ${status}`);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    };

    // Géocodage inverse unifié (coordonnées vers adresse textuelle précise)
    const performReverseGeocode = async (lat: number, lng: number): Promise<string> => {
        if (googleLoaded && (window as any).google?.maps) {
            try {
                const geocoder = new (window as any).google.maps.Geocoder();
                const address = await new Promise<string>((resolve, reject) => {
                    geocoder.geocode({ location: { lat, lng } }, (results: any[], status: any) => {
                        if (status === 'OK' && results && results[0]) {
                            resolve(results[0].formatted_address);
                        } else {
                            reject(`Google reverse geocoding status: ${status}`);
                        }
                    });
                });
                return address;
            } catch (err) {
                console.warn("Erreur géocodage inverse Google:", err);
            }
        }

        try {
            const response = await fetch(`https://photon.komoot.io/reverse/?lon=${lng}&lat=${lat}`);
            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    const props = data.features[0].properties;
                    const name = props.name || '';
                    const street = props.street || '';
                    const postcode = props.postcode || '';
                    const city = props.city || '';
                    
                    let display_name = name;
                    if (street && name !== street) display_name += `, ${street}`;
                    if (postcode || city) {
                        display_name += ` (${postcode} ${city})`.replace('()', '');
                    }
                    return display_name;
                }
            }
        } catch (err) {
            console.warn("Erreur géocodage inverse Photon API:", err);
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'Accept-Language': 'fr-FR,fr;q=0.9',
                        'User-Agent': 'WebMASE-App'
                    }
                }
            );
            if (response.ok) {
                const data = await response.json();
                if (data.address) {
                    const name = data.name || '';
                    const road = data.address.road || data.address.pedestrian || data.address.suburb || '';
                    const city = data.address.city || data.address.town || data.address.village || '';
                    if (name && name !== road) {
                        return `${name} - ${road}, ${city}`;
                    } else if (road && city) {
                        return `${road}, ${city}`;
                    }
                }
                return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            }
        } catch (err) {
            console.warn("Erreur géocodage inverse Nominatim:", err);
        }

        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            let address = await performReverseGeocode(lat, lng);
            if (address.length > 180) {
                address = address.substring(0, 177) + '...';
            }
            setMapAddress(address);
        } catch (err) {
            console.error("Erreur de géocodage inverse sur la carte:", err);
        }
    };

    // Initialisation de la carte Leaflet lorsque le modal s'ouvre
    useEffect(() => {
        if (!isMapOpen || !leafletLoaded || !mapContainerRef.current) return;

        const L = (window as any).L;
        if (!L) return;

        // Déterminer les coordonnées initiales de centrage
        let initialLat = 51.0348;
        let initialLng = 2.3768;
        let hasCoords = false;

        // Essayer de lire depuis formData.location si elle contient des coordonnées lat/lng
        const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
        const match = formData.location.match(coordRegex);
        if (match) {
            initialLat = parseFloat(match[1]);
            initialLng = parseFloat(match[2]);
            hasCoords = true;
        } else if (mapCoords) {
            initialLat = mapCoords.lat;
            initialLng = mapCoords.lng;
            hasCoords = true;
        }

        // Créer l'instance de la carte immédiatement
        const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 15);
        mapRef.current = map;

        // Ajouter le marqueur déplaçable
        const marker = L.marker([initialLat, initialLng], {
            draggable: true
        }).addTo(map);
        markerRef.current = marker;

        // Effectuer un géocodage inverse initial
        setMapCoords({ lat: initialLat, lng: initialLng });
        reverseGeocode(initialLat, initialLng);

        // Si aucune coordonnée n'était pré-enregistrée, interroger immédiatement le GPS de l'appareil
        // et centrer automatiquement la carte dessus une fois résolu.
        if (!hasCoords && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    if (accuracy) {
                        setLocationAccuracy(accuracy);
                    }
                    const resolvedCoords = { lat: latitude, lng: longitude };
                    setMapCoords(resolvedCoords);
                    map.setView([latitude, longitude], 16);
                    marker.setLatLng([latitude, longitude]);
                    reverseGeocode(latitude, longitude);
                },
                (err) => {
                    console.warn("Géolocalisation automatique au démarrage de la carte échouée:", err);
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        }

        // Événement clic sur la carte pour déplacer le marqueur
        map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            setMapCoords({ lat, lng });
            reverseGeocode(lat, lng);
        });

        // Événement dragend sur le marqueur
        marker.on('dragend', () => {
            const position = marker.getLatLng();
            setMapCoords({ lat: position.lat, lng: position.lng });
            reverseGeocode(position.lat, position.lng);
        });

        // Écouter le redimensionnement de la fenêtre pour rafraîchir constamment le rendu de la carte
        const handleResize = () => {
            if (mapRef.current) {
                mapRef.current.invalidateSize();
            }
        };
        window.addEventListener('resize', handleResize);

        // Lancer un intervalle temporaire pour invalider la taille de la carte pendant l'ouverture/animation du modal
        const sizeInterval = setInterval(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 150);

        // Arrêter l'intervalle après 1,5 seconde (fin de toute animation possible)
        const sizeTimeout = setTimeout(() => {
            clearInterval(sizeInterval);
        }, 1500);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearInterval(sizeInterval);
            clearTimeout(sizeTimeout);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            markerRef.current = null;
            streetsLayerRef.current = null;
            satelliteLayerRef.current = null;
        };
    }, [isMapOpen, leafletLoaded]);

    // Gestion dynamique du basculement des couches de tuiles (Plan vs Satellite)
    useEffect(() => {
        if (!mapRef.current || !isMapOpen) return;
        const L = (window as any).L;
        if (!L) return;

        // Supprimer l'ancienne couche si existante
        if (streetsLayerRef.current) {
            mapRef.current.removeLayer(streetsLayerRef.current);
            streetsLayerRef.current = null;
        }
        if (satelliteLayerRef.current) {
            mapRef.current.removeLayer(satelliteLayerRef.current);
            satelliteLayerRef.current = null;
        }

        if (mapLayerType === 'streets') {
            streetsLayerRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google Maps',
                maxZoom: 20
            }).addTo(mapRef.current);
        } else {
            satelliteLayerRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google Maps',
                maxZoom: 20
            }).addTo(mapRef.current);
        }
    }, [mapLayerType, isMapOpen, leafletLoaded]);

    // Mise à jour automatique de l'infobulle (popup) sur le marqueur pour afficher l'adresse en direct
    useEffect(() => {
        if (markerRef.current && mapAddress) {
            markerRef.current.closePopup();
            markerRef.current.unbindPopup();

            markerRef.current.bindPopup(
                `<div style="font-family: inherit; font-size: 11px; font-weight: 700; color: #1e293b; text-align: center; max-width: 180px;">
                    ${mapAddress}
                 </div>`,
                {
                    closeButton: false,
                    autoClose: true,
                    closeOnClick: false
                }
            ).openPopup();
        }
    }, [mapAddress]);

    // Recherche de lieux au sein du modal de carte (Google Maps, Photon API ou Nominatim)
    const handleMapSearch = async () => {
        if (!mapSearchQuery.trim()) return;
        setIsSearchingMap(true);

        if (googleLoaded && (window as any).google?.maps?.places) {
            try {
                const autocompleteService = new (window as any).google.maps.places.AutocompleteService();
                const request: any = {
                    input: mapSearchQuery,
                    componentRestrictions: { country: 'fr' }
                };
                if (mapCoords) {
                    request.location = new (window as any).google.maps.LatLng(mapCoords.lat, mapCoords.lng);
                    request.radius = 20000;
                }
                autocompleteService.getPlacePredictions(request, (predictions: any[], status: any) => {
                    if (status === 'OK' && predictions) {
                        const formatted = predictions.map((pred: any) => ({
                            display_name: pred.description,
                            name: pred.structured_formatting?.main_text || '',
                            road: '',
                            city: pred.structured_formatting?.secondary_text || '',
                            place_id: pred.place_id,
                            source: 'google'
                        }));
                        setMapSearchSuggestions(formatted);
                        setIsSearchingMap(false);
                    } else {
                        fetchMapPhoton(mapSearchQuery);
                    }
                });
            } catch (err) {
                console.error("Erreur de recherche cartographique Google:", err);
                fetchMapPhoton(mapSearchQuery);
            }
        } else {
            fetchMapPhoton(mapSearchQuery);
        }
    };

    const fetchMapPhoton = async (query: string) => {
        try {
            let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=fr`;
            if (mapCoords) {
                url += `&lat=${mapCoords.lat}&lon=${mapCoords.lng}`;
            }
            url += `&filter=countrycode:FR`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                const formatted = data.features.map((feature: any) => {
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates;

                    const name = props.name || '';
                    const street = props.street || '';
                    const postcode = props.postcode || '';
                    const city = props.city || '';

                    let display_name = name;
                    if (street && name !== street) display_name += `, ${street}`;
                    if (postcode || city) {
                        display_name += ` (${postcode} ${city})`.replace('()', '');
                    }

                    return {
                        display_name: display_name,
                        name: name,
                        road: street,
                        city: city,
                        lat: coords[1].toString(),
                        lon: coords[0].toString(),
                        source: 'photon'
                    };
                });
                setMapSearchSuggestions(formatted);
            } else {
                fetchMapNominatim(query);
            }
        } catch (err) {
            console.error("Erreur recherche carte Photon API:", err);
            fetchMapNominatim(query);
        } finally {
            setIsSearchingMap(false);
        }
    };

    const fetchMapNominatim = async (query: string) => {
        try {
            let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=fr&limit=5&addressdetails=1`;
            if (mapCoords) {
                const offset = 0.15;
                const left = mapCoords.lng - offset;
                const right = mapCoords.lng + offset;
                const bottom = mapCoords.lat - offset;
                const top = mapCoords.lat + offset;
                url += `&viewbox=${left},${top},${right},${bottom}`;
            }
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'fr-FR,fr;q=0.9',
                    'User-Agent': 'WebMASE-App'
                }
            });
            if (response.ok) {
                const data = await response.json();
                const formatted = data.map((item: any) => ({
                    display_name: item.display_name,
                    name: item.name || '',
                    road: item.address?.road || '',
                    city: item.address?.city || item.address?.town || item.address?.village || '',
                    lat: item.lat,
                    lon: item.lon,
                    source: 'nominatim'
                }));
                setMapSearchSuggestions(formatted);
            }
        } catch (err) {
            console.error("Erreur recherche carte Nominatim:", err);
        } finally {
            setIsSearchingMap(false);
        }
    };

    // Sélection d'une suggestion de recherche au sein du modal de carte
    const handleSelectMapSuggestion = async (suggestion: any) => {
        let addressString = suggestion.display_name;
        if (addressString.length > 180) {
            addressString = addressString.substring(0, 177) + '...';
        }

        setMapAddress(addressString);
        setMapSearchSuggestions([]);
        setMapSearchQuery('');

        const updateMapMarker = (lat: number, lng: number) => {
            setMapCoords({ lat, lng });
            if (mapRef.current) {
                mapRef.current.setView([lat, lng], 17);
            }
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            }
        };

        if (suggestion.source === 'google' && suggestion.place_id) {
            try {
                const details = await getGooglePlaceDetails(suggestion.place_id);
                updateMapMarker(details.lat, details.lng);
            } catch (err) {
                console.error("Erreur de récupération des coordonnées Google (carte):", err);
            }
        } else if (suggestion.lat && suggestion.lon) {
            const lat = parseFloat(suggestion.lat);
            const lon = parseFloat(suggestion.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                updateMapMarker(lat, lon);
            }
        }
    };

    // Confirme la position sélectionnée sur la carte et ferme le modal
    const handleConfirmMapPosition = () => {
        if (mapAddress) {
            setIsManualTyping(false);
            setFormData(prev => ({
                ...prev,
                location: mapAddress
            }));
        }
        setIsMapOpen(false);
    };

    // Récupère la position géographique de l'utilisateur (utile pour les chantiers extérieurs mobiles)
    const handleGeolocate = () => {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }
        setGeolocating(true);
        setLocationAccuracy(null);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                if (accuracy) {
                    setLocationAccuracy(accuracy);
                }
                setMapCoords({ lat: latitude, lng: longitude });
                setIsManualTyping(false);
                try {
                    let address = await performReverseGeocode(latitude, longitude);
                    if (address.length > 180) {
                        address = address.substring(0, 177) + '...';
                    }
                    setFormData(prev => ({
                        ...prev,
                        location: address
                    }));
                } catch (err) {
                    console.error("Erreur de géocodage lors de la géolocalisation:", err);
                    setFormData(prev => ({
                        ...prev,
                        location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Chantier extérieur)`
                    }));
                } finally {
                    setGeolocating(false);
                }
            },
            (err) => {
                console.error("Erreur de géolocalisation:", err);
                alert("Impossible de récupérer la position GPS. Veuillez renseigner le lieu manuellement.");
                setGeolocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Sélection d'une adresse suggérée
    const handleSelectSuggestion = async (suggestion: any) => {
        let addressString = suggestion.display_name;

        if (addressString.length > 180) {
            addressString = addressString.substring(0, 177) + '...';
        }

        setIsManualTyping(false);
        setFormData(prev => ({
            ...prev,
            location: addressString
        }));
        setShowSuggestions(false);
        setSuggestions([]);

        if (suggestion.source === 'google' && suggestion.place_id) {
            try {
                const details = await getGooglePlaceDetails(suggestion.place_id);
                setMapCoords(details);
            } catch (err) {
                console.error("Erreur de récupération des coordonnées Google:", err);
            }
        } else if (suggestion.lat && suggestion.lon) {
            setMapCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
        }
    };

    // Met à jour les champs de saisie standards
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (e.target.name === 'location') {
            setIsManualTyping(true);
        }
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    // Ajoute des fichiers au tableau de médias attachés
    const addFiles = (files: File[]) => {
        const newFiles: PreviewFile[] = [];
        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            if (isImage || isVideo) {
                newFiles.push({
                    file,
                    url: URL.createObjectURL(file),
                    type: isImage ? 'image' : 'video'
                });
            }
        });

        if (newFiles.length > 0) {
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    // Supprime un média sélectionné
    const removeFile = (index: number) => {
        setAttachedFiles(prev => {
            const fileToRemove = prev[index];
            if (fileToRemove) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    // Gestion du glisser-déposer
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    // Soumission du formulaire
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const MAX_SIZE = 200 * 1024 * 1024; // 200 Mo

        // Séparation des images et vidéos
        const imageFiles = attachedFiles.filter(f => f.type === 'image').map(f => f.file);
        const videoFiles = attachedFiles.filter(f => f.type === 'video').map(f => f.file);

        // Validation des tailles
        for (const fileItem of attachedFiles) {
            if (fileItem.file.size > MAX_SIZE) {
                setError(`Le fichier "${fileItem.file.name}" est trop volumineux (max 200 Mo).`);
                setIsSubmitting(false);
                return;
            }
        }

        try {
            const data = new FormData();
            data.append('severity', formData.severity);
            data.append('incident_type', formData.incident_type);
            data.append('location', formData.location);
            data.append('description', formData.description);
            
            if (!formData.incident_date) {
                setError('Veuillez renseigner la date de l\'incident.');
                setIsSubmitting(false);
                return;
            }
            const incidentDate = new Date(formData.incident_date);
            if (isNaN(incidentDate.getTime())) {
                setError('Date invalide.');
                setIsSubmitting(false);
                return;
            }
            data.append('incident_date', incidentDate.toISOString());

            // Envoi des images
            imageFiles.forEach(imgFile => {
                data.append('photos', imgFile);
            });

            // Envoi de la première vidéo si présente (selon le modèle backend actuel)
            if (videoFiles.length > 0) {
                data.append('video', videoFiles[0]);
            }

            await createReport(data);
            
            // Nettoyage du brouillon et des aperçus
            localStorage.removeItem('report_create_draft');
            attachedFiles.forEach(f => URL.revokeObjectURL(f.url));
            
            setView('report-list');
        } catch (err: any) {
            console.error('Erreur lors de la création du rapport:', err.response?.data || err.message);
            const is413 = err.response?.status === 413 || 
                          (typeof err.response?.data === 'string' && err.response.data.includes('413 Request Entity Too Large')) ||
                          !err.response;

            if (is413) {
                setError('Fichier trop volumineux. Veuillez réduire la taille de vos médias (max. 200 Mo).');
            } else if (err.response?.data) {
                const errorMsg = typeof err.response.data === 'string' 
                    ? (err.response.data.includes('<html') ? 'Erreur serveur.' : err.response.data)
                    : JSON.stringify(err.response.data);
                setError(errorMsg);
            } else {
                setError('Erreur lors de la création du rapport.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Validation globale du formulaire
    const isFormValid = formData.location.trim().length > 0 && 
                        formData.incident_date !== '' && 
                        formData.description.trim().length >= 10;

    // Explications et couleurs pour les niveaux de gravité
    const getSeverityDetails = (sev: string) => {
        switch (sev) {
            case 'low': return { label: 'Faible', desc: 'Risque ou anomalie mineure, presque aucun impact physique.', border: 'border-l-green-500', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)] focus-within:ring-green-500/50' };
            case 'medium': return { label: 'Moyenne', desc: 'Dégât matériel léger ou incident corporel mineur sans arrêt.', border: 'border-l-yellow-500', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)] focus-within:ring-yellow-500/50' };
            case 'high': return { label: 'Élevée', desc: 'Accident avec arrêt de travail ou dégât matériel notable.', border: 'border-l-orange-500', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)] focus-within:ring-orange-500/50' };
            case 'critical': return { label: 'Critique', desc: 'Accident très grave, hospitalisation urgente ou décès.', border: 'border-l-red-600 shadow-[inset_4px_0_0_0_rgba(239,68,68,0.5)]', glow: 'shadow-[0_0_25px_rgba(239,68,68,0.25)] focus-within:ring-red-500/50' };
            default: return { label: sev, desc: '', border: 'border-l-border', glow: '' };
        }
    };

    // Explications des 4 catégories
    const getCategoryDetails = (cat: string) => {
        switch (cat) {
            case 'dangerous_situation': return { label: 'Situation dangereuse', desc: 'Comportement ou état de fait présentant un danger potentiel.' };
            case 'near_miss': return { label: 'Presque accident', desc: 'Événement qui aurait pu causer un accident mais a été évité de justesse.' };
            case 'accident': return { label: 'Accident', desc: 'Événement soudain ayant provoqué une blessure ou un dégât matériel.' };
            case 'fatal_accident': return { label: 'Accident mortel', desc: 'Accident du travail d\'une gravité majeure ayant entraîné un décès.' };
            default: return { label: cat, desc: '' };
        }
    };

    const activeSeverity = getSeverityDetails(formData.severity);
    const activeCategory = getCategoryDetails(formData.incident_type);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 text-foreground">
            
            {/* Bannière de Restauration de Brouillon */}
            {hasDraft && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/60 backdrop-blur-md rounded-2xl border border-blue-200 dark:border-blue-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-foreground">Brouillon en cours trouvé</h4>
                            <p className="text-xs text-muted-foreground">Vous avez un rapport non validé enregistré localement.</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={restoreDraft}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow cursor-pointer w-full sm:w-auto border-0"
                        >
                            Restaurer
                        </button>
                        <button 
                            onClick={discardDraft}
                            className="px-3 py-1.5 bg-input dark:bg-secondary hover:bg-secondary dark:hover:bg-muted text-xs font-semibold rounded-lg border border-border cursor-pointer w-full sm:w-auto text-foreground hover:text-primary transition-colors"
                        >
                            Ignorer
                        </button>
                    </div>
                </div>
            )}

            {/* Container Principal du Formulaire */}
            <div className={`bg-secondary/50 dark:bg-secondary/80 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-2xl border border-border transition-all duration-300 border-l-4 ${activeSeverity.border} ${activeSeverity.glow}`}>
                
                {/* En-tête */}
                <div className="mb-8 border-b border-border pb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent uppercase">
                            Déclarer une remontée
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1">Formulaire de sécurité obligatoire conforme aux normes MASE.</p>
                    </div>
                    <button
                        onClick={() => setView('report-list')}
                        className="text-xs text-muted-foreground hover:text-primary border border-border hover:bg-secondary px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-transparent"
                    >
                        Retour historique
                    </button>
                </div>

                {/* Indicateur d'Étapes supprimé - Formulaire en page unique */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* 1. TYPE DE REMONTÉE (CATÉGORIE) */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-foreground">
                            Type de Remontée (Catégorie) *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { id: 'dangerous_situation', label: 'Situation dangereuse', color: 'border-yellow-500/30 dark:border-yellow-500/20 hover:border-yellow-500 text-yellow-600 dark:text-yellow-400' },
                                { id: 'near_miss', label: 'Presque accident', color: 'border-orange-500/30 dark:border-orange-500/20 hover:border-orange-500 text-orange-600 dark:text-orange-400' },
                                { id: 'accident', label: 'Accident', color: 'border-red-500/30 dark:border-red-500/20 hover:border-red-500 text-red-600 dark:text-red-400' },
                                { id: 'fatal_accident', label: 'Accident mortel', color: 'border-red-700/30 dark:border-red-900/40 hover:border-red-600 text-red-700 dark:text-red-500 bg-red-500/5 dark:bg-red-950/10' }
                            ].map((cat) => {
                                const isSelected = formData.incident_type === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                            const severityMapping: Record<string, string> = {
                                                dangerous_situation: 'low',
                                                near_miss: 'medium',
                                                accident: 'high',
                                                fatal_accident: 'critical'
                                            };
                                            setFormData(prev => ({
                                                ...prev,
                                                incident_type: cat.id,
                                                severity: severityMapping[cat.id] || 'low'
                                            }));
                                        }}
                                        className={`p-3 rounded-xl border text-left text-sm font-semibold transition-all duration-200 flex justify-between items-center cursor-pointer ${
                                            isSelected 
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg scale-[1.02]' 
                                                : `bg-input text-foreground border-border hover:bg-secondary/40 ${cat.color}`
                                        }`}
                                    >
                                        <span>{cat.label}</span>
                                        {isSelected && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground italic bg-secondary/55 p-2 rounded-lg border border-border/50">
                            💡 {activeCategory.desc}
                        </p>
                    </div>

                    {/* 2. INFOS GÉOGRAPHIQUES ET TEMPORELLES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Lieu de l'incident */}
                        <div className="relative">
                            <label className="block text-sm font-bold mb-2 flex justify-between items-center text-foreground">
                                <span>Lieu ou Nom du Chantier *</span>
                                <div className="flex flex-wrap gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsMapOpen(true)}
                                        className="text-[10px] text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 flex items-center gap-0.5 cursor-pointer bg-green-500/10 hover:bg-green-500/20 px-2 py-0.5 rounded-lg border border-green-500/20"
                                    >
                                        <MapPin className="w-2.5 h-2.5" />
                                        Carte
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGeolocate}
                                        disabled={geolocating}
                                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-lg border border-blue-500/20"
                                    >
                                        <Navigation className={`w-2.5 h-2.5 ${geolocating ? 'animate-spin' : ''}`} />
                                        GPS
                                    </button>
                                </div>
                            </label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                required
                                maxLength={200}
                                autoComplete="off"
                                className="w-full p-2.5 rounded-xl bg-input text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-muted-foreground text-sm"
                                placeholder="Ex: Chantier X - Autoroute A13..."
                            />
                            
                            {locationAccuracy && locationAccuracy > 50 && !isManualTyping && (
                                <button
                                    type="button"
                                    onClick={() => setIsMapOpen(true)}
                                    className="w-full text-left text-[10px] text-orange-600 dark:text-orange-400 mt-1.5 flex items-center justify-between gap-1 bg-orange-500/10 border border-orange-500/25 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-orange-500/15 transition-all"
                                >
                                    <span className="flex items-center gap-1">
                                        ⚠️ Précision (+/- {Math.round(locationAccuracy)}m).
                                    </span>
                                    <span className="font-bold underline">
                                        Ajuster ➔
                                    </span>
                                </button>
                            )}

                            {/* Menu de suggestions (Google Maps / Photon API / Nominatim Autocomplete) */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-[110] left-0 right-0 mt-1 bg-secondary border border-border rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-border/40 backdrop-blur-md">
                                    {suggestions.map((suggestion, idx) => {
                                        const name = suggestion.name || '';
                                        const road = suggestion.road || '';
                                        const city = suggestion.city || '';
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSelectSuggestion(suggestion)}
                                                className="w-full text-left p-3 hover:bg-muted/50 transition-colors text-xs text-foreground cursor-pointer flex flex-col gap-0.5 border-none bg-transparent"
                                            >
                                                {name && name !== road && (
                                                    <span className="font-bold text-primary">{name}</span>
                                                )}
                                                <span className="text-foreground/90">
                                                    {road ? `${road}, ` : ''}{city}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                    {suggestion.display_name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Date & Heure */}
                        <div>
                            <label className="block text-sm font-bold mb-2 flex items-center gap-1.5 text-foreground">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                Date & Heure de l'incident *
                            </label>
                            <input
                                type="datetime-local"
                                name="incident_date"
                                value={formData.incident_date}
                                onChange={handleChange}
                                required
                                className="w-full p-2.5 rounded-xl bg-input text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* 3. EXPLICATION DÉTAILLÉE */}
                    <div>
                        <label className="block text-sm font-bold mb-2 flex justify-between items-center text-foreground">
                            <span>Explication détaillée (Qu'est-ce qu'il s'est passé ?) *</span>
                            <span className={`text-xs ${formData.description.length >= 450 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                                {formData.description.length} / 500
                            </span>
                        </label>
                        <div className="relative">
                            <span className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
                                <FileText className="w-4 h-4" />
                            </span>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                required
                                maxLength={500}
                                rows={4}
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-input text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-muted-foreground text-sm"
                                placeholder="Décrivez précisément les faits, les équipements concernés, les mesures immédiates de protection prises..."
                            />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Minimum 10 caractères. Soyez le plus factuel possible.</span>
                    </div>

                    {/* 4. PREUVES ET MÉDIAS JOINTS */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-foreground">
                            Photos & Vidéos de preuve (Facultatif)
                        </label>
                        
                        {/* Zone Drag & Drop */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('media-upload-form')?.click()}
                            className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                                isDragOver 
                                    ? 'bg-blue-500/10 dark:bg-blue-600/10 border-blue-500 scale-[1.01]' 
                                    : 'bg-background dark:bg-secondary/20 border-primary/30 dark:border-primary/20 hover:border-primary hover:bg-secondary/20'
                            }`}
                        >
                            <input
                                id="media-upload-form"
                                type="file"
                                multiple
                                accept="image/*,video/*"
                                onChange={(e) => {
                                    if (e.target.files) {
                                        addFiles(Array.from(e.target.files));
                                    }
                                }}
                                className="hidden"
                            />
                            
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className="p-3 bg-secondary/50 dark:bg-input border border-border dark:border-border rounded-full text-blue-500 shadow-sm group-hover:scale-110 transition-transform">
                                    <Camera className="w-6 h-6 text-blue-500 animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-foreground">Glissez vos photos/vidéos ici ou cliquez pour importer</p>
                                    <p className="text-xs text-muted-foreground mt-1">Formats : Images (PNG, JPEG) et Vidéos (MP4, MOV) - Max 200 Mo</p>
                                </div>
                            </div>
                        </div>

                        {/* Prévisualisations des miniatures */}
                        {attachedFiles.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                                {attachedFiles.map((fileObj, idx) => (
                                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center shadow-md">
                                        {fileObj.type === 'image' ? (
                                            <img src={fileObj.url} className="object-cover w-full h-full" alt="Miniature" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full">
                                                <Video className="w-8 h-8 text-blue-500" />
                                                <span className="text-[9px] text-muted-foreground truncate w-full mt-1">{fileObj.file.name}</span>
                                            </div>
                                        )}
                                        
                                        {/* Hover overlay de suppression */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                                className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer border-none"
                                                title="Supprimer le fichier"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pied de formulaire : Bouton de validation */}
                    <div className="border-t border-border pt-4 mt-6">
                        <button
                            type="submit"
                            disabled={isSubmitting || !isFormValid}
                            className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl border-none transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg uppercase tracking-wider"
                        >
                            {isSubmitting ? (
                                <>Enregistrement en cours...</>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Envoyer la remontée
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Modal de Carte Leaflet pour géolocalisation précise */}
            {isMapOpen && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setIsMapOpen(false)}
                >
                    <div 
                        className="bg-background text-foreground border border-border w-full max-w-2xl rounded-3xl shadow-2xl p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* En-tête */}
                        <div className="flex justify-between items-center border-b border-border pb-4">
                            <div>
                                <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-green-500" />
                                    Positionnement sur la carte
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Faites glisser le marqueur ou recherchez un lieu précis.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMapOpen(false)}
                                className="p-1.5 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Barre de recherche dans le modal */}
                        <div className="relative flex flex-col sm:flex-row gap-2 z-[30]">
                            <div className="relative flex-grow">
                                <input
                                    type="text"
                                    placeholder="Rechercher une entreprise, rue, POI (ex: Rue de l'Albeck)..."
                                    value={mapSearchQuery}
                                    onChange={(e) => setMapSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleMapSearch();
                                        }
                                    }}
                                    className="w-full p-2.5 rounded-xl bg-input text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                />
                                {mapSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMapSearchQuery('');
                                            setMapSearchSuggestions([]);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer border-0 bg-transparent"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleMapSearch}
                                    disabled={isSearchingMap}
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 flex-grow sm:flex-grow-0"
                                >
                                    {isSearchingMap ? '...' : 'Rechercher'}
                                </button>
                                
                                {/* Sélecteur de type de carte (Plan / Satellite) */}
                                <div className="flex items-center bg-secondary border border-border rounded-xl p-0.5 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setMapLayerType('streets')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                            mapLayerType === 'streets'
                                                ? 'bg-blue-600 text-white shadow'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Plan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMapLayerType('satellite')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                            mapLayerType === 'satellite'
                                                ? 'bg-blue-600 text-white shadow'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Satellite
                                    </button>
                                </div>
                            </div>

                            {/* Suggestions de recherche */}
                            {mapSearchSuggestions.length > 0 && (
                                <div className="absolute z-[1000] top-full left-0 right-0 mt-1 bg-secondary border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-border/40">
                                    {mapSearchSuggestions.map((suggestion, idx) => {
                                        const name = suggestion.name || '';
                                        const road = suggestion.road || '';
                                        const city = suggestion.city || '';
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSelectMapSuggestion(suggestion)}
                                                className="w-full text-left p-2.5 hover:bg-muted/50 transition-colors text-xs text-foreground cursor-pointer flex flex-col gap-0.5 border-none bg-transparent"
                                            >
                                                {name && name !== road && (
                                                    <span className="font-bold text-primary">{name}</span>
                                                )}
                                                <span className="text-foreground/90">
                                                    {road ? `${road}, ` : ''}{city}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground truncate font-normal">
                                                    {suggestion.display_name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Conteneur de la carte */}
                        <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-inner bg-muted/20">
                            <div 
                                id="leaflet-map-container" 
                                ref={mapContainerRef} 
                                className="w-full h-72 z-10"
                            />
                        </div>

                        {/* Adresse résolue en bas */}
                        <div className="p-3 bg-secondary/50 rounded-xl border border-border flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Lieu sélectionné
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                                {mapAddress || "Déplacez le marqueur pour obtenir l'adresse..."}
                            </span>
                        </div>

                        {/* Actions de pied de page */}
                        <div className="flex gap-3 justify-end border-t border-border pt-4">
                            <button
                                type="button"
                                onClick={() => setIsMapOpen(false)}
                                className="px-4 py-2 bg-secondary hover:bg-muted border border-border text-foreground text-xs font-bold rounded-xl cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmMapPosition}
                                disabled={!mapAddress}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer border-none"
                            >
                                Confirmer la position
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
