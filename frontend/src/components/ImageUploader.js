import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Camera, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Center-crop a picked file to a fixed aspect ratio (e.g. 1 for a square logo, 16/9 for a
// rectangular cover) via canvas, so shops don't upload off-ratio branding. Returns a File.
const cropToAspect = (file, aspect) => new Promise((resolve) => {
  if (!aspect) return resolve(file);
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  image.onload = () => {
    const iw = image.naturalWidth, ih = image.naturalHeight;
    let sw = iw, sh = ih, sx = 0, sy = 0;
    if (iw / ih > aspect) { sw = Math.round(ih * aspect); sx = Math.round((iw - sw) / 2); } // too wide → trim sides
    else { sh = Math.round(iw / aspect); sy = Math.round((ih - sh) / 2); }                  // too tall → trim top/bottom
    const maxW = 1600;
    const scale = sw > maxW ? maxW / sw : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const isPng = file.type === 'image/png'; // keep transparency for logos
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], file.name || (isPng ? 'image.png' : 'image.jpg'), { type: isPng ? 'image/png' : 'image/jpeg' }) : file),
      isPng ? 'image/png' : 'image/jpeg', 0.9,
    );
  };
  image.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  image.src = url;
});

const ImageUploader = ({
  value,
  onChange = () => {},
  label = "Image",
  accept = "image/*",
  maxSize = 5, // MB
  showUrlInput = true,
  className = "",
  aspect = null // 1 = square (logo), 16/9 = rectangular (cover); null = no crop
}) => {
  const [uploading, setUploading] = useState(false);
  // Default to Upload File mode
  const [useUrl, setUseUrl] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const safeOnChange = (newValue) => {
    if (typeof onChange === 'function') {
      onChange(newValue);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File size exceeds ${maxSize}MB limit`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    // Enforce the target aspect ratio (square logo / rectangular cover) before upload.
    let toUpload = file;
    try { if (aspect) toUpload = await cropToAspect(file, aspect); } catch (_) { toUpload = file; }
    const formData = new FormData();
    formData.append('file', toUpload);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        timeout: 120000
      });
      const imageUrl = `${BACKEND_URL}${response.data.url}`;
      safeOnChange(imageUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload image. Try using Image URL instead.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => uploadFile(e.target.files?.[0]);
  const handleCameraCapture = (e) => uploadFile(e.target.files?.[0]);

  const handleUrlChange = (e) => safeOnChange(e.target.value);

  const clearImage = () => {
    safeOnChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      
      {/* Mode Toggle */}
      {showUrlInput && (
        <div className="flex gap-2 mb-2">
          <Button type="button" variant={!useUrl ? 'default' : 'outline'} size="sm" onClick={() => setUseUrl(false)} className="text-xs">
            <Upload className="h-3 w-3 mr-1" />
            Upload File
          </Button>
          <Button type="button" variant={useUrl ? 'default' : 'outline'} size="sm" onClick={() => setUseUrl(true)} className="text-xs">
            <Link2 className="h-3 w-3 mr-1" />
            Image URL
          </Button>
        </div>
      )}

      {/* Upload Mode - Default */}
      {!useUrl && (
        <div className="space-y-2">
          <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileSelect} className="hidden" disabled={uploading} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" disabled={uploading} />
          
          <div className="flex gap-2">
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-violet-400 hover:bg-violet-50/50 ${uploading ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-6 w-6 text-violet-500 animate-spin mb-1" />
                  <p className="text-xs text-violet-600">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-6 w-6 text-slate-400 mb-1" />
                  <p className="text-xs text-slate-600">Choose File</p>
                  <p className="text-[10px] text-slate-400">Max {maxSize}MB</p>
                </div>
              )}
            </div>
            
            <div 
              onClick={() => !uploading && cameraInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50 min-w-[80px] ${uploading ? 'opacity-50' : 'border-slate-200'}`}
            >
              <div className="flex flex-col items-center">
                <Camera className="h-6 w-6 text-blue-500 mb-1" />
                <p className="text-xs text-blue-600">Camera</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL Mode */}
      {useUrl && (
        <div>
          <Input 
            value={value || ''} 
            onChange={handleUrlChange} 
            placeholder="Paste image URL here (e.g. https://example.com/image.jpg)" 
            data-testid="image-url-input" 
          />
          <p className="text-[10px] text-slate-400 mt-1">Tip: Right-click any image online - Copy image address - Paste here</p>
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-200" onError={(e) => { e.target.style.display = 'none'; }} />
          <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
