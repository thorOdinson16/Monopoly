import React, {useEffect, useRef} from 'react';

export default function ConfirmDialog({title, message, confirmLabel, onConfirm, onCancel}) {
  const cancelRef = useRef(null);
  const cancelAction = useRef(onCancel);
  cancelAction.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();
    const handleKey = event => { if (event.key === 'Escape') cancelAction.current(); };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return <div className="confirm-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
    <h2 id="confirm-title">{title}</h2><p id="confirm-message">{message}</p>
    <div className="confirm-actions"><button ref={cancelRef} type="button" className="confirm-cancel" onClick={onCancel}>Cancel</button><button type="button" className="confirm-destructive" onClick={onConfirm}>{confirmLabel}</button></div>
  </section></div>;
}
