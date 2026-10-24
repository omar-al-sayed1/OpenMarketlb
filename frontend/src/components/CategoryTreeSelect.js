import React, { useState, memo, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const findAncestorIds = (tree, targetId, path) => {
  path = path || [];
  for (const node of tree) {
    if (node.id === targetId) return path;
    if (node.children && node.children.length > 0) {
      const found = findAncestorIds(node.children, targetId, [...path, node.id]);
      if (found) return found;
    }
  }
  return null;
};

const collectDescendantIds = (node) => {
  let ids = [];
  if (node.children) {
    for (const child of node.children) {
      ids.push(child.id);
      ids = ids.concat(collectDescendantIds(child));
    }
  }
  return ids;
};

const findNodeById = (tree, id) => {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const CategoryTreeNode = memo(function CategoryTreeNode(props) {
  const { node, selectedIds, onToggle, depth } = props;
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedIds.includes(node.id);

  return React.createElement('div', { 'data-testid': 'category-tree-node-' + node.id },
    React.createElement('div', {
      className: 'flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-slate-100 transition-colors group',
      style: { paddingLeft: (depth * 20 + 8) + 'px' }
    },
      hasChildren
        ? React.createElement('button', {
            type: 'button',
            onClick: () => setExpanded(!expanded),
            className: 'flex-shrink-0 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors',
            'data-testid': 'category-expand-' + node.id
          }, expanded
            ? React.createElement(ChevronDown, { className: 'h-3.5 w-3.5' })
            : React.createElement(ChevronRight, { className: 'h-3.5 w-3.5' })
          )
        : React.createElement('span', { className: 'w-5 flex-shrink-0' }),
      React.createElement(Checkbox, {
        id: 'tree-cat-' + node.id,
        checked: isSelected,
        onCheckedChange: () => onToggle(node.id),
        'data-testid': 'category-check-' + node.id,
        className: 'flex-shrink-0'
      }),
      React.createElement('label', {
        htmlFor: 'tree-cat-' + node.id,
        className: 'text-sm cursor-pointer select-none truncate ' +
          (hasChildren ? 'font-medium text-slate-800' : 'text-slate-600') + ' ' +
          (isSelected ? 'text-emerald-700 font-medium' : '')
      }, node.name),
      hasChildren && React.createElement('span', {
        className: 'text-[10px] text-slate-400 ml-auto pr-1 opacity-0 group-hover:opacity-100 transition-opacity'
      }, node.children.length)
    ),
    hasChildren && expanded && React.createElement('div', {
      className: 'border-l border-slate-200',
      style: { marginLeft: (depth * 20 + 18) + 'px' }
    },
      node.children.map(child =>
        React.createElement(CategoryTreeNode, {
          key: child.id,
          node: child,
          selectedIds: selectedIds,
          onToggle: onToggle,
          depth: depth + 1
        })
      )
    )
  );
});

CategoryTreeNode.defaultProps = { depth: 0 };

const CategoryTreeSelect = ({ tree, selectedIds, onToggle, onChange }) => {
  tree = tree || [];
  selectedIds = selectedIds || [];
  const [searchQuery, setSearchQuery] = useState('');

  const filterTree = useCallback((nodes, query) => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    return nodes.reduce((acc, node) => {
      const matches = node.name.toLowerCase().includes(lowerQuery);
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (matches || filteredChildren.length > 0) {
        acc.push({ ...node, children: matches ? (node.children || []) : filteredChildren });
      }
      return acc;
    }, []);
  }, []);

  const filteredTree = filterTree(tree, searchQuery);

  const handleToggle = useCallback((categoryId) => {
    if (onChange) {
      const isCurrentlySelected = selectedIds.includes(categoryId);
      let newSelected;
      if (isCurrentlySelected) {
        const node = findNodeById(tree, categoryId);
        const descendantIds = node ? collectDescendantIds(node) : [];
        const idsToRemove = new Set([categoryId, ...descendantIds]);
        newSelected = selectedIds.filter(id => !idsToRemove.has(id));
      } else {
        const ancestorIds = findAncestorIds(tree, categoryId) || [];
        const idsToAdd = new Set([categoryId, ...ancestorIds]);
        newSelected = [...new Set([...selectedIds, ...idsToAdd])];
      }
      onChange(newSelected);
    } else if (onToggle) {
      onToggle(categoryId);
    }
  }, [onChange, onToggle, selectedIds, tree]);

  if (!tree || tree.length === 0) {
    return React.createElement('div', {
      className: 'p-4 border rounded-lg bg-slate-50 text-sm text-slate-400 text-center'
    }, 'No categories available');
  }

  return React.createElement('div', {
    className: 'border rounded-lg bg-slate-50/80 space-y-0.5',
    'data-testid': 'category-tree-select'
  },
    React.createElement('div', { className: 'p-2 border-b' },
      React.createElement('input', {
        type: 'text',
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        placeholder: 'Search categories...',
        className: 'w-full px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent',
        'data-testid': 'category-search-input'
      })
    ),
    React.createElement('div', { className: 'p-3 max-h-60 overflow-y-auto' },
      filteredTree.length === 0
        ? React.createElement('p', { className: 'text-xs text-slate-400 text-center py-2' }, 'No categories match your search')
        : filteredTree.map(node =>
            React.createElement(CategoryTreeNode, {
              key: node.id,
              node: node,
              selectedIds: selectedIds,
              onToggle: handleToggle
            })
          )
    )
  );
};

export default CategoryTreeSelect;
