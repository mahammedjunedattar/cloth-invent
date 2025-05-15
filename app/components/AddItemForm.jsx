'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import BarcodeScanner from './Barcodescanner';
import { useSession } from 'next-auth/react';

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

export default function AddItemForm({ onSuccess }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    gender: 'LADIES',
    name: '',
    category: '',
    material: '',
    variants: [{
      size: '',
      color: '#000000',
      measurements: {},
      quantity: 0,
      sku: '',
      barcode: '',
      price: 0,
    }]
  });
  const [showScanner, setShowScanner] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => setErrors({}), [formData.gender, formData.category]);

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        size: '',
        color: '#000000',
        measurements: {},
        quantity: 0,
        sku: '',
        barcode: '',
        price: 0,
      }]
    }));
  };

  const generateSKU = (index) => {
    const genderCode = formData.gender === 'LADIES' ? 'W' : 'M';
    const categoryCode = formData.category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
    const sizeCode = formData.variants[index].size.replace(/ /g, '');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    
    return `${genderCode}-${categoryCode}-${sizeCode}-${random}`
      .replace(/[^A-Z0-9_-]/g, '')
      .substring(0, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.material.match(/(\d+% [A-Za-z ]+,?)+/)) newErrors.material = 'Invalid material format';

    formData.variants.forEach((variant, index) => {
      if (!variant.size) newErrors[`variants.${index}.size`] = 'Size required';
      if (variant.price <= 0) newErrors[`variants.${index}.price`] = 'Price must be positive';
      if (!variant.barcode.match(/^[0-9]{12,14}$/)) newErrors[`variants.${index}.barcode`] = 'Invalid barcode';
    });

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      toast.error('Please fix form errors');
      return;
    }

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          storeId: session.user.storeId,
          createdBy: session.user.id,
          material: formData.material.replace(/(\d+%)/g, m => m.toUpperCase()),
          variants: formData.variants.map(variant => ({
            ...variant,
            sku: variant.sku.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
            barcode: variant.barcode.replace(/[^0-9]/g, '')
          }))
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        throw new Error(data.error || 'Failed to add item');
      }

      toast.success(`${formData.gender}'s ${formData.category} added!`);
      router.refresh();
      setFormData({ gender: 'LADIES', name: '', category: '', material: '', variants: [] });
      
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 className="text-2xl font-semibold mb-6 border-b pb-4">
        {formData.gender}'s Wear Inventory
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-2 gap-4 mb-8">
          {Object.keys(GENDER_OPTIONS).map(gender => (
            <button
              key={gender}
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                gender,
                category: '',
                variants: prev.variants.map(v => ({ ...v, size: '' }))
              }))}
              className={`p-4 rounded-lg text-center transition-all
                ${formData.gender === gender ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {gender.charAt(0) + gender.slice(1).toLowerCase()}'s Collection
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Product Name *
              {errors.name && <span className="text-red-500 text-sm ml-2">{errors.name}</span>}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full p-3 border rounded-lg ${errors.name ? 'border-red-500' : ''}`}
              placeholder="e.g., Men's Formal Shirt"
              required
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium">
              {formData.gender === 'LADIES' ? "Women's" : "Men's"} Category *
              {errors.category && <span className="text-red-500 text-sm ml-2">{errors.category}</span>}
            </label>
            <select
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className={`w-full p-3 border rounded-lg ${errors.category ? 'border-red-500' : ''}`}
              required
            >
              <option value="">Select Category</option>
              {GENDER_OPTIONS[formData.gender].categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Material Composition *
              {errors.material && <span className="text-red-500 text-sm ml-2">{errors.material}</span>}
            </label>
            <input
              type="text"
              value={formData.material}
              onChange={e => setFormData(prev => ({ ...prev, material: e.target.value }))}
              className={`w-full p-3 border rounded-lg ${errors.material ? 'border-red-500' : ''}`}
              placeholder="e.g., 95% Cotton, 5% Spandex"
              pattern="(\d+% [A-Za-z ]+,?)+"
              required
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Size & Color Variants</h3>
            <button
              type="button"
              onClick={addVariant}
              className="bg-green-100 text-green-800 px-4 py-2 rounded-lg hover:bg-green-200"
            >
              + Add Variant
            </button>
          </div>

          {formData.variants.map((variant, index) => (
            <div key={index} className="border p-6 rounded-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Size *
                    {errors[`variants.${index}.size`] && (
                      <span className="text-red-500 text-sm ml-2">{errors[`variants.${index}.size`]}</span>
                    )}
                  </label>
                  <select
                    value={variant.size}
                    onChange={e => {
                      const newVariants = [...formData.variants];
                      newVariants[index].size = e.target.value;
                      newVariants[index].sku = generateSKU(index);
                      setFormData(prev => ({ ...prev, variants: newVariants }));
                    }}
                    className={`w-full p-3 border rounded-lg ${errors[`variants.${index}.size`] ? 'border-red-500' : ''}`}
                    required
                  >
                    <option value="">Select Size</option>
                    {GENDER_OPTIONS[formData.gender].sizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={variant.color}
                      onChange={e => {
                        const newVariants = [...formData.variants];
                        newVariants[index].color = e.target.value;
                        setFormData(prev => ({ ...prev, variants: newVariants }));
                      }}
                      className="w-12 h-12 rounded-lg cursor-pointer"
                    />
                    <span className="text-sm">{variant.color.toUpperCase()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Barcode *
                    {errors[`variants.${index}.barcode`] && (
                      <span className="text-red-500 text-sm ml-2">{errors[`variants.${index}.barcode`]}</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={variant.barcode}
                      onChange={e => {
                        const newVariants = [...formData.variants];
                        newVariants[index].barcode = e.target.value.replace(/[^0-9]/g, '');
                        setFormData(prev => ({ ...prev, variants: newVariants }));
                      }}
                      className={`w-full p-3 border rounded-lg ${errors[`variants.${index}.barcode`] ? 'border-red-500' : ''}`}
                      placeholder="12-14 digit barcode"
                      minLength="12"
                      maxLength="14"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowScanner(index)}
                      className="p-3 border rounded-lg hover:bg-gray-50"
                    >
                      📷 Scan
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {GENDER_OPTIONS[formData.gender].measurements.map(measure => (
                  <div key={measure} className="space-y-2">
                    <label className="block text-sm font-medium">
                      {measure} (cm)
                    </label>
                    <input
                      type="number"
                      value={variant.measurements[measure] || ''}
                      onChange={e => {
                        const newVariants = [...formData.variants];
                        newVariants[index].measurements[measure] = e.target.value;
                        setFormData(prev => ({ ...prev, variants: newVariants }));
                      }}
                      className="w-full p-3 border rounded-lg"
                      placeholder={`Enter ${measure.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Price ($) *
                    {errors[`variants.${index}.price`] && (
                      <span className="text-red-500 text-sm ml-2">{errors[`variants.${index}.price`]}</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={variant.price}
                    onChange={e => {
                      const newVariants = [...formData.variants];
                      newVariants[index].price = Math.max(0.01, parseFloat(e.target.value));
                      setFormData(prev => ({ ...prev, variants: newVariants }));
                    }}
                    className={`w-full p-3 border rounded-lg ${errors[`variants.${index}.price`] ? 'border-red-500' : ''}`}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Quantity</label>
                  <input
                    type="number"
                    value={variant.quantity}
                    onChange={e => {
                      const newVariants = [...formData.variants];
                      newVariants[index].quantity = Math.max(0, parseInt(e.target.value));
                      setFormData(prev => ({ ...prev, variants: newVariants }));
                    }}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">SKU</label>
                  <input
                    type="text"
                    value={variant.sku}
                    readOnly
                    className="w-full p-3 border rounded-lg bg-gray-50 font-mono"
                  />
                </div>
              </div>

              {showScanner === index && (
                <div className="mt-6 border-2 border-dashed rounded-xl p-4">
                  <BarcodeScanner 
                    onScan={code => {
                      const newVariants = [...formData.variants];
                      newVariants[index].barcode = code;
                      setFormData(prev => ({ ...prev, variants: newVariants }));
                      setShowScanner(null);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 text-lg font-medium"
        >
          Add {formData.gender === 'LADIES' ? "Women's" : "Men's"} Product
        </button>
      </form>
    </div>
  );
}