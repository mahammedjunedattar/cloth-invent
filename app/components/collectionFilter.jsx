'use client';
import { useState } from 'react';
import Image from 'next/image';

const CollectionFilter = ({ 
  currentCollection, 
  onChange,
  customCollections = []
}) => {
  const defaultCollections = [
    {
      id: 'all',
      name: 'All Collections',
      preview: '/default-collection-all.jpg'
    },
    {
      id: 'summer-2024',
      name: 'Summer 2024',
      preview: '/summer-collection-preview.jpg',
      launchDate: '2024-06-01'
    },
    {
      id: 'permanent',
      name: 'Permanent Collection',
      preview: '/permanent-collection.jpg'
    }
  ];

  const allCollections = [...defaultCollections, ...customCollections];

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="text-sm font-semibold text-gray-500 mb-3">
        Filter by Collection
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {allCollections.map((collection) => (
          <button
            key={collection.id}
            onClick={() => onChange(collection.id)}
            className={`relative group aspect-square rounded-lg overflow-hidden transition-all
              ${currentCollection === collection.id 
                ? 'ring-2 ring-blue-500' 
                : 'hover:ring-1 ring-gray-200'}`}
            aria-label={`Show ${collection.name} collection`}
          >
            <div className="relative h-full w-full">
              <Image
                src={collection.preview || '/collection-fallback.jpg'}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/30 to-transparent" />
              
              <span className="absolute bottom-2 left-2 right-2 text-left text-white 
                font-medium text-sm drop-shadow-md">
                {collection.name}
                
                {collection.launchDate && new Date() < new Date(collection.launchDate) && (
                  <span className="block text-xs text-blue-200 font-normal">
                    Coming {new Date(collection.launchDate).toLocaleDateString()}
                  </span>
                )}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CollectionFilter;