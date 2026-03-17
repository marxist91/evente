import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, X, Pause, Play } from 'lucide-react';

interface VideoRecorderProps {
  onRecordingComplete: (file: File, previewUrl: string) => void;
  onCancel: () => void;
}

export function VideoRecorder({ onRecordingComplete, onCancel }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 480 },
          height: { ideal: 640 },
          frameRate: { ideal: 24 }
        },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Impossible d'accéder à la caméra ou au microphone. Veuillez vérifier les permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    
    // Determine best supported mimeType
    let mimeType = '';
    let simpleMimeType = 'video/webm'; // Fallback clean mime type
    
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
      simpleMimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      mimeType = 'video/webm;codecs=vp8,opus';
      simpleMimeType = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
      simpleMimeType = 'video/webm';
    }

    const options: MediaRecorderOptions = { 
      videoBitsPerSecond: 250000 // 250 kbps to keep file size small for Firestore
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }
    
    const mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Use simpleMimeType to avoid commas in the Blob type, 
      // which corrupts FileReader.readAsDataURL output
      const blob = new Blob(chunksRef.current, { type: simpleMimeType });
      const extension = simpleMimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `moment-${Date.now()}.${extension}`, { type: simpleMimeType });
      const previewUrl = URL.createObjectURL(blob);
      stopCamera();
      onRecordingComplete(file, previewUrl);
    };

    mediaRecorderRef.current = mediaRecorder;
    // Request data every 1000ms to ensure chunks are captured even if stopped quickly
    mediaRecorder.start(1000); 
    setIsRecording(true);
    setIsPaused(false);
    setRecordingTime(0);
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  if (error) {
    return (
      <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-rose-400 text-sm mb-4">{error}</p>
        <button onClick={onCancel} className="px-4 py-2 bg-white/10 text-white rounded-full text-sm font-bold">
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl bg-black overflow-hidden flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      
      <div className="absolute top-4 right-4">
        <button onClick={onCancel} className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-2">
        {isRecording && (
          <>
            <div className={`w-3 h-3 rounded-full bg-rose-500 ${!isPaused ? 'animate-pulse' : ''}`} />
            <span className="text-white text-sm font-bold font-mono bg-black/50 px-2 py-1 rounded-md backdrop-blur-md">
              {formatTime(recordingTime)}
            </span>
          </>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="w-16 h-16 bg-rose-500 rounded-full border-4 border-white/50 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
            <Camera size={24} className="text-white" />
          </button>
        ) : (
          <>
            <button 
              onClick={togglePause}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/30 transition-colors"
            >
              {isPaused ? <Play size={20} className="text-white" fill="currentColor" /> : <Pause size={20} className="text-white" fill="currentColor" />}
            </button>
            
            <button 
              onClick={stopRecording}
              className="w-16 h-16 bg-transparent rounded-full border-4 border-rose-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <Square size={20} className="text-rose-500" fill="currentColor" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
