'use client';
import { useEffect, useRef, useState } from 'react';

export default function BarcodeScanner({ onScan }) {
  const scannerRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraState, setCameraState] = useState('loading');

  useEffect(() => {
    let quaggaInstance = null;
    
    const initializeScanner = async () => {
      try {
        // 1. Check browser support
        if (!navigator.mediaDevices || !window.MediaStreamTrack) {
          throw new Error('Camera API not supported in this browser');
        }

        // 2. Get camera permissions first
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        // 3. Wait for DOM element to be ready
        if (!scannerRef.current) {
          throw new Error('Scanner element not found');
        }

        // 4. Initialize Quagga after permissions
        const Quagga = (await import('@ericblade/quagga2')).default;
        
        quaggaInstance = Quagga;
        
        await new Promise((resolve, reject) => {
          Quagga.init({
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: scannerRef.current,
              constraints: {
                deviceId: stream.getVideoTracks()[0].getSettings().deviceId,
                ...stream.getVideoTracks()[0].getSettings()
              }
            },
            decoder: {
              readers: ['ean_reader', 'code_128_reader']
            }
          }, err => err ? reject(err) : resolve());
        });

        Quagga.start();
        setCameraState('ready');

        Quagga.onDetected(result => {
          onScan(result.codeResult.code);
          Quagga.stop();
        });

      } catch (error) {
        setCameraState('error');
        setCameraError(error.message);
        if (error.name === 'NotAllowedError') {
          setCameraError('Camera access denied - please enable permissions');
        }
      }
    };

    initializeScanner();

    return () => {
      if (quaggaInstance) {
        quaggaInstance.stop();
        quaggaInstance.offDetected();
      }
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black">
      {/* Camera feed container */}
      <div ref={scannerRef} className="w-full h-full" />
      
      {/* Error states */}
      {cameraState === 'error' && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center p-4 text-red-600">
          {cameraError || 'Camera initialization failed'}
        </div>
      )}

      {/* Permission prompt */}
      {cameraState === 'loading' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="mb-4">Waiting for camera access...</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Scanning overlay */}
      {cameraState === 'ready' && (
        <div className="absolute inset-0 pointer-events-none border-4 border-green-400 rounded-lg m-2" />
      )}
    </div>
  );
}