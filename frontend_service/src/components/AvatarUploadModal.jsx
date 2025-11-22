import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/canvasUtils';
import { X, Upload, Loader } from 'lucide-react';

export default function AvatarUploadModal({ isOpen, onClose, onUpload }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Simple Validation
      if (!file.type.includes('image/')) {
        alert('Please select an image file (JPG or PNG).');
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setUploading(true);
      // 1. Create Blob from cropped area
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // 2. Send to Parent
      await onUpload(croppedImageBlob);
      
      // 3. Close
      onClose();
      setImageSrc(null); // Reset
    } catch (e) {
      console.error(e);
      alert('Failed to crop image');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-white w-full max-w-lg rounded-lg overflow-hidden shadow-xl flex flex-col h-[500px]">
        
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-700">Change Profile Picture</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 relative bg-gray-900">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} // Square aspect ratio for circle
              cropShape="round" // Circular visual mask
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Upload className="w-12 h-12 mb-2 opacity-50" />
              <p className="mb-4">Upload a photo to get started</p>
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition">
                Choose File
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          )}
        </div>

        {imageSrc && (
          <div className="p-4 border-t bg-white flex justify-between items-center">
             <div className="text-xs text-gray-500">
                Use scroll to zoom, drag to move.
             </div>
             <div className="flex space-x-3">
                <button 
                    onClick={() => setImageSrc(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                >
                    Reset
                </button>
                <button 
                    onClick={handleSave}
                    disabled={uploading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center"
                >
                    {uploading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                    Save Picture
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}