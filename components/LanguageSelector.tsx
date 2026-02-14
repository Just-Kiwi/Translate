import React from 'react';
import { LanguageOption } from '../types';
import { ChevronDown, Globe } from 'lucide-react';

interface LanguageSelectorProps {
  label: string;
  value: string;
  options: LanguageOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  label,
  value,
  options,
  onChange,
  disabled
}) => {
  return (
    <div className="flex flex-col gap-3 w-full">
      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
        {label}
      </label>
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-card border border-border rounded-xl px-4 py-4 pr-10 text-white font-medium focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-700"
        >
          {options.map((option) => (
            <option key={option.code} value={option.code} className="bg-card text-white py-2">
              {option.flag} &nbsp; {option.name}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600 group-hover:text-primary-400 transition-colors">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;