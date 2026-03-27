import { Home, Calendar, Play, Sparkles, User, Heart, Map as MapIcon, Compass, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Accueil' },
    { id: 'events', icon: Calendar, label: 'Événements' },
    { id: 'moments', icon: Play, label: 'Moments' },
    { id: 'recommendations', icon: Compass, label: 'Recommandations' },
    { id: 'hotspots', icon: MapIcon, label: 'Hotspots' },
    { id: 'favorites', icon: Heart, label: 'Favoris' },
    { id: 'ai', icon: Sparkles, label: 'Studio' },
    { id: 'profile', icon: User, label: 'Profil' },
  ];

  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Accueil';

  return (
    <>
      <div className="px-6 py-4 bg-[#0B0814]/50 backdrop-blur-sm border-b border-white/10 flex items-center gap-2 text-xs font-medium text-purple-200/50">
        <button 
          onClick={() => setActiveTab('home')}
          className="hover:text-purple-400 transition-colors flex items-center gap-1"
        >
          <Home size={12} />
          Accueil
        </button>
        
        {activeTab !== 'home' && (
          <>
            <ChevronRight size={12} className="text-purple-200/30" />
            <span className="text-purple-400 font-bold">{activeTabLabel}</span>
          </>
        )}
      </div>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-[#2A2438]/95 backdrop-blur-xl border border-purple-500/30 px-2 py-2 rounded-full flex justify-between items-center z-50 shadow-2xl shadow-purple-900/50">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full transition-colors duration-300",
                isActive 
                  ? "text-white" 
                  : "text-purple-200/60 hover:text-purple-100 hover:bg-white/5"
              )}
              title={tab.label}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-500 rounded-full shadow-lg shadow-purple-500/30"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn("relative z-10", isActive && "scale-110 transition-transform")} />
              {isActive && (
                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap relative z-10">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
