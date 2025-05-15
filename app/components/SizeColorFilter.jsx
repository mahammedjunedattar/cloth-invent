'use client';
import { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { TwitterPicker } from 'react-color';
import useInventoryStats from '../hooks/useInventoryStats';
const SizeColorFilter = ({ 
  type, 
  selected, 
  onChange,
  storeId,
  enableCustomColors = false
}) => {
  const [customColor, setCustomColor] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const { stats, loading } = useInventoryStats(storeId);
  const [dragSelecting, setDragSelecting] = useState(false);
  
  // Get predefined options from inventory stats
  const options = type === 'colors' 
    ? [...(stats?.colors || []), ...(customColor ? [customColor] : [])]
    : stats?.sizes || [];
  const toggleOption = useCallback((value) => {
    onChange(prev => prev.includes(value)
      ? prev.filter(v => v !== value)
      : [...prev, value]
    );
  }, [onChange]);

  // Handle drag selection
  const handleMouseEnter = (value) => {
    if (dragSelecting && !selected.includes(value)) {
      toggleOption(value);
    }
  };

  // Size conversion tooltips
  const sizeChart = {
    XS: { US: '00', EU: '30' },
    S: { US: '0', EU: '32' },
    M: { US: '2', EU: '34' },
    L: { US: '4', EU: '36' },
    XL: { US: '6', EU: '38' },
    XXL: { US: '8', EU: '40' }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border relative">
      <fieldset>
        <legend className="text-sm font-semibold text-gray-500 mb-3">
          Filter by {type}
          {loading && <span className="text-xs text-gray-400 ml-2">(loading...)</span>}
        </legend>

        <div 
          className="grid grid-cols-4 gap-2"
          onMouseDown={() => setDragSelecting(true)}
          onMouseUp={() => setDragSelecting(false)}
          onMouseLeave={() => setDragSelecting(false)}
        >
          {options.map(option => {
            const isColor = type === 'colors';
            const displayValue = isColor ? colorNameToHex(option) : option;
            const count = isColor 
              ? stats?.colorCounts?.[option] 
              : stats?.sizeCounts?.[option];

            return (
              <div key={option} className="relative">
                <button
                  type="button"
                  onClick={() => toggleOption(option)}
                  onMouseEnter={() => handleMouseEnter(option)}
                  className={`w-full flex items-center justify-center p-1 rounded-md transition-all
                    ${selected.includes(option) 
                      ? 'ring-2 ring-blue-500' 
                      : 'ring-1 ring-gray-200 hover:ring-blue-200'}
                    ${isColor ? 'h-10' : 'h-8'}`}
                  aria-pressed={selected.includes(option)}
                  data-tooltip-id={`${type}-tooltip`}
                  data-tooltip-content={isColor ? '' : `US ${sizeChart[option]?.US || ''} / EU ${sizeChart[option]?.EU || ''}`}
                >
                  {isColor ? (
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm border"
                      style={{ 
                        backgroundColor: displayValue,
                        backgroundImage: option.toLowerCase() === 'white' 
                          ? 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)' 
                          : 'none'
                      }}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-700">
                      {option}
                    </span>
                  )}
                  
                  {count !== undefined && (
                    <span className="absolute top-0 right-0 bg-gray-100 text-[0.6rem] px-1 rounded">
                      {count}
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {enableCustomColors && type === 'colors' && (
            <div className="relative">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="h-10 w-full flex items-center justify-center border-2 border-dashed rounded-md"
              >
                <span className="text-gray-400 text-xl">+</span>
              </button>
              
              {showPicker && (
                <div className="absolute top-12 left-0 z-10">
                  <TwitterPicker
                    color={customColor}
                    onChangeComplete={(color) => {
                      setCustomColor(color.hex);
                      toggleOption(color.hex);
                      setShowPicker(false);
                    }}
                    triangle="hide"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </fieldset>

      <Tooltip id={`${type}-tooltip`} />
    </div>
  );
};

// Helper function to convert color names to hex
const colorNameToHex = (name) => {
  const colors = {
    red: '#dc2626',
    blue: '#2563eb',
    black: '#000000',
    white: '#ffffff',
    green: '#16a34a',
    multi: '#9333ea'
  };
  return colors[name.toLowerCase()] || name;
};

export default SizeColorFilter;