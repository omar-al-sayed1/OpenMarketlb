import React from 'react';
import { cn } from '@/lib/utils';

const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200",
        className
      )}
      {...props}
    />
  );
};

// Product card skeleton
const ProductCardSkeleton = () => (
  <div className="bg-white rounded-xl overflow-hidden border border-slate-100">
    <Skeleton className="aspect-square w-full rounded-none" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex justify-between items-center pt-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  </div>
);

// Table row skeleton
const TableRowSkeleton = ({ cols = 6 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

// Dashboard stat card skeleton
const StatCardSkeleton = () => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-24" />
  </div>
);

// Chart skeleton
const ChartSkeleton = ({ height = 200 }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
    <div className="flex items-center gap-2 mb-4">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-5 w-40" />
    </div>
    <Skeleton className={`w-full rounded-lg`} style={{ height }} />
  </div>
);

// Text line skeleton
const TextSkeleton = ({ lines = 3, className = '' }) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);

// Page header skeleton
const PageHeaderSkeleton = () => (
  <div className="flex items-center justify-between mb-6">
    <Skeleton className="h-9 w-48" />
    <Skeleton className="h-10 w-36 rounded-full" />
  </div>
);

// Form field skeleton
const FormFieldSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-10 w-full rounded-md" />
  </div>
);

export {
  Skeleton,
  ProductCardSkeleton,
  TableRowSkeleton,
  StatCardSkeleton,
  ChartSkeleton,
  TextSkeleton,
  PageHeaderSkeleton,
  FormFieldSkeleton,
};

export default Skeleton;
