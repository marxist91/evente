import { MapPin } from 'lucide-react';
import { TOGO_CITIES, TogoCity } from '../types';
import { cn } from '../lib/utils';

interface CitySelectorProps {
  selectedCity: TogoCity;
  setSelectedCity: (city: TogoCity) => void;
}

export function CitySelector({ selectedCity, setSelectedCity }: CitySelectorProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
      {TOGO_CITIES.map((city) => (
        <button
          key={city}
          onClick={() => setSelectedCity(city)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all",
            selectedCity === city
              ? "bg-purple-600 text-white shadow-lg shadow-orange-500/30 border border-purple-500/50"
              : "bg-white/5 text-purple-200/70 hover:bg-white/10 hover:text-white border border-white/10"
          )}
        >
          <MapPin size={14} />
          {city}
        </button>
      ))}
    </div>
  );
}
