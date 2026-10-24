import React, { useState, useEffect, useRef } from 'react';
import { Shield, Mail, MapPin, FileText, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Upload, AlertCircle, Clock, XCircle, BadgeCheck, Camera, CreditCard, BookOpen, X, Search, Navigation, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import ShopLayout from '../../components/ShopLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const STEPS = [
  { id: 'email', label: 'Email Verification', icon: Mail, description: 'Verify your shop email address' },
  { id: 'location', label: 'Shop Location', icon: MapPin, description: 'Set your shop location on the map' },
  { id: 'document', label: 'Document Upload', icon: FileText, description: 'Upload your ID or Passport' },
];

const MAP_PROVIDERS = {
  openstreetmap: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  google_roadmap: { name: 'Google', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] },
};

// ===== Document Upload Card Component =====
const DocumentUploadCard = ({ label, docType, docUrl, uploading, onUpload, onDelete }) => {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    onUpload(file, docType);
  };

  return (
    <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-4 transition-all hover:border-violet-300 hover:bg-violet-50/30" data-testid={`doc-upload-${docType}`}>
      {docUrl ? (
        <div className="relative">
          <img src={docUrl} alt={label} className="w-full h-40 object-contain rounded-xl bg-slate-50" />
          <button
            onClick={() => onDelete(docType)}
            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
            data-testid={`doc-delete-${docType}`}
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs text-emerald-600 font-medium text-center mt-2 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> {label} uploaded
          </p>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-violet-500 mx-auto" />
          ) : (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-xl text-xs font-semibold transition-all"
                data-testid={`doc-upload-file-${docType}`}
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-xs font-semibold transition-all"
                data-testid={`doc-camera-${docType}`}
              >
                <Camera className="h-3.5 w-3.5" /> Camera
              </button>
            </div>
          )}
          <p className="text-[10px] text-slate-400">JPG, PNG, WEBP (max 5MB)</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </div>
  );
};

const ShopVerification = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Email step state
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [devCode, setDevCode] = useState('');
  
  // Location step state
  const [latitude, setLatitude] = useState(33.8938);
  const [longitude, setLongitude] = useState(35.5018);
  const [locationAddress, setLocationAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  
  // Document step state
  const [docType, setDocType] = useState('id'); // 'id' or 'passport'
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  
  // Submit state
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await api.shop.getVerificationStatus();
      setStatus(data);
      if (data.documents) setDocuments(data.documents);
      if (data.document_type) setDocType(data.document_type);
      
      // Determine current step based on status
      if (data.is_verified) {
        setCurrentStep(3);
      } else if (data.document_uploaded) {
        setCurrentStep(2);
      } else if (data.location_set) {
        setCurrentStep(data.email_verified ? 2 : 0);
      } else if (data.email_verified) {
        setCurrentStep(1);
      }
    } catch (err) {
      console.error('Error fetching verification status:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== Location map logic =====
  useEffect(() => {
    if (!loading && currentStep === 1 && !mapInstanceRef.current) {
      fetchLocationData();
    }
    return () => {
      if (mapInstanceRef.current && currentStep !== 1) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, currentStep]);

  const fetchLocationData = async () => {
    try {
      const { data } = await api.shop.getLocation();
      if (data.latitude && data.longitude) {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        setLocationAddress(data.location_address || '');
      }
    } catch {}
    setTimeout(() => initMap(), 100);
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

    marker.on('dragend', async (e) => {
      const pos = e.target.getLatLng();
      setLatitude(pos.lat);
      setLongitude(pos.lng);
      setLocationSaved(false);
      // Auto reverse geocode
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}&zoom=18`);
        const d = await res.json();
        if (d.display_name) setLocationAddress(d.display_name);
      } catch {}
    });

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      setLatitude(lat);
      setLongitude(lng);
      marker.setLatLng([lat, lng]);
      setLocationSaved(false);
      // Auto reverse geocode
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
        const d = await res.json();
        if (d.display_name) setLocationAddress(d.display_name);
      } catch {}
    });
  };

  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    const provider = MAP_PROVIDERS[mapProvider];
    if (tileLayerRef.current) mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(mapInstanceRef.current);
  }, [mapProvider]);

  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        setLatitude(parseFloat(lat));
        setLongitude(parseFloat(lon));
        setLocationAddress(display_name);
        setLocationSaved(false);
        if (mapInstanceRef.current) mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], 15);
      } else {
        toast.error('Location not found');
      }
    } catch { toast.error('Search failed'); }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setLocationSaved(false);
          if (mapInstanceRef.current) mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18`);
            const d = await res.json();
            if (d.display_name) setLocationAddress(d.display_name);
          } catch {}
          toast.success('Location updated!');
        },
        () => toast.error('Unable to get location'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleSaveLocation = async () => {
    setSaving(true);
    try {
      await api.shop.updateLocation({ latitude, longitude, location_address: locationAddress });
      setLocationSaved(true);
      setStatus(prev => ({ ...prev, location_set: true }));
      toast.success('Location saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  // ===== Email logic =====
  const handleSendEmailCode = async () => {
    setEmailSending(true);
    try {
      const { data } = await api.shop.sendVerificationEmail();
      setEmailSent(true);
      if (data.dev_code) setDevCode(data.dev_code);
      toast.success('Verification code sent!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send code');
    } finally { setEmailSending(false); }
  };

  const handleVerifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) { toast.error('Enter valid 6-digit code'); return; }
    setVerifyingEmail(true);
    try {
      await api.shop.verifyEmail(emailCode);
      toast.success('Email verified!');
      setStatus(prev => ({ ...prev, email_verified: true }));
      setTimeout(() => setCurrentStep(1), 800);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid code');
    } finally { setVerifyingEmail(false); }
  };

  // ===== Document logic =====
  const handleDocUpload = async (file, type) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.shop.uploadVerificationDocument(formData, type);
      setDocuments(prev => ({ ...prev, [type]: data.document_url }));
      setStatus(prev => ({ ...prev, document_uploaded: true }));
      toast.success('Document uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDocDelete = async (type) => {
    try {
      await api.shop.deleteVerificationDocument(type);
      setDocuments(prev => { const n = { ...prev }; delete n[type]; return n; });
      // Check if we still have documents
      const remaining = Object.keys(documents).filter(k => k !== type);
      if (remaining.length === 0) setStatus(prev => ({ ...prev, document_uploaded: false }));
      toast.success('Document removed');
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.shop.submitVerification();
      toast.success('Verification submitted for review!');
      setStatus(prev => ({ ...prev, verification_status: 'pending' }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <ShopLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </ShopLayout>
    );
  }

  // Already verified
  if (status?.is_verified) {
    return (
      <ShopLayout>
        <div className="max-w-2xl mx-auto px-4 py-12" data-testid="verification-complete">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-200 animate-bounce" style={{ animationDuration: '2s' }}>
              <BadgeCheck className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Verified Seller</h1>
            <p className="text-slate-500 text-lg">Your shop is verified. You have higher ranking and a verified badge.</p>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
              <BadgeCheck className="h-5 w-5 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">Verified Seller</span>
            </div>
          </div>
        </div>
      </ShopLayout>
    );
  }

  // Pending approval
  if (status?.verification_status === 'pending') {
    return (
      <ShopLayout>
        <div className="max-w-2xl mx-auto px-4 py-12" data-testid="verification-pending">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-200">
              <Clock className="h-12 w-12 text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Under Review</h1>
            <p className="text-slate-500 text-lg mb-4">Your verification is being reviewed by our team.</p>
            <p className="text-slate-400 text-sm">Usually takes 1-2 business days.</p>
          </div>
        </div>
      </ShopLayout>
    );
  }

  // Rejected
  if (status?.verification_status === 'rejected') {
    return (
      <ShopLayout>
        <div className="max-w-2xl mx-auto px-4 py-12" data-testid="verification-rejected">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-2xl shadow-red-200">
              <XCircle className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Verification Rejected</h1>
            <p className="text-slate-500 text-lg mb-2">Your verification was not approved.</p>
            {status.rejection_reason && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto">
                <p className="text-red-700 text-sm font-medium">Reason: {status.rejection_reason}</p>
              </div>
            )}
            <Button onClick={() => { setStatus(prev => ({ ...prev, verification_status: 'in_progress' })); setCurrentStep(0); }} className="mt-6 bg-violet-600 hover:bg-violet-700">
              Try Again
            </Button>
          </div>
        </div>
      </ShopLayout>
    );
  }

  const isStepComplete = (idx) => {
    if (idx === 0) return status?.email_verified;
    if (idx === 1) return status?.location_set;
    if (idx === 2) return status?.document_uploaded;
    return false;
  };

  const isDocComplete = () => {
    if (docType === 'id') return documents.id_front && documents.id_back;
    return !!documents.passport;
  };

  const allStepsComplete = status?.email_verified && status?.location_set && isDocComplete();

  return (
    <ShopLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10" data-testid="shop-verification-page">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-200">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Shop Verification</h1>
          <p className="text-slate-500 text-sm sm:text-base">Complete 3 steps to get your verified seller badge</p>
          <p className="text-violet-600 text-xs font-medium mt-1">Takes 3-5 minutes</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0 mb-10" data-testid="verification-steps-progress">
          {STEPS.map((step, idx) => {
            const complete = isStepComplete(idx);
            const active = currentStep === idx;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(idx)}
                  className={`relative flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'scale-110' : ''}`}
                  data-testid={`step-indicator-${step.id}`}
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
                    complete ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200' :
                    active ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200 ring-4 ring-violet-100' :
                    'bg-slate-100 border-2 border-slate-200'
                  }`}>
                    {complete ? (
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    ) : (
                      <step.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${active ? 'text-white' : 'text-slate-400'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                    complete ? 'text-emerald-600' : active ? 'text-violet-700' : 'text-slate-400'
                  }`}>{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className={`w-10 sm:w-16 h-0.5 mx-1 sm:mx-2 rounded-full transition-all duration-500 ${
                    isStepComplete(idx) ? 'bg-emerald-400' : 'bg-slate-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="border border-slate-100 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {/* ====== Step 1: Email ====== */}
            {currentStep === 0 && (
              <div className="space-y-6" data-testid="step-email-content" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Verify Your Email</h2>
                  <p className="text-slate-500 text-sm mt-1">We'll send a 6-digit code to your registered email</p>
                </div>

                {status?.email_verified ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-800">Email Verified</p>
                      <p className="text-emerald-600 text-sm">Your email has been verified successfully</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!emailSent ? (
                      <Button onClick={handleSendEmailCode} disabled={emailSending} className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl text-base" data-testid="send-email-code-btn">
                        {emailSending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Mail className="h-5 w-5 mr-2" />}
                        Send Verification Code
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        {devCode && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-amber-800 text-xs font-medium">Dev Mode - Your code: <span className="font-bold text-lg">{devCode}</span></p>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Enter 6-digit code</label>
                          <Input
                            value={emailCode}
                            onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="text-center text-2xl tracking-[0.5em] font-bold h-14 rounded-xl"
                            maxLength={6}
                            data-testid="email-code-input"
                          />
                        </div>
                        <Button onClick={handleVerifyEmail} disabled={verifyingEmail || emailCode.length !== 6} className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl text-base" data-testid="verify-email-btn">
                          {verifyingEmail ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                          Verify Email
                        </Button>
                        <button onClick={handleSendEmailCode} className="text-sm text-violet-600 hover:text-violet-800 font-medium mx-auto block">
                          Resend code
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {status?.email_verified && (
                  <Button onClick={() => setCurrentStep(1)} className="w-full h-11 rounded-xl" data-testid="next-to-location-btn">
                    Next: Shop Location <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}

            {/* ====== Step 2: Location (Embedded Map) ====== */}
            {currentStep === 1 && (
              <div className="space-y-4" data-testid="step-location-content" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                <div className="text-center mb-2">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-green-50 flex items-center justify-center">
                    <MapPin className="h-7 w-7 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Shop Location</h2>
                  <p className="text-slate-500 text-sm mt-1">Set your shop location so customers can find you</p>
                </div>

                {status?.location_set && !locationSaved && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <p className="text-emerald-700 text-sm font-medium">Location already set. You can update it below if needed.</p>
                  </div>
                )}

                {/* Search */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                      placeholder="Search address..."
                      className="pl-9 rounded-xl"
                      data-testid="verification-location-search"
                    />
                  </div>
                  <Button onClick={handleLocationSearch} variant="outline" size="sm" className="rounded-xl">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleUseCurrentLocation} variant="outline" size="sm" className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50" data-testid="verification-use-location-btn">
                    <Navigation className="h-4 w-4" />
                  </Button>
                </div>

                {/* Map Provider */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 w-fit">
                  {Object.entries(MAP_PROVIDERS).map(([key, prov]) => (
                    <button key={key} onClick={() => setMapProvider(key)}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${mapProvider === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {prov.name}
                    </button>
                  ))}
                </div>

                {/* Map */}
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: '300px' }}>
                  <div ref={mapRef} style={{ height: '100%', width: '100%' }} data-testid="verification-map" />
                </div>

                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-slate-400">Latitude</Label>
                    <Input value={latitude.toFixed(6)} readOnly className="bg-slate-50 h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400">Longitude</Label>
                    <Input value={longitude.toFixed(6)} readOnly className="bg-slate-50 h-9 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-slate-400">Address</Label>
                  <Input value={locationAddress} onChange={(e) => { setLocationAddress(e.target.value); setLocationSaved(false); }} placeholder="Shop address..." className="h-9 text-sm" data-testid="verification-address-input" />
                </div>

                {/* Save */}
                <Button onClick={handleSaveLocation} disabled={saving} className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl" data-testid="verification-save-location-btn">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : locationSaved ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {locationSaved ? 'Location Saved!' : 'Save Location'}
                </Button>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setCurrentStep(0)} className="flex-1 rounded-xl">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  {(status?.location_set || locationSaved) && (
                    <Button onClick={() => setCurrentStep(2)} className="flex-1 rounded-xl" data-testid="next-to-document-btn">
                      Next: Document <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ====== Step 3: Document Upload ====== */}
            {currentStep === 2 && (
              <div className="space-y-6" data-testid="step-document-content" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-purple-50 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Upload Document</h2>
                  <p className="text-slate-500 text-sm mt-1">Upload your ID card or Passport for identity verification</p>
                </div>

                {/* Document Type Selector */}
                <div className="flex gap-3" data-testid="doc-type-selector">
                  <button
                    onClick={() => setDocType('id')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      docType === 'id' ? 'border-violet-500 bg-violet-50 shadow-md' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    data-testid="doc-type-id"
                  >
                    <CreditCard className={`h-8 w-8 ${docType === 'id' ? 'text-violet-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${docType === 'id' ? 'text-violet-700' : 'text-slate-600'}`}>ID Card</span>
                    <span className="text-[10px] text-slate-400">Front & Back</span>
                  </button>
                  <button
                    onClick={() => setDocType('passport')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      docType === 'passport' ? 'border-violet-500 bg-violet-50 shadow-md' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    data-testid="doc-type-passport"
                  >
                    <BookOpen className={`h-8 w-8 ${docType === 'passport' ? 'text-violet-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${docType === 'passport' ? 'text-violet-700' : 'text-slate-600'}`}>Passport</span>
                    <span className="text-[10px] text-slate-400">One photo</span>
                  </button>
                </div>

                {/* Upload areas based on type */}
                {docType === 'id' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="id-upload-section">
                    <DocumentUploadCard
                      label="Front of ID"
                      docType="id_front"
                      docUrl={documents.id_front}
                      uploading={uploading.id_front}
                      onUpload={handleDocUpload}
                      onDelete={handleDocDelete}
                    />
                    <DocumentUploadCard
                      label="Back of ID"
                      docType="id_back"
                      docUrl={documents.id_back}
                      uploading={uploading.id_back}
                      onUpload={handleDocUpload}
                      onDelete={handleDocDelete}
                    />
                  </div>
                ) : (
                  <div className="max-w-sm mx-auto" data-testid="passport-upload-section">
                    <DocumentUploadCard
                      label="Passport Photo"
                      docType="passport"
                      docUrl={documents.passport}
                      uploading={uploading.passport}
                      onUpload={handleDocUpload}
                      onDelete={handleDocDelete}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1 rounded-xl">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                </div>

                {/* Submit Button */}
                {allStepsComplete && status?.verification_status !== 'pending' && (
                  <div className="pt-4 border-t border-slate-100">
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full h-14 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 rounded-xl text-lg font-bold shadow-xl shadow-violet-200"
                      data-testid="submit-verification-btn"
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Shield className="h-5 w-5 mr-2" />}
                      Submit for Verification
                    </Button>
                    <p className="text-center text-xs text-slate-400 mt-2">Your request will be reviewed within 1-2 business days</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ShopLayout>
  );
};

export default ShopVerification;
