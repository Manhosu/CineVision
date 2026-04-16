'use client';

import { useState, useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Person {
  id: string;
  name: string;
  photo_url?: string;
  role: string;
}

interface PeopleTagInputProps {
  value: Person[];
  onChange: (people: Person[]) => void;
  role: 'actor' | 'director';
  label: string;
  placeholder?: string;
  /** Allow only one selection (for director) */
  single?: boolean;
}

export default function PeopleTagInput({ value, onChange, role, label, placeholder, single }: PeopleTagInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search people as user types
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/admin/people?search=${encodeURIComponent(query)}&role=${role}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already selected
          const selectedIds = new Set(value.map(p => p.id));
          setSuggestions((data || []).filter((p: Person) => !selectedIds.has(p.id)));
        }
      } catch { /* ignore */ }
      setLoading(false);
      setShowDropdown(true);
    }, 200);
  }, [query, role, value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addPerson = (person: Person) => {
    if (single) {
      onChange([person]);
    } else {
      onChange([...value, person]);
    }
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removePerson = (id: string) => {
    onChange(value.filter(p => p.id !== id));
  };

  const createAndAdd = async () => {
    const name = query.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/people/find-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role }),
      });
      if (res.ok) {
        const person = await res.json();
        addPerson(person);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        addPerson(suggestions[0]);
      } else if (query.trim()) {
        createAndAdd();
      }
    }
    if (e.key === 'Backspace' && !query && value.length > 0) {
      removePerson(value[value.length - 1].id);
    }
  };

  const initials = (name: string) => {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        {/* Selected tags */}
        <div className="flex flex-wrap gap-1.5 p-2 bg-dark-700 border border-white/10 rounded-lg min-h-[44px] focus-within:border-primary-500 transition-colors">
          {value.map(person => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-medium pl-1 pr-2 py-1 rounded-full"
            >
              {person.photo_url ? (
                <img src={person.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-primary-600/40 text-primary-300 flex items-center justify-center text-[9px] font-bold">
                  {initials(person.name)}
                </span>
              )}
              {person.name}
              <button
                type="button"
                onClick={() => removePerson(person.id)}
                className="ml-0.5 text-white/40 hover:text-red-400 transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[120px] bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
            placeholder={value.length === 0 ? (placeholder || `Digite para buscar ${role === 'director' ? 'diretor' : 'ator'}...`) : single && value.length > 0 ? '' : 'Adicionar...'}
            disabled={single && value.length > 0}
          />
        </div>

        {/* Suggestions dropdown */}
        {showDropdown && (suggestions.length > 0 || (query.trim().length >= 2 && !loading)) && (
          <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-dark-800 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {suggestions.map(person => (
              <button
                key={person.id}
                type="button"
                onClick={() => addPerson(person)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left transition-colors"
              >
                {person.photo_url ? (
                  <img src={person.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-primary-600/30 text-primary-300 flex items-center justify-center text-xs font-bold">
                    {initials(person.name)}
                  </span>
                )}
                <span className="text-white text-sm">{person.name}</span>
              </button>
            ))}
            {query.trim().length >= 2 && suggestions.length === 0 && !loading && (
              <button
                type="button"
                onClick={createAndAdd}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/10 text-left transition-colors text-green-400"
              >
                <span className="w-7 h-7 rounded-full bg-green-600/20 flex items-center justify-center text-lg">+</span>
                <span className="text-sm">Criar &quot;{query.trim()}&quot;</span>
              </button>
            )}
            {loading && (
              <div className="px-3 py-2 text-gray-500 text-sm">Buscando...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
