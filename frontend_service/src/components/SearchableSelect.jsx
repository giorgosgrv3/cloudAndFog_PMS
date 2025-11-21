import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export default function SearchableSelect({ options, value, onChange, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Βρίσκουμε το label της επιλεγμένης τιμής για να το δείξουμε όταν είναι κλειστό
  const selectedOption = options.find(opt => opt.value === value);

  // Κλείσιμο του dropdown αν γίνει κλικ έξω από αυτό
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Φιλτράρισμα επιλογών
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* --- ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΑΝΟΙΓΕΙ ΤΟ DROPDOWN --- */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-blue-500"
      >
        <span className={`text-sm ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        <div className="flex items-center">
            {/* Κουμπί καθαρισμού (X) αν υπάρχει επιλογή */}
            {value && (
                <div 
                    onClick={(e) => {
                        e.stopPropagation(); // Για να μην ξανανοίξει το dropdown
                        onChange('');
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

      {/* --- Η ΛΙΣΤΑ ΜΕ ΤΗΝ ΑΝΑΖΗΤΗΣΗ (Εμφανίζεται μόνο όταν isOpen) --- */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 flex flex-col">
          
          {/* Search Input Sticky at Top */}
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

          {/* Options List (Scrollable) */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm(''); // Reset search
                  }}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                    value === option.value ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </div>
              ))
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