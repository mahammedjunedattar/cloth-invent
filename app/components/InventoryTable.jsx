'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const GENDER_OPTIONS = {
  LADIES: {
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Plus Size'],
    categories: ['Dresses', 'Tops', 'Skirts', 'Jeans', 'Activewear', 'Lingerie', 'Swimwear'],
    measurements: ['Bust', 'Waist', 'Hips']
  },
  GENTS: {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    categories: ['Shirts', 'Trousers', 'Suits', 'Jeans', 'Activewear', 'Outerwear', 'Underwear'],
    measurements: ['Chest', 'Waist', 'Neck']
  }
};

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

export default function InventoryTable({ 
  items: initialItems, 
  selectedColors, 
  selectedSizes,
  onVariantUpdate,
  onVariantDelete
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [sortConfig, setSortConfig] = useState({ key: 'itemName', direction: 'asc' });
  const [editingVariant, setEditingVariant] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    size: '',
    color: '#000000',
    price: 0,
    quantity: 0,
    barcode: '',
    gender: '',
    category: '',
    material: '',
    variants: []
  });

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredItems = items.flatMap(item =>
    item.variants
      .filter(variant => {
        // Size filter
        const sizeMatch = selectedSizes.length === 0 || 
          selectedSizes.includes(variant.size);
        
        // Color filter (convert names to hex)
        const variantColorHex = colorNameToHex(variant.color).toLowerCase();
        const selectedHexColors = selectedColors.map(c => 
          colorNameToHex(c).toLowerCase()
        );
        const colorMatch = selectedColors.length === 0 ||
          selectedHexColors.includes(variantColorHex);
        
        return sizeMatch && colorMatch;
      })
      .map(variant => ({
        ...variant,
        itemName: item.name,
        category: item.category,
        gender: item.gender,
        material: item.material
      }))
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    return sortConfig.direction === 'asc' 
      ? (aVal < bVal ? -1 : 1)
      : (aVal > bVal ? -1 : 1);
  });

  const handleEditClick = (variant) => {
    setEditingVariant(variant.sku);
    setEditFormData({
      ...variant,
      name: variant.itemName,
      variants: [{
        barcode: variant.barcode,
        color: variant.color,
        measurements: variant.measurements || [],
        price: variant.price,
        quantity: variant.quantity,
        size: variant.size,
        sku: variant.sku
      }]
    });
  };

  const handleCancelEdit = () => {
    setEditingVariant(null);
    setEditFormData({
      name: '',
      size: '',
      color: '#000000',
      price: 0,
      quantity: 0,
      barcode: '',
      gender: '',
      category: '',
      material: '',
      variants: []
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: name === 'price' ? parseFloat(value) :
              name === 'quantity' ? Math.max(0, parseInt(value) || 0) :
              value
    }));
  };

  const handleSaveEdit = async (sku) => {
    try {
      const response = await fetch(`/api/items/${sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      
      if (!response.ok) throw new Error('Update failed');
      const serverVariant = await response.json();
      
      setItems(prev =>
        prev.map(item => ({
          ...item,
          variants: item.variants.map(v =>
            v.sku === sku ? { ...v, ...serverVariant } : v
          )
        }))
      );
      
      toast.success('Variant updated successfully');
      onVariantUpdate?.();
    } catch (err) {
      toast.error(err.message || 'Update failed');
      setItems(initialItems);
    } finally {
      setEditingVariant(null);
    }
  };

  const handleDelete = async (sku) => {
    if (!confirm('Delete this variant?')) return;

    try {
      const res = await fetch(`/api/items/${sku}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Variant deleted');
      onVariantDelete?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const columnMap = {
    'Item Name': 'itemName',
    'Category': 'category',
    'Size': 'size',
    'Color': 'color',
    'Price': 'price',
    'Stock': 'quantity',
    'Barcode': 'barcode'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {Object.keys(columnMap).concat('Actions').map((header) => (
                <th
                  key={header}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => columnMap[header] && requestSort(columnMap[header])}
                >
                  {header}
                  {columnMap[header] && sortConfig.key === columnMap[header] && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedItems.map((variant) => (
              <tr key={variant.sku} className={variant.quantity <= 0 ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 text-sm text-gray-900">{variant.itemName}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{variant.category}</td>

                <td className="px-6 py-4 text-sm">
                  {editingVariant === variant.sku ? (
                    <select
                      name="size"
                      value={editFormData.size}
                      onChange={handleEditChange}
                      className="w-full p-1 border rounded"
                    >
                      {GENDER_OPTIONS[variant.gender].sizes.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-medium">{variant.size}</span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm">
                  {editingVariant === variant.sku ? (
                    <input
                      type="color"
                      name="color"
                      value={editFormData.color}
                      onChange={handleEditChange}
                      className="w-8 h-8"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: variant.color }}
                    />
                  )}
                </td>

                <td className="px-6 py-4 text-sm">
                  {editingVariant === variant.sku ? (
                    <input
                      type="number"
                      name="price"
                      value={editFormData.price}
                      onChange={handleEditChange}
                      className="w-20 p-1 border rounded"
                      min="1"
                    />
                  ) : (
                    `$${variant.price.toFixed(2)}`
                  )}
                </td>

                <td className="px-6 py-4 text-sm">
                  {editingVariant === variant.sku ? (
                    <input
                      type="number"
                      name="quantity"
                      value={editFormData.quantity}
                      onChange={handleEditChange}
                      className="w-20 p-1 border rounded"
                      min="0"
                    />
                  ) : (
                    <span className={`font-medium ${variant.quantity <= 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {variant.quantity}
                    </span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm font-mono">
                  {editingVariant === variant.sku ? (
                    <input
                      type="text"
                      name="barcode"
                      value={editFormData.barcode}
                      onChange={handleEditChange}
                      className="w-32 p-1 border rounded"
                    />
                  ) : (
                    variant.barcode
                  )}
                </td>

                <td className="px-6 py-4 text-sm text-right space-x-2">
                  {editingVariant === variant.sku ? (
                    <>
                      <button onClick={() => handleSaveEdit(variant.sku)} className="text-green-600 hover:text-green-900">Save</button>
                      <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEditClick(variant)} className="text-blue-600 hover:text-blue-900">Edit</button>
                      <button onClick={() => handleDelete(variant.sku)} className="text-red-600 hover:text-red-900">Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
