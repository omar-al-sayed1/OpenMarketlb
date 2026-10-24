import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Save, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ShopLayout from '../../components/ShopLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const MAP_PROVIDERS = {
  openstreetmap: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  google_roadmap: { name: 'Google', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] },
  google_satellite: { name: 'Satellite', url: 'https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] }
};

const ShopLocation = () => {
  const [latitude, setLatitude] = useState(33.8938);
  const [longitude, setLongitude] = useState(35.5018);
  const [locationAddress, setLocationAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  useEffect(() => {
    fetchLocation();
  }, []);

  useEffect(() => {
    if (!loading) {
      initMap();
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  // Switch tile layer on provider change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    const provider = MAP_PROVIDERS[mapProvider];
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(mapInstanceRef.current);
  }, [mapProvider]);

  const fetchLocation = async () => {
    try {
      const { data } = await api.shop.getLocation();
      if (data.latitude && data.longitude) {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        setLocationAddress(data.location_address || '');
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([latitude, longitude], 13);
    mapInstanceRef.current = map;

    const provider = MAP_PROVIDERS[mapProvider];
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(map);

    const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', async function(e) {
      const pos = e.target.getLatLng();
      setLatitude(pos.lat);
      setLongitude(pos.lng);
      setSaved(false);
      // Auto reverse geocode
      try {
        const address = await reverseGeocode(pos.lat, pos.lng);
        if (address) setLocationAddress(address);
      } catch {}
    });

    map.on('click', async function(e) {
      const { lat, lng } = e.latlng;
      setLatitude(lat);
      setLongitude(lng);
      marker.setLatLng([lat, lng]);
      setSaved(false);
      // Auto reverse geocode
      try {
        const address = await reverseGeocode(lat, lng);
        if (address) setLocationAddress(address);
      } catch {}
    });
  };

  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
    }
  }, [latitude, longitude]);

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      return data.display_name || '';
    } catch { return ''; }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        setLatitude(parseFloat(lat));
        setLongitude(parseFloat(lon));
        setLocationAddress(display_name);
        setSaved(false);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], 15);
        }
      } else {
        toast.error('Location not found. Try a different search.');
      }
    } catch (e) {
      toast.error('Failed to search location');
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setLatitude(lat);
          setLongitude(lng);
          setSaved(false);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 15);
          }
          // Reverse geocode to get actual address
          const address = await reverseGeocode(lat, lng);
          if (address) {
            setLocationAddress(address);
          }
          toast.success('Location set to your current position!');
        },
        () => toast.error('Unable to get your location. Please allow access.'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      toast.error('Geolocation not supported');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.shop.updateLocation({ latitude, longitude, location_address: locationAddress });
      toast.success('Shop location saved!');
      setSaved(true);
    } catch (e) {
      toast.error('Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ShopLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="shop-location-page">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" data-testid="shop-location-title">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            Shop Location
          </h1>
          <p className="text-slate-500 text-sm mt-2">Set your shop location on the map so customers can find you easily.</p>
        </div>

        {/* Search Bar + My Location */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search address (e.g., Beirut, Hamra Street)"
              className="pl-9"
              data-testid="location-search-input"
            />
          </div>
          <Button onClick={handleSearch} variant="outline" data-testid="location-search-btn">
            <Search className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleUseCurrentLocation}
            variant="outline" 
            className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
            data-testid="use-current-location-btn"
          >
            <Navigation className="h-4 w-4" />
            <span className="hidden sm:inline">My Location</span>
          </Button>
        </div>

        {/* Map Provider Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 mb-4 w-fit" data-testid="shop-map-provider-toggle">
          {Object.entries(MAP_PROVIDERS).map(([key, prov]) => (
            <button
              key={key}
              onClick={() => setMapProvider(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                mapProvider === key
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              data-testid={`shop-provider-${key}`}
            >
              {prov.name}
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm mb-4" style={{ height: '420px' }}>
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} data-testid="shop-location-map" />
        </div>

        {/* Location Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-xs text-slate-500">Latitude</Label>
              <Input value={latitude.toFixed(6)} readOnly className="bg-slate-50" data-testid="location-lat" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Longitude</Label>
              <Input value={longitude.toFixed(6)} readOnly className="bg-slate-50" data-testid="location-lng" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Address Description</Label>
            <Input
              value={locationAddress}
              onChange={(e) => { setLocationAddress(e.target.value); setSaved(false); }}
              placeholder="Enter your shop address..."
              data-testid="location-address-input"
            />
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8"
          data-testid="save-location-btn"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : saved ? (
            <><CheckCircle className="h-4 w-4 mr-2" /> Saved!</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Location</>
          )}
        </Button>

        <p className="text-xs text-slate-400 mt-3">
          Click on the map or drag the marker to set your shop's exact location. You can also search by address or use your current location.
        </p>
      </div>
    </ShopLayout>
  );
};

export default ShopLocation;
