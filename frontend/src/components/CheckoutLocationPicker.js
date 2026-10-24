import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/api';
import MapLocationSearch from './MapLocationSearch';

const MAP_PROVIDERS = {
  openstreetmap: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  google_roadmap: { name: 'Google', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] },
};

const CheckoutLocationPicker = ({ location, onLocationChange, onAddressDetected }) => {
  const [expanded, setExpanded] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  useEffect(() => {
    if (expanded && mapRef.current && !mapInstanceRef.current) {
      setTimeout(() => initMap(), 200);
    }
    return () => {
      if (!expanded && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [expanded]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;
    const provider = MAP_PROVIDERS[mapProvider];
    if (tileLayerRef.current) mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(mapInstanceRef.current);
  }, [mapProvider]);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const lat = location?.lat || 33.8938;
    const lng = location?.lng || 35.5018;
    const zoom = location ? 15 : 9;

    const map = L.map(mapRef.current).setView([lat, lng], zoom);
    mapInstanceRef.current = map;

    const provider = MAP_PROVIDERS[mapProvider];
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(map);

    // Add marker if location exists
    if (location) {
      addMarker(lat, lng, L, map);
    }

    // Click to place marker
    map.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      addMarker(clickLat, clickLng, L, map);
      onLocationChange({ lat: clickLat, lng: clickLng });
      reverseGeocode(clickLat, clickLng);
    });
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const { data } = await api.geocode.reverse(lat, lng);
      if (data && onAddressDetected) {
        onAddressDetected({
          address: data.road || data.address?.split(',')[0] || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
        });
      }
    } catch (e) {
      console.error('Reverse geocode failed:', e);
    }
  };

  const addMarker = (lat, lng, L, map) => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }
    const icon = L.divIcon({
      className: 'checkout-location-marker',
      html: `<div style="background:linear-gradient(135deg,#10b981,#059669);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 10px rgba(16,185,129,0.4);animation:pulse 1.5s infinite;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
    const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      onLocationChange({ lat: pos.lat, lng: pos.lng });
      reverseGeocode(pos.lat, pos.lng);
    });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onLocationChange({ lat, lng });
        setGeoLoading(false);
        reverseGeocode(lat, lng);

        if (!expanded) {
          setExpanded(true);
          // Wait for map to init then center
          setTimeout(() => {
            if (mapInstanceRef.current) {
              const L = window.L;
              mapInstanceRef.current.setView([lat, lng], 15);
              addMarker(lat, lng, L, mapInstanceRef.current);
            }
          }, 400);
        } else if (mapInstanceRef.current) {
          const L = window.L;
          mapInstanceRef.current.setView([lat, lng], 15);
          addMarker(lat, lng, L, mapInstanceRef.current);
        }

        toast.success('Location detected successfully!');
      },
      (error) => {
        setGeoLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Please enable location permissions.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable.');
            break;
          case error.TIMEOUT:
            toast.error('Location request timed out.');
            break;
          default:
            toast.error('Failed to get location.');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );
  };

  const handleLocationSearch = ({ lat, lng }) => {
    onLocationChange({ lat, lng });
    reverseGeocode(lat, lng);
    if (mapInstanceRef.current) {
      const L = window.L;
      mapInstanceRef.current.setView([lat, lng], 16);
      addMarker(lat, lng, L, mapInstanceRef.current);
    }
  };

  const handleClearLocation = () => {
    onLocationChange(null);
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-card" data-testid="checkout-location-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-emerald-600" />
          <h2 className="font-heading font-semibold text-xl">Pin My Location</h2>
        </div>
        {location && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
              <Check className="h-3 w-3" /> Location Set
            </span>
            <button onClick={handleClearLocation} className="text-slate-400 hover:text-red-500 transition-colors" data-testid="clear-location-btn">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Help the delivery driver find you easily by pinning your exact location on the map.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
          data-testid="use-my-location-btn"
        >
          {geoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Navigation className="h-4 w-4 mr-1.5" />
          )}
          Use My Location
        </Button>
        {!expanded && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(true)}
            className="rounded-xl"
            data-testid="pick-on-map-btn"
          >
            <MapPin className="h-4 w-4 mr-1.5" />
            Pick on Map
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2">
          {/* Location search */}
          <MapLocationSearch
            onSelect={handleLocationSearch}
            accent="emerald"
            placeholder="Search your address, area or landmark..."
            data-testid="checkout-location-search"
          />
          {/* Map Provider Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 w-fit">
            {Object.entries(MAP_PROVIDERS).map(([key, prov]) => (
              <button key={key} type="button" onClick={() => setMapProvider(key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${mapProvider === key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {prov.name}
              </button>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: '250px' }}>
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} data-testid="checkout-location-map" />
          </div>
          <p className="text-[11px] text-slate-400">Click on the map to set your location, or drag the marker to adjust.</p>
        </div>
      )}

      {location && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          <MapPin className="h-3.5 w-3.5 text-emerald-500" />
          <span>Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</span>
        </div>
      )}
    </div>
  );
};

export default CheckoutLocationPicker;
