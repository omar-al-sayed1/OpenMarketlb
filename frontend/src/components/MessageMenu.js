import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Small 3-dots (⋮) options menu for a chat message. Click to reveal Edit / Delete.
 * Delete opens a centered confirmation popup before calling onDelete.
 * Reused by every chat surface (customer, admin, shop, agent).
 *   - onEdit / onDelete: callbacks
 *   - dark: use light-on-dark styling for colored (own) message bubbles
 */
const MessageMenu = ({ onEdit, onDelete, dark = false }) => {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`p-1 rounded-full transition-colors ${dark ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
        title="Message options"
        data-testid="msg-menu-btn"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-40 w-32 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { setOpen(false); onEdit && onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
            data-testid="msg-edit-option"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); setConfirmOpen(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            data-testid="msg-delete-option"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="confirm-delete-message-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be removed from the conversation and shown as “message deleted”. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete && onDelete()} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-confirm">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessageMenu;
