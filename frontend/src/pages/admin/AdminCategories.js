import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, FolderTree, Eye, EyeOff, Image as ImageIcon, Search, X } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageUploader from '../../components/ImageUploader';
import { api } from '../../lib/api';
import { toast } from 'sonner';

// Extracted recursive tree node using React.createElement to avoid Babel stack overflow on JSX recursion
const CategoryTreeNode = React.memo(function CategoryTreeNode(props) {
  const { category, depth = 0, expandedIds, toggleExpand, getLevelBadge, handleAddChild, handleEdit, handleDelete } = props;
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);
  const level = category.level || 1;
  const iconColor = level === 1 ? 'text-violet-500' : level === 2 ? 'text-blue-500' : 'text-teal-500';

  const toggleBtn = hasChildren
    ? React.createElement('button', {
        onClick: () => toggleExpand(category.id),
        className: 'w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 transition-colors',
        'data-testid': 'toggle-' + category.id
      }, isExpanded
        ? React.createElement(ChevronDown, { className: 'h-4 w-4' })
        : React.createElement(ChevronRight, { className: 'h-4 w-4' })
      )
    : React.createElement('button', { className: 'w-6 h-6 invisible' });

  const imageEl = category.image
    ? React.createElement('img', { src: category.image, alt: category.name, className: 'w-8 h-8 rounded-lg object-cover' })
    : React.createElement(FolderTree, { className: 'h-4 w-4 ' + iconColor });

  const hiddenBadge = !category.is_active && React.createElement('span', {
    className: 'px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 flex items-center gap-1'
  }, React.createElement(EyeOff, { className: 'h-3 w-3' }), ' Hidden');

  const actionBtns = React.createElement('div', { className: 'flex items-center gap-1' },
    level < 3 && React.createElement(Button, {
      variant: 'ghost', size: 'sm',
      onClick: () => handleAddChild(category),
      className: 'h-8 w-8 p-0 text-slate-500 hover:text-violet-600',
      title: 'Add subcategory',
      'data-testid': 'add-child-' + category.id
    }, React.createElement(Plus, { className: 'h-4 w-4' })),
    React.createElement(Button, {
      variant: 'ghost', size: 'sm',
      onClick: () => handleEdit(category),
      className: 'h-8 w-8 p-0 text-slate-500 hover:text-blue-600',
      'data-testid': 'edit-' + category.id
    }, React.createElement(Edit, { className: 'h-4 w-4' })),
    React.createElement(Button, {
      variant: 'ghost', size: 'sm',
      onClick: () => handleDelete(category.id),
      className: 'h-8 w-8 p-0 text-slate-500 hover:text-red-600',
      'data-testid': 'delete-' + category.id
    }, React.createElement(Trash2, { className: 'h-4 w-4' }))
  );

  const row = React.createElement('div', {
    className: 'flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg hover:bg-slate-50 transition-colors',
    style: { marginLeft: depth * (window.innerWidth < 640 ? 16 : 24) }
  },
    toggleBtn,
    React.createElement('div', { className: 'flex-1 flex items-center gap-2 sm:gap-3 min-w-0' },
      imageEl,
      React.createElement('span', { className: 'font-medium text-xs sm:text-sm truncate', 'data-testid': 'category-name-' + category.id }, category.name),
      React.createElement('span', { className: 'px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full whitespace-nowrap ' + getLevelBadge(level) }, 'L' + level),
      hiddenBadge
    ),
    actionBtns
  );

  const children = hasChildren && isExpanded && React.createElement('div', { className: 'border-l-2 border-slate-200 ml-6' },
    category.children.map(child =>
      React.createElement(CategoryTreeNode, {
        key: child.id, category: child, depth: depth + 1,
        expandedIds, toggleExpand, getLevelBadge, handleAddChild, handleEdit, handleDelete
      })
    )
  );

  return React.createElement('div', { className: 'select-none' }, row, children);
});

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [filteredTree, setFilteredTree] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    parent_id: null,
    is_active: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTree(categoryTree);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filterTree = (nodes) => {
      return nodes.reduce((acc, node) => {
        const nameMatch = node.name.toLowerCase().includes(q);
        const filteredChildren = node.children ? filterTree(node.children) : [];
        if (nameMatch || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
        }
        return acc;
      }, []);
    };
    setFilteredTree(filterTree(categoryTree));
  }, [searchQuery, categoryTree]);

  const fetchCategories = async () => {
    try {
      const [allRes, treeRes] = await Promise.all([
        api.categories.getAll(),
        api.categories.getTree()
      ]);
      setCategories(allRes.data);
      setCategoryTree(treeRes.data);
      setFilteredTree(treeRes.data);
      
      // Auto-expand all by default
      const allIds = new Set();
      const collectIds = (items) => {
        items.forEach(item => {
          if (item.children?.length > 0) {
            allIds.add(item.id);
            collectIds(item.children);
          }
        });
      };
      collectIds(treeRes.data);
      setExpandedIds(allIds);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        parent_id: formData.parent_id === 'none' ? null : formData.parent_id,
      };
      
      if (editingCategory) {
        await api.categories.update(editingCategory.id, dataToSend);
        toast.success('Category updated');
      } else {
        await api.categories.create(dataToSend);
        toast.success('Category created');
      }

      setDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save category');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      parent_id: category.parent_id || 'none',
      is_active: category.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleAddChild = (parentCategory) => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      parent_id: parentCategory.id,
    }));
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await api.categories.delete(id);
        toast.success('Category deleted');
        fetchCategories();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete category');
      }
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      image: '',
      parent_id: null,
      is_active: true,
    });
  };

  // Get available parent categories (only level 1 and 2 can be parents)
  const getAvailableParents = () => {
    return categories.filter(cat => {
      // Can't select self as parent
      if (editingCategory && cat.id === editingCategory.id) return false;
      // Only level 1 and 2 can be parents (max 3 levels)
      return (cat.level || 1) < 3;
    });
  };

  const getLevelBadge = (level) => {
    const colors = {
      1: 'bg-violet-100 text-violet-700',
      2: 'bg-blue-100 text-blue-700',
      3: 'bg-teal-100 text-teal-700',
    };
    return colors[level] || colors[1];
  };

  return (
    <AdminLayout>
      
      <div className="flex-1 overflow-y-auto p-1 sm:p-2 lg:p-4 admin-table-page compact-table" data-testid="admin-categories-content">
        <div className="flex justify-between items-center mb-4 sm:mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-heading font-bold" data-testid="admin-categories-title">Categories</h1>
            <p className="text-slate-600 mt-1 text-xs sm:text-base">Organize products with up to 3 levels</p>
          </div>
          <Button
            onClick={() => { resetForm(); setDialogOpen(true); }}
            className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-xs sm:text-sm"
            data-testid="add-category-button"
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Add Root </span>Category
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
          <div className="bg-white rounded-xl p-3 sm:p-4 shadow-card">
            <p className="text-slate-600 text-[10px] sm:text-sm">Total</p>
            <p className="text-lg sm:text-2xl font-bold">{categories.length}</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-3 sm:p-4 shadow-card">
            <p className="text-violet-600 text-[10px] sm:text-sm">Root (L1)</p>
            <p className="text-lg sm:text-2xl font-bold text-violet-600">{categories.filter(c => (c.level || 1) === 1).length}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 sm:p-4 shadow-card">
            <p className="text-blue-600 text-[10px] sm:text-sm">Level 2</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{categories.filter(c => c.level === 2).length}</p>
          </div>
          <div className="bg-teal-50 rounded-xl p-3 sm:p-4 shadow-card">
            <p className="text-teal-600 text-[10px] sm:text-sm">Level 3</p>
            <p className="text-lg sm:text-2xl font-bold text-teal-600">{categories.filter(c => c.level === 3).length}</p>
          </div>
        </div>

        {/* Category Tree */}
        <div className="bg-white rounded-xl shadow-card p-6" data-testid="category-tree">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-violet-500" />
              Category Hierarchy
            </h2>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="category-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {filteredTree.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FolderTree className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>{searchQuery ? 'No categories match your search' : 'No categories yet. Add your first root category to get started.'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTree.map(cat => (
                <CategoryTreeNode
                  key={cat.id}
                  category={cat}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  getLevelBadge={getLevelBadge}
                  handleAddChild={handleAddChild}
                  handleEdit={handleEdit}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent data-testid="category-dialog">
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Clothes, T-Shirts, Jeans"
                  data-testid="category-name-input"
                />
              </div>
              
              <div>
                <Label htmlFor="parent">Parent Category</Label>
                <Select 
                  value={formData.parent_id || 'none'} 
                  onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                >
                  <SelectTrigger data-testid="parent-select">
                    <SelectValue placeholder="Select parent (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Category)</SelectItem>
                    {getAvailableParents().map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {'—'.repeat((cat.level || 1) - 1)} {cat.name} (Level {cat.level || 1})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Maximum 3 levels: Root → Child → Grandchild
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  data-testid="category-description-input"
                />
              </div>

              <div>
                <Label>Category Image</Label>
                <ImageUploader
                  value={formData.image}
                  onChange={(url) => setFormData({ ...formData, image: url })}
                  label=""
                  showUrlInput={true}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Show in User Filters</Label>
                  <p className="text-xs text-slate-500">Users can filter products by this category</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  data-testid="is-active-switch"
                />
              </div>

              <Button type="submit" className="w-full" data-testid="save-category-button">
                {editingCategory ? 'Update' : 'Create'} Category
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminCategories;
