// components/LoadingSkeleton.jsx
export default function LoadingSkeleton() {
    return (
      <div className="animate-pulse bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-5 gap-4 mb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded" />
            ))}
          </div>
  
          {/* Table Rows */}
          <div className="space-y-4">
            {[...Array(5)].map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, colIndex) => (
                  <div 
                    key={colIndex}
                    className="h-6 bg-gray-100 rounded"
                    style={{ 
                      animationDelay: `${colIndex * 0.1}s`,
                      animationDuration: '1.5s'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }