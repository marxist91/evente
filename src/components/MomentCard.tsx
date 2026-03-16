import { Play, User, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { Moment } from '../types';

interface MomentCardProps {
  key?: string | number;
  moment: Moment;
}

export function MomentCard({ moment }: MomentCardProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px 0px',
  });

  return (
    <div 
      ref={ref}
      className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900 shadow-xl group cursor-pointer"
    >
      {inView ? (
        <video
          src={moment.videoUrl}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          loop
          muted
          playsInline
          autoPlay
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <Loader2 className="text-gray-600 animate-spin" size={24} />
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/20 backdrop-blur-md px-2 py-1 rounded-full">
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <User size={12} className="text-white" />
        </div>
        <span className="text-[10px] font-medium text-white">{moment.authorName}</span>
      </div>

      <div className="absolute bottom-4 left-4 right-4">
        <p className="text-white text-sm font-medium line-clamp-2 mb-1">{moment.caption}</p>
        <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
          <Play size={10} fill="currentColor" />
          <span>{moment.city}</span>
        </div>
      </div>
    </div>
  );
}
