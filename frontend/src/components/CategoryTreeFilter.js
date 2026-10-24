import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const getAllCatIds = (cat) => {
  let ids = [cat.id];
  if (cat.children) {
    cat.children.forEach(c => { ids = ids.concat(getAllCatIds(c)); });
  }
  return ids;
};

const CategoryNode = memo(function CategoryNode(props) {
  const { category, depth, expandedIds, toggleExpand, selectedCategories, onCategoryToggle, hasSelectedDescendant, productCounts, hideProductCounts, darkMode, language } = props;
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);
  const isSelected = selectedCategories.includes(category.id);
  const hasSelectedChild = hasChildren && hasSelectedDescendant(category) && !isSelected;
  const level = category.level || 1;

  const colorClass = level === 1 ? 'text-slate-800 dark:text-slate-200' : level === 2 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-600 dark:text-slate-400';
  const allIds = getAllCatIds(category);
  const totalProducts = allIds.reduce((sum, id) => sum + (productCounts[id] || 0), 0);

  return React.createElement('div', null,
    React.createElement('div', {
      className: 'flex items-center gap-1.5 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group',
      style: { paddingLeft: depth * 16 }
    },
      hasChildren
        ? React.createElement('button', {
            onClick: (e) => toggleExpand(category.id, e),
            className: 'w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 transition-colors',
            'data-testid': 'filter-toggle-' + category.id
          }, isExpanded
            ? React.createElement(ChevronDown, { className: 'h-3.5 w-3.5 text-slate-500' })
            : React.createElement(ChevronRight, { className: 'h-3.5 w-3.5 text-slate-500' })
          )
        : React.createElement('span', { className: 'w-5' }),
      React.createElement(Checkbox, {
        id: 'filter-cat-' + category.id,
        checked: isSelected,
        onCheckedChange: () => onCategoryToggle(category.id),
        className: hasSelectedChild ? 'data-[state=unchecked]:bg-slate-200' : '',
        'data-testid': 'category-filter-' + category.id
      }),
      React.createElement('label', {
        htmlFor: 'filter-cat-' + category.id,
        className: 'text-xs cursor-pointer flex-1 flex items-center gap-1.5 ' + colorClass + ' group-hover:opacity-80 transition-opacity'
      },
        React.createElement('span', { className: isSelected ? 'font-medium' : '' }, language === 'ar' && category.name_ar ? category.name_ar : category.name),
        !hideProductCounts && totalProducts > 0 && React.createElement('span', { className: 'text-slate-400 text-[10px]' }, '(' + totalProducts + ')')
      )
    ),
    hasChildren && isExpanded && React.createElement('div', { className: 'border-l border-slate-200 dark:border-slate-700 ml-2.5' },
      category.children.map(child =>
        React.createElement(CategoryNode, {
          key: child.id,
          category: child,
          depth: depth + 1,
          expandedIds: expandedIds,
          toggleExpand: toggleExpand,
          selectedCategories: selectedCategories,
          onCategoryToggle: onCategoryToggle,
          hasSelectedDescendant: hasSelectedDescendant,
          productCounts: productCounts,
          hideProductCounts: hideProductCounts,
          darkMode: darkMode,
          language: language
        })
      )
    )
  );
});

CategoryNode.defaultProps = { depth: 0 };

const CategoryTreeFilter = ({ categoryTree, selectedCategories, onCategoryToggle, externalProductCounts, hideProductCounts, darkMode }) => {
  const { language } = useLanguage();
  const [expandedIds, setExpandedIds] = useState(new Set());
  const initialExpandDone = useRef(false);
  const [productCounts, setProductCounts] = useState({});

  useEffect(() => {
    // If external counts provided (e.g. from shop page), use those
    if (externalProductCounts) {
      setProductCounts(externalProductCounts);
      return;
    }
    const fetchCounts = async () => {
      try {
        const { data: products } = await api.products.getAll({ is_active: true });
        const counts = {};
        products.forEach(p => {
          (p.category_ids || []).forEach(cid => {
            counts[cid] = (counts[cid] || 0) + 1;
          });
        });
        setProductCounts(counts);
      } catch (e) { /* ignore */ }
    };
    fetchCounts();
  }, [externalProductCounts]);

  useEffect(() => {
    if (!initialExpandDone.current && categoryTree.length > 0) {
      initialExpandDone.current = true;
      if (selectedCategories.length > 0) {
        const newExpanded = new Set();
        const findAndExpandParents = (categories, parentIds) => {
          categories.forEach(cat => {
            if (selectedCategories.includes(cat.id)) {
              parentIds.forEach(id => newExpanded.add(id));
            }
            if (cat.children && cat.children.length > 0) {
              findAndExpandParents(cat.children, [...parentIds, cat.id]);
            }
          });
        };
        findAndExpandParents(categoryTree, []);
        if (newExpanded.size > 0) setExpandedIds(newExpanded);
      }
    }
  }, [categoryTree, selectedCategories]);

  const toggleExpand = useCallback((id, e) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const hasSelectedDescendant = useCallback((category) => {
    if (selectedCategories.includes(category.id)) return true;
    if (category.children) {
      return category.children.some(child => hasSelectedDescendant(child));
    }
    return false;
  }, [selectedCategories]);

  if (!categoryTree || categoryTree.length === 0) {
    return React.createElement('div', { className: 'text-xs text-slate-500 py-2' }, 'No categories available');
  }

  return React.createElement('div', { className: 'space-y-0.5', 'data-testid': 'category-tree-filter' },
    categoryTree.map(cat =>
      React.createElement(CategoryNode, {
        key: cat.id,
        category: cat,
        expandedIds: expandedIds,
        toggleExpand: toggleExpand,
        selectedCategories: selectedCategories,
        onCategoryToggle: onCategoryToggle,
        hasSelectedDescendant: hasSelectedDescendant,
        productCounts: productCounts,
        hideProductCounts: hideProductCounts,
        darkMode: darkMode,
        language: language
      })
    )
  );
};

export default CategoryTreeFilter;
