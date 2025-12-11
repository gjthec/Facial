import React, { useRef, useState, useEffect } from 'react';
import { X, RefreshCw, ScanFace, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ 
  onCapture, 
  onCancel, 
  isLoading,
  error,
  onClearError 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  // Tamanho da área de interesse (Oval)
  const OVAL_WIDTH = 280;
  const OVAL_HEIGHT = 380;

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraPermissionError(false);
    } catch (err) {
      console.error("Erro câmera:", err);
      setCameraPermissionError(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (error && onClearError) {
      onClearError();
    }
    
    if (!videoRef.current || !canvasRef.current) return;
    
    // Feedback visual do clique
    const shutter = document.getElementById('shutter-flash');
    if(shutter) {
      shutter.style.opacity = '1';
      setTimeout(() => shutter.style.opacity = '0', 100);
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Configurar canvas para o tamanho EXATO do recorte (Oval)
    canvas.width = OVAL_WIDTH;
    canvas.height = OVAL_HEIGHT;
    
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Calcular coordenadas para centralizar o recorte (Center Crop)
      const sourceX = (video.videoWidth - OVAL_WIDTH) / 2;
      const sourceY = (video.videoHeight - OVAL_HEIGHT) / 2;

      // Desenhar apenas a região de interesse (ROI)
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      ctx.drawImage(
        video, 
        sourceX, sourceY, OVAL_WIDTH, OVAL_HEIGHT, // Source (Recorte do vídeo)
        0, 0, OVAL_WIDTH, OVAL_HEIGHT              // Destination (Canvas inteiro)
      );
      ctx.restore();
      
      canvas.toBlob((blob) => {
        if (blob) onCapture(blob);
      }, 'image/jpeg', 0.95);
    }
  };

  if (cameraPermissionError) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center text-white p-6 text-center">
        <div>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Acesso à câmera negado</h3>
          <p className="text-gray-400 mb-6">Precisamos da câmera para validar sua identidade.</p>
          <button onClick={onCancel} className="bg-gray-800 px-6 py-2 rounded-lg">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div id="shutter-flash" className="absolute inset-0 bg-white pointer-events-none opacity-0 transition-opacity duration-75 z-20"></div>

      {/* Header */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white font-medium text-xs bg-black/40 backdrop-blur px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
          <ScanFace className="w-3 h-3" />
          Validação Biométrica (Gemini)
        </span>
        <button onClick={onCancel} className="text-white p-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Viewfinder */}
      <div className="flex-1 relative overflow-hidden bg-gray-900 flex items-center justify-center">
        {/* Video Element (Full Screen but masked) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-90"
        />
        
        {/* Dark Overlay (Mask) */}
        <div className="absolute inset-0 bg-black/60 z-0"></div>

        {/* Clear Oval (Guide) OR Error State */}
        <div 
          className={`relative z-10 overflow-hidden transition-all duration-300 flex flex-col items-center justify-center text-center p-4
            ${error 
              ? 'w-[320px] h-auto bg-white/95 rounded-2xl shadow-2xl border-2 border-red-500' 
              : 'rounded-[50%] border-2 border-white/30 shadow-[0_0_100px_rgba(0,0,0,0.5)_inset]'}`}
          style={!error ? { width: OVAL_WIDTH, height: OVAL_HEIGHT } : {}}
        >
          {error ? (
            // ERROR STATE UI
            <div className="text-gray-900 animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold mb-1">Rosto não reconhecido</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => {
                  if (onClearError) onClearError();
                }}
                className="w-full bg-red-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            </div>
          ) : (
            // NORMAL STATE (Guide)
            <>
              <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.85)] pointer-events-none rounded-[50%]"></div>
              
              {/* Scanning Animation */}
              {isLoading && (
                <div className="absolute inset-0 bg-blue-500/20 animate-pulse flex items-center justify-center">
                  <ScanFace className="w-16 h-16 text-blue-200 opacity-50" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Helper Text (Only show if no error) */}
        {!isLoading && !error && (
          <div className="absolute bottom-12 left-0 right-0 text-center z-20 px-4">
            <p className="text-white text-sm font-medium drop-shadow-md bg-black/20 inline-block px-4 py-1 rounded-full backdrop-blur-sm">
              Posicione seu rosto centralizado no oval
            </p>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      {!error && (
        <div className="h-32 bg-black flex items-center justify-center relative z-20">
          <button
            onClick={handleCapture}
            disabled={isLoading}
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center group transition-all focus:outline-none 
              ${isLoading
                ? 'border-gray-600 opacity-50 cursor-not-allowed' 
                : 'border-white hover:border-blue-400 active:scale-95'}`}
            aria-label="Tirar foto"
          >
            <div className={`w-16 h-16 rounded-full transition-transform group-hover:scale-90 bg-white`} />
          </button>
        </div>
      )}
      
      {/* Fallback footer for error state to keep spacing */}
      {error && <div className="h-32 bg-black" />}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};