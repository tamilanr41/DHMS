import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';

/**
 * Safe-navigation guard for forms with unsaved edits.
 *
 * The app uses BrowserRouter/HashRouter (not a data router), so useBlocker is unavailable.
 * Instead a provider intercepts in-app link clicks and exposes `confirmLeave` for
 * programmatic navigation (e.g. Cancel buttons). `beforeunload` covers refresh/window close;
 * the Electron main process shows a native dialog for that case.
 */
const GuardContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const navigate = useNavigate();
  const guardRef = useRef(null); // { dirty: boolean, onSave?: () => Promise<boolean|void> }
  const [pending, setPending] = useState(null); // target path awaiting a decision
  const [saving, setSaving] = useState(false);

  const register = useCallback((state) => {
    guardRef.current = state;
  }, []);

  const confirmLeave = useCallback(
    (to) => {
      if (guardRef.current?.dirty) setPending(to);
      else navigate(to);
    },
    [navigate]
  );

  useEffect(() => {
    const onClick = (e) => {
      if (!guardRef.current?.dirty || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const href = a.getAttribute('href') || '';
      const path = href.startsWith('#/') ? href.slice(1) : href.startsWith('/') ? href : null;
      if (!path) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(path);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!guardRef.current?.dirty) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const go = (to) => {
    guardRef.current = null;
    setPending(null);
    navigate(to);
  };

  const saveAndLeave = async () => {
    const target = pending;
    const onSave = guardRef.current?.onSave;
    if (!onSave) return;
    setSaving(true);
    let ok = false;
    try {
      // onSave must NOT navigate; it resolves true only when the data was stored.
      ok = (await onSave()) === true;
    } finally {
      setSaving(false);
    }
    // On validation/server failure stay on the page so errors are visible.
    if (ok) go(target);
    else setPending(null);
  };

  const value = useMemo(() => ({ register, confirmLeave }), [register, confirmLeave]);
  const canSave = Boolean(guardRef.current?.onSave);

  return (
    <GuardContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Unsaved changes"
        subtitle="You have edits on this page that have not been saved."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>Stay</Button>
            <Button variant="danger" onClick={() => go(pending)} disabled={saving}>Discard</Button>
            {canSave && <Button onClick={saveAndLeave} loading={saving}>Save</Button>}
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-slate-600">
          Leaving now will discard these changes. Choose Stay to keep editing{canSave ? ', or Save to store them' : ''}.
        </p>
      </Modal>
    </GuardContext.Provider>
  );
}

/** Register a form's dirty state. Returns confirmLeave(to) for guarded programmatic navigation. */
export function useUnsavedChanges(dirty, onSave) {
  const ctx = useContext(GuardContext);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!ctx) return undefined;
    ctx.register({ dirty: Boolean(dirty), onSave: saveRef.current ? () => saveRef.current() : undefined });
    return () => ctx.register(null);
  }, [ctx, dirty]);

  return ctx?.confirmLeave ?? (() => {});
}
