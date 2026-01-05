import React, { useCallback } from 'react';
import AsyncSelect from 'react-select/async';
import { MapPin } from 'lucide-react';
import debounce from 'lodash/debounce';

export default function LocationPicker({ value, onChange, disabled, className }) {
  
  // 🌍 1. FETCH FUNCTION (Connects to OpenStreetMap)
  const fetchPlaces = async (inputValue) => {
    if (!inputValue || inputValue.length < 3) return [];

    try {
      // Nominatim requires a User-Agent to identify your app
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&addressdetails=1&limit=5`,
        { headers: { "User-Agent": "JourneysPage/1.0" } }
      );
      
      const data = await response.json();
      
      // Transform their data into our dropdown format
      return data.map((item) => ({
        label: item.display_name, // The text shown in the dropdown
        value: {
          place_id: item.place_id,
          lat: item.lat,
          lon: item.lon,
          name: item.name,
          raw: item // Keep raw data just in case
        }
      }));
    } catch (error) {
      console.error("OSM Search Error:", error);
      return [];
    }
  };

  // ⏱️ 2. DEBOUNCE (Wait 800ms after typing stops before searching)
  const loadOptions = useCallback(
    debounce((inputValue, callback) => {
      fetchPlaces(inputValue).then((options) => callback(options));
    }, 800),
    []
  );

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
        <MapPin size={12}/> Location
      </label>
      
      <AsyncSelect
        cacheOptions
        defaultOptions
        loadOptions={loadOptions}
        onChange={onChange}
        value={value}
        isDisabled={disabled}
        placeholder="Search for a place (e.g. Sandakphu)..."
        classNamePrefix="react-select"
        
        // 🎨 3. CUSTOM STYLING (To match your Dark/Glass Theme)
        styles={{
          control: (base, state) => ({
            ...base,
            backgroundColor: 'rgba(255, 255, 255, 0.05)', // Transparent glass
            borderRadius: '0.75rem', // rounded-xl
            border: state.isFocused ? '1px solid #f97316' : '1px solid rgba(148, 163, 184, 0.1)', // Orange focus
            padding: '4px',
            boxShadow: 'none',
            color: 'inherit',
            minHeight: '48px',
          }),
          input: (base) => ({ 
            ...base, 
            color: 'inherit',
            fontSize: '1rem',
          }),
          singleValue: (base) => ({ 
            ...base, 
            color: 'inherit', 
            fontWeight: 600 
          }),
          placeholder: (base) => ({
            ...base,
            color: '#94a3b8', // slate-400
            fontSize: '0.9rem',
          }),
          menu: (base) => ({ 
            ...base, 
            backgroundColor: '#1e293b', // Dark slate bg
            zIndex: 9999,
            borderRadius: '0.75rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden'
          }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isFocused ? '#334155' : 'transparent',
            color: state.isFocused ? '#fff' : '#cbd5e1',
            cursor: 'pointer',
            padding: '10px 14px',
            fontSize: '0.9rem',
          }),
        }}
        // Fix for text color in dark mode
        theme={(theme) => ({
          ...theme,
          colors: { ...theme.colors, text: 'currentColor' }
        })}
      />
    </div>
  );
}