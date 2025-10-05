import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ManageCategoriesScreenProps {
  isOpen: boolean;
  onBack: () => void;
}

interface Category {
  id: number;
  name: string;
  emoji: string;
  user_id: string;
}

interface AddCategoryScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  category: Category;
}

const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmoji('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !emoji.trim()) {
      setError('Please enter both name and emoji');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Create new category with required user_id
      const { error: insertError } = await supabase
        .from('categories')
        .insert({ 
          name: name.trim(), 
          emoji: emoji.trim(),
          user_id: user.id
        });

      if (insertError) {
        throw insertError;
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving category:', error);
      setError(error.message || 'Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-25 z-[80] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Add Category Panel */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-gray-100 z-[90] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ maxWidth: '80vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 bg-gray-100">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800">
            Add New Category
          </h1>
          <div className="w-10" /> {/* Spacer for center alignment */}
        </div>

        {/* Form Content */}
        <div className="flex-1 px-6 pb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter category name"
                  maxLength={50}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emoji
                </label>
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl"
                  placeholder="🛍️"
                  maxLength={2}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setEmoji(category.emoji);
    }
    setError('');
  }, [category, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !emoji.trim()) {
      setError('Please enter both name and emoji');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Update existing category scoped to user
      const { error: updateError } = await supabase
        .from('categories')
        .update({ name: name.trim(), emoji: emoji.trim() })
        .eq('id', category.id)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving category:', error);
      setError(error.message || 'Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-[120] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`fixed inset-0 z-[130] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Edit Category
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter category name"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Emoji
              </label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl"
                placeholder="🛍️"
                maxLength={2}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

const ManageCategoriesScreen: React.FC<ManageCategoriesScreenProps> = ({ isOpen, onBack }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddCategoryScreen, setShowAddCategoryScreen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Fetch categories strictly scoped to user
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) {
        throw fetchError;
      }

      setCategories(data || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      setError(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('Attempting to delete category:', category.id);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Attempt to delete the category from the database
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Database deletion error:', deleteError);
        
        // Check if it's a foreign key constraint error
        if (deleteError.code === '23503' || deleteError.message.includes('foreign key') || deleteError.message.includes('violates')) {
          alert('Failed to delete category. Please make sure no expenses are linked to it.');
          return;
        }
        
        // For other errors, show a generic message
        alert('Failed to delete category. Please try again.');
        return;
      }

      console.log('Database deletion successful');

      // Update local UI state by filtering out the deleted category
      setCategories(prevCategories => 
        prevCategories.filter(cat => cat.id !== category.id)
      );

      console.log('Local state updated successfully');

    } catch (error: any) {
      console.error('Error deleting category:', error);
      
      // Check if it's a foreign key constraint error
      if (error.message && (error.message.includes('foreign key') || error.message.includes('violates'))) {
        alert('Failed to delete category. Please make sure no expenses are linked to it.');
      } else {
        alert('Failed to delete category. Please try again.');
      }
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowEditModal(true);
  };

  const handleAddCategory = () => {
    setShowAddCategoryScreen(true);
  };

  const handleAddCategoryClose = () => {
    setShowAddCategoryScreen(false);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditingCategory(null);
  };

  const handleCategorySave = async () => {
    await fetchCategories();
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-25 z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onBack}
      />
      
      {/* Categories Panel */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-gray-100 z-[70] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ maxWidth: '80vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 bg-gray-100">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800">
            Manage Categories
          </h1>
          <div className="w-10" /> {/* Spacer for center alignment */}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 pb-6">
          {/* Add New Category Button */}
          <button
            onClick={handleAddCategory}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl mb-4 flex items-center justify-center space-x-2 transition-colors"
          >
            <Plus size={20} />
            <span>Add New Category</span>
          </button>

          {/* Categories List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div style={{ color: '#6B7280' }}>Loading categories...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div style={{ color: '#DC2626' }}>{error}</div>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div 
                className="text-lg font-medium mb-2"
                style={{ color: '#6B7280' }}
              >
                No categories yet
              </div>
              <div 
                className="text-sm"
                style={{ color: '#9CA3AF' }}
              >
                Add your first category to get started
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  {/* Left side - Category info */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      {category.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div 
                        className="font-medium truncate"
                        style={{ color: '#1C1C1E' }}
                      >
                        {category.name}
                      </div>
                    </div>
                  </div>

                  {/* Right side - Action buttons */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit category"
                    >
                      <Edit size={16} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete category"
                    >
                      <X size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Category Screen */}
      <AddCategoryScreen
        isOpen={showAddCategoryScreen}
        onClose={handleAddCategoryClose}
        onSave={handleCategorySave}
      />

      {/* Edit Category Modal */}
      {editingCategory && (
        <EditCategoryModal
          isOpen={showEditModal}
          onClose={handleEditModalClose}
          onSave={handleCategorySave}
          category={editingCategory}
        />
      )}
    </>
  );
};

export default ManageCategoriesScreen;