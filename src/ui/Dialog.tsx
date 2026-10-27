import { useEffect, useId, useRef, type ReactNode } from "react";

/** Modal built on <dialog>: the browser traps focus, Esc calls onCancel and focus returns afterwards. */
export function Dialog({ title, children, actions, onCancel }: { title: string; children: ReactNode; actions: ReactNode; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal focuses the first button; start on the recommended (primary) one instead.
    d?.querySelector<HTMLElement>(".modal-actions .primary")?.focus();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="modal-body">{children}</div>
      <div className="modal-actions">{actions}</div>
    </dialog>
  );
}
