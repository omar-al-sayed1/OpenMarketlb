import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MultiImageUploader = ({ 
  images = [], 
  onChange = () => {},
  label = "Images",
  maxImages = 10,
  maxSize = 5, // MB per image
  className = ""
}) => {
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const safeOnChange = (newImages) => {
    if (typeof onChange === 'function') {
      onChange(newImages);
    } else {
      console.error('onChange is not a function in MultiImageUploader');
    }
  };

  const uploadFiles = async (files) => {
    if (files.length === 0) return;
    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    const newUrls = [];

    for (const file of files) {
      if (file.size > maxSize * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxSize}MB limit, skipping...`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image, skipping...`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

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
        newUrls.push(imageUrl);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newUrls.length > 0) {
      const currentImages = images.filter(img => img.trim() !== '');
      safeOnChange([...currentImages, ...newUrls]);
      toast.success(`${newUrls.length} image(s) uploaded`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileSelect = (e) => uploadFiles(Array.from(e.target.files || []));
  const handleCameraCapture = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles(files);
  };

  const updateImageUrl = (index, value) => {
    const newImages = [...images];
    newImages[index] = value;
    safeOnChange(newImages);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    safeOnChange(newImages.length > 0 ? newImages : ['']);
  };

  const addUrlField = () => {
    if (images.length < maxImages) {
      safeOnChange([...images, '']);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <label className="text-sm font-medium text-slate-700 block">{label}</label>}
      
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-2">
        <Button type="button" variant={!useUrl ? 'default' : 'outline'} size="sm" onClick={() => setUseUrl(false)} className="text-xs">
          <Upload className="h-3 w-3 mr-1" />
          Upload Files
        </Button>
        <Button type="button" variant={useUrl ? 'default' : 'outline'} size="sm" onClick={() => setUseUrl(true)} className="text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Image URLs
        </Button>
      </div>

      {/* Upload Area */}
      {!useUrl && (
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" disabled={uploading} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" disabled={uploading} />
          
          <div 
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-violet-400 hover:bg-violet-50/50 ${uploading ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}
            data-testid="image-upload-area"
          >
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 text-violet-500 animate-spin mb-2" />
                <p className="text-sm text-violet-600">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">Click to upload images</p>
                <p className="text-xs text-slate-400 mt-1">Max {maxSize}MB per image</p>
              </div>
            )}
          </div>
          
          {/* Camera Button */}
          <div 
            onClick={() => !uploading && cameraInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50 min-w-[90px] ${uploading ? 'opacity-50' : 'border-slate-200'}`}
            data-testid="camera-capture-btn"
          >
            <div className="flex flex-col items-center">
              <Camera className="h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm text-blue-600 font-medium">Camera</p>
              <p className="text-xs text-blue-400">Take Photo</p>
            </div>
          </div>
        </div>
      )}

      {/* URL Inputs */}
      {useUrl && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Add image URLs:</span>
            <Button type="button" variant="ghost" size="sm" onClick={addUrlField} disabled={images.length >= maxImages} className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add URL
            </Button>
          </div>
          {images.map((img, index) => (
            <div key={index} className="flex gap-2">
              <Input value={img} onChange={(e) => updateImageUrl(index, e.target.value)} placeholder="https://example.com/image.jpg" className="flex-1" data-testid={`image-url-${index}`} />
              {images.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeImage(index)} className="text-red-500 hover:text-red-700 px-2">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Previews */}
      {images.filter(img => img.trim()).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.filter(img => img.trim()).map((img, index) => (
            <div key={index} className="relative group">
              <img src={img} alt={`Preview ${index + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" onError={(e) => { e.target.style.opacity = '0.3'; }} />
              <button
                type="button"
                onClick={() => { const actualIndex = images.findIndex(i => i === img); if (actualIndex !== -1) removeImage(actualIndex); }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiImageUploader;
