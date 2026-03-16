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
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <MapPin size={14} />
          {city}
        </button>
      ))}
    </div>
  );
}
