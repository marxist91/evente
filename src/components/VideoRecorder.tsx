import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, X, Pause, Play, SwitchCamera } from 'lucide-react';

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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const chunksRef = useRef<Blob[]>([]);
  
  const MAX_DURATION = 60; // 60 seconds max
  const progressPercentage = Math.min((recordingTime / MAX_DURATION) * 100, 100);

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
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              setIsPaused(false);
            }
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startCamera = async (mode = facingMode) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode,
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

  const handleSwitchCamera = async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 480 },
          height: { ideal: 640 },
          frameRate: { ideal: 24 }
        }
      });

      if (stream) {
        const oldVideoTrack = stream.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        stream.removeTrack(oldVideoTrack);
        stream.addTrack(newVideoTrack);
        oldVideoTrack.stop();
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error(e));
        }
      } else {
        startCamera(newFacingMode);
      }
    } catch (err) {
      console.error("Error switching camera:", err);
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
      <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl bg-[#1A1525] flex flex-col items-center justify-center p-6 text-center border border-white/10">
        <p className="text-rose-400 text-sm mb-4">{error}</p>
        <button onClick={onCancel} className="px-4 py-2 bg-white/10 text-white rounded-full text-sm font-bold border border-white/10 hover:bg-white/20 transition-colors">
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl bg-[#0B0814] overflow-hidden flex flex-col items-center justify-center border border-white/10">
      {/* Progress Bar */}
      {isRecording && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/30 z-50">
          <div 
            className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />
      
      <div className="absolute top-4 right-4 flex flex-col gap-3 z-40">
        <button onClick={onCancel} className="p-2 bg-[#0B0814]/50 text-white rounded-full backdrop-blur-md hover:bg-[#0B0814]/70 transition-colors border border-white/10">
          <X size={20} />
        </button>
        <button onClick={handleSwitchCamera} className="p-2 bg-[#0B0814]/50 text-white rounded-full backdrop-blur-md hover:bg-[#0B0814]/70 transition-colors border border-white/10">
          <SwitchCamera size={20} />
        </button>
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-2 z-40">
        {isRecording && (
          <>
            <div className={`w-3 h-3 rounded-full bg-orange-500 ${!isPaused ? 'animate-pulse' : ''}`} />
            <span className="text-white text-sm font-bold font-mono bg-[#0B0814]/50 px-2 py-1 rounded-md backdrop-blur-md border border-white/10">
              {formatTime(recordingTime)} / {formatTime(MAX_DURATION)}
            </span>
          </>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-40">
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="w-16 h-16 bg-orange-500 rounded-full border-4 border-white/50 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
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
              className="w-16 h-16 bg-transparent rounded-full border-4 border-orange-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <Square size={20} className="text-orange-500" fill="currentColor" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
