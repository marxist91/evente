import React, { useRef, useEffect, useState } from 'react';
import { Loader2, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  wrapperClassName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  showControls?: boolean;
}

export function VideoPlayer({ 
  src, 
  className = "w-full h-full object-cover", 
  wrapperClassName = "w-full h-full",
  autoPlay = true, 
  loop = true, 
  muted = true, 
  playsInline = true,
  showControls = false
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (video && src) {
      setIsBuffering(true);
      if (autoPlay) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // Ignore errors caused by missing source or browser autoplay policies
            if (error.name !== 'NotSupportedError' && error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
              console.warn("Autoplay notice:", error.message);
            }
            setIsBuffering(false);
            setIsPlaying(false);
          });
        }
      }
    }
  }, [autoPlay, src]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) {
        setProgress((current / duration) * 100);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (videoRef.current) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const percentage = x / bounds.width;
      videoRef.current.currentTime = percentage * videoRef.current.duration;
      setProgress(percentage * 100);
    }
  };

  if (!src) return null;

  return (
    <div 
      className={`relative bg-[#0B0814] group cursor-pointer flex items-center justify-center overflow-hidden ${wrapperClassName}`}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className={className}
        loop={loop}
        muted={isMuted}
        playsInline={playsInline}
        autoPlay={autoPlay}
        referrerPolicy="no-referrer"
        onLoadStart={() => setIsBuffering(true)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
      />
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B0814]/30 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-none">
          <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
        </div>
      )}
      
      {showControls && (
        <div className={`absolute inset-0 flex flex-col justify-between p-4 pb-24 transition-opacity duration-300 bg-gradient-to-t from-black/60 via-transparent to-black/30 ${!isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="flex justify-end">
            <button 
              onClick={toggleMute}
              className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-colors"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
          
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-center absolute inset-0 pointer-events-none">
              <button 
                onClick={togglePlay}
                className="p-4 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-colors pointer-events-auto transform scale-100 active:scale-95"
              >
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>
            </div>
            
            <div 
              className="h-1.5 w-full bg-white/30 rounded-full cursor-pointer overflow-hidden relative z-10"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-orange-500 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
