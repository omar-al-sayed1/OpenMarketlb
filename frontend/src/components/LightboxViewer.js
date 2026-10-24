import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Full-screen lightbox with swipe-to-navigate animation.
 * Props:
 *  - gallery: array of { id, url, caption }
 *  - index: current visible index
 *  - onClose: () => void
 *  - onChangeIndex: (newIndex) => void
 */
const SWIPE_THRESHOLD = 60; // px before commit
const VELOCITY_THRESHOLD = 0.35; // px/ms

const LightboxViewer = ({ gallery, index, onClose, onChangeIndex }) => {
  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const isVerticalRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animating, setAnimating] = useState(false);

  const total = gallery.length;
  const canNavigate = total > 1;

  const goTo = useCallback((newIdx) => {
    if (newIdx < 0 || newIdx >= total) return;
    onChangeIndex(newIdx);
  }, [total, onChangeIndex]);

  const goNext = useCallback(() => {
    if (!canNavigate) return;
    goTo((index + 1) % total);
  }, [canNavigate, goTo, index, total]);

  const goPrev = useCallback(() => {
    if (!canNavigate) return;
    goTo((index - 1 + total) % total);
  }, [canNavigate, goTo, index, total]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  // Touch handlers
  const onTouchStart = (e) => {
    if (animating) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    lastXRef.current = t.clientX;
    startTimeRef.current = performance.now();
    lastTimeRef.current = startTimeRef.current;
    isVerticalRef.current = false;
    setIsDragging(true);
    setDragOffset(0);
  };

  const onTouchMove = (e) => {
    if (!isDragging || animating) return;
    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;
    // Detect vertical scroll intent
    if (!isVerticalRef.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      isVerticalRef.current = true;
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    if (isVerticalRef.current) return;
    // Resistance at edges
    let next = dx;
    if ((index === 0 && dx > 0) || (index === total - 1 && dx < 0)) {
      next = dx * 0.35;
    }
    lastXRef.current = t.clientX;
    lastTimeRef.current = performance.now();
    setDragOffset(next);
  };

  const finishWithAnimation = (targetOffset, callback) => {
    setAnimating(true);
    setDragOffset(targetOffset);
    // After animation finishes, reset
    window.setTimeout(() => {
      setAnimating(false);
      setIsDragging(false);
      setDragOffset(0);
      if (callback) callback();
    }, 260);
  };

  const onTouchEnd = () => {
    if (!isDragging) return;
    const width = trackRef.current?.clientWidth || window.innerWidth;
    const elapsed = Math.max(performance.now() - startTimeRef.current, 1);
    const velocity = Math.abs(dragOffset) / elapsed; // px per ms
    const shouldCommit = Math.abs(dragOffset) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (shouldCommit && dragOffset < 0 && index < total - 1) {
      // Swipe left -> next
      finishWithAnimation(-width, () => onChangeIndex(index + 1));
    } else if (shouldCommit && dragOffset > 0 && index > 0) {
      // Swipe right -> previous
      finishWithAnimation(width, () => onChangeIndex(index - 1));
    } else {
      // Snap back
      finishWithAnimation(0);
    }
  };

  const prevIdx = index > 0 ? index - 1 : null;
  const nextIdx = index < total - 1 ? index + 1 : null;

  return (
    <div
      className="fixed inset-0 z-[120] select-none"
      data-testid="gallery-lightbox-overlay"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sliding track */}
      <div
        ref={trackRef}
        className="absolute inset-0 overflow-hidden touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className={`relative w-full h-full flex items-center ${animating ? 'transition-transform duration-[260ms] ease-out' : ''}`}
          style={{
            transform: `translate3d(${dragOffset}px, 0, 0)`,
          }}
        >
          {/* Previous slide */}
          {prevIdx !== null && (
            <div className="absolute top-0 bottom-0 right-full w-full flex items-center justify-center px-4 sm:px-12">
              <img
                src={gallery[prevIdx].url}
                alt={gallery[prevIdx].caption || ''}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl pointer-events-none"
                draggable={false}
              />
            </div>
          )}

          {/* Current slide */}
          <div className="relative w-full h-full flex items-center justify-center px-4 sm:px-12">
            <img
              src={gallery[index].url}
              alt={gallery[index].caption || ''}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl pointer-events-none"
              data-testid="lightbox-image"
              draggable={false}
            />
          </div>

          {/* Next slide */}
          {nextIdx !== null && (
            <div className="absolute top-0 bottom-0 left-full w-full flex items-center justify-center px-4 sm:px-12">
              <img
                src={gallery[nextIdx].url}
                alt={gallery[nextIdx].caption || ''}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl pointer-events-none"
                draggable={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 z-10"
        data-testid="lightbox-close-btn"
        aria-label="Close gallery viewer"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-sm font-semibold z-10">
        {index + 1} / {total}
      </div>

      {/* Caption */}
      {gallery[index]?.caption && (
        <div className="absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-2xl px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md text-white text-sm text-center border border-white/10 z-10 pointer-events-none">
          {gallery[index].caption}
        </div>
      )}

      {/* Progress dots (mobile-friendly indicator) */}
      {canNavigate && total <= 15 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 z-10">
          {gallery.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to photo ${i + 1}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${i === index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}

      {/* Desktop nav arrows - hidden on phone (swipe is preferred there) */}
      {canNavigate && (
        <button
          onClick={goPrev}
          className="hidden sm:flex absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-all backdrop-blur-md border border-white/10 hover:scale-110 z-10"
          data-testid="lightbox-prev-btn"
          aria-label="Previous photo"
          disabled={index === 0}
          style={{ opacity: index === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {canNavigate && (
        <button
          onClick={goNext}
          className="hidden sm:flex absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-all backdrop-blur-md border border-white/10 hover:scale-110 z-10"
          data-testid="lightbox-next-btn"
          aria-label="Next photo"
          disabled={index === total - 1}
          style={{ opacity: index === total - 1 ? 0.4 : 1 }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Mobile swipe hint - shown briefly on first slide */}
      {canNavigate && index === 0 && (
        <div className="sm:hidden absolute bottom-16 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/70 text-[10px] font-medium z-10 pointer-events-none animate-pulse">
          ← Swipe to navigate →
        </div>
      )}
    </div>
  );
};

export default LightboxViewer;
