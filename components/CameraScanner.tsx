import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Zap, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', focusMode: 'continuous' } as any
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsInitializing(false);
      } catch (err) {
        setError("Camera access denied. Please check permissions.");
        setIsInitializing(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simplified scanning simulation for web-demo 
  const handleManualTrigger = () => {
    const simulatedBarcode = "4800000000012"; 
    onScan(simulatedBarcode);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-in fade-in">
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 safe-pt">
        <button onClick={onClose} className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white">
          <X size={24} />
        </button>
        <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl text-white text-[10px] font-black uppercase tracking-widest">
          Scanning Protocol Active
        </div>
        <button className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white">
          <Zap size={24} />
        </button>
      </div>

      <div className="relative w-full h-full max-w-md overflow-hidden">
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-4">
            <RefreshCw className="animate-spin" size={32} />
            <p className="text-xs font-black uppercase tracking-widest">Initializing Lens...</p>
          </div>
        )}
        
        {error ? (
          <div className="p-10 text-center text-white space-y-4">
            <p className="font-bold">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-white text-black rounded-xl font-black">Close</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover grayscale opacity-60"
            />
            
            {/* Scanner Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-2 border-blue-500 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1 rounded-br-xl"></div>
                
                {/* Scanning Line */}
                <div className="absolute left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse" style={{ top: '50%' }}></div>
              </div>
            </div>

            <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center safe-pb">
               <button 
                onClick={handleManualTrigger}
                className="w-20 h-20 bg-white/20 backdrop-blur-xl border-4 border-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
               >
                 <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                   <Camera size={32} className="text-white" />
                 </div>
               </button>
               <p className="mt-4 text-[10px] font-black text-white/60 uppercase tracking-widest">Capture Frame</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraScanner;