import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export default function SearchableSelect({ 
    options, 
    value, 
    onChange, 
    placeholder = "Select...", 
    multiple = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Κλείσιμο όταν κάνουμε κλικ έξω
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- HANDLERS ---
  const handleSelect = (optionValue) => {
    if (multiple) {
        // Logic για Multi-select (Toggle)
        const newValue = value.includes(optionValue)
            ? value.filter(v => v !== optionValue) // Remove
            : [...value, optionValue]; // Add
        onChange(newValue);
        // Δεν κλείνουμε το dropdown για να διαλέξει κι άλλους
    } else {
        // Logic για Single-select
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    }
  };

  const handleRemoveTag = (valToRemove, e) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== valToRemove));
  };

  // --- RENDER ---
  return (
    <div className="relative w-full" ref={wrapperRef}>
      
      {/* MAIN INPUT BOX */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-blue-500 min-h-[42px]"
      >
        <div className="flex flex-wrap gap-2 flex-1">
            {multiple && Array.isArray(value) && value.length > 0 ? (
                value.map(val => {
                    const opt = options.find(o => o.value === val);
                    return (
                        <span key={val} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                            {opt ? opt.label.split('(')[0] : val} {/* Δείχνουμε μόνο το username για συντομία */}
                            <X 
                                className="w-3 h-3 ml-1 cursor-pointer hover:text-blue-900" 
                                onClick={(e) => handleRemoveTag(val, e)}
                            />
                        </span>
                    );
                })
            ) : !multiple && value ? (
                <span className="text-sm text-gray-900">
                    {options.find(opt => opt.value === value)?.label || value}
                </span>
            ) : (
                <span className="text-sm text-gray-500">{placeholder}</span>
            )}
        </div>
        
        <div className="flex items-center ml-2">
            {/* Clear All Button */}
            {((multiple && value.length > 0) || (!multiple && value)) && (
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(multiple ? [] : '');
                        setSearchTerm('');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full mr-1"
                >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </div>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* DROPDOWN LIST */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 flex flex-col">
          
          {/* Search Sticky Header */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 sticky top-0">
            <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Type to search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = multiple ? value.includes(option.value) : value === option.value;
                return (
                    <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`px-4 py-2 text-sm cursor-pointer flex justify-between items-center
                        ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}
                    `}
                    >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No results found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}