import React from 'react';

const ProductCardSkeleton = ({ count = 8 }) => {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl overflow-hidden border border-slate-100 animate-pulse">
          <div className="aspect-square bg-slate-200" />
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 bg-slate-200 rounded-full" />
              <div className="h-3 w-20 bg-slate-200 rounded" />
            </div>
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-3 w-2/3 bg-slate-200 rounded" />
            <div className="flex justify-between pt-1">
              <div className="h-5 w-16 bg-slate-200 rounded" />
              <div className="h-5 w-12 bg-slate-200 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

const LoadingMoreSpinner = () => (
  <div className="col-span-full flex items-center justify-center py-8">
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-[3px] border-violet-200 animate-spin" style={{ borderTopColor: '#5df6fc' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 animate-pulse" />
        </div>
      </div>
      <p className="text-xs text-slate-400 font-medium">Loading more products...</p>
    </div>
  </div>
);

const EndOfListMessage = ({ total }) => (
  <div className="col-span-full flex items-center justify-center py-6">
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
      <p className="text-xs text-slate-500 font-medium">
        All {total} products loaded
      </p>
    </div>
  </div>
);

export { ProductCardSkeleton, LoadingMoreSpinner, EndOfListMessage };
