import React, { useRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
}

export function VideoPlayer({ 
  src, 
  className = "w-full h-full object-cover", 
  autoPlay = true, 
  loop = true, 
  muted = true, 
  playsInline = true 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBuffering, setIsBuffering] = useState(true);

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
          });
        }
      }
    }
  }, [autoPlay, src]);

  if (!src) return null;

  return (
    <div className="relative w-full h-full bg-slate-900">
      <video
        ref={videoRef}
        src={src}
        className={className}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        autoPlay={autoPlay}
        onLoadStart={() => setIsBuffering(true)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
      />
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300">
          <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
        </div>
      )}
    </div>
  );
}
