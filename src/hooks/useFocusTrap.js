import { useEffect, useRef } from 'react';

/**
 * useFocusTrap — traps Tab/Shift+Tab focus cycling inside a modal dialog,
 * closes on Escape, and restores focus to the trigger element on close.
 * Real WCAG 2.1 (2.4.3 Focus Order, 2.1.2 No Keyboard Trap-exception-for-modals)
 * behavior — without this, keyboard users can Tab "behind" an open modal
 * into the rest of the page, which is both confusing and a real a11y bug.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @returns {React.RefObject} ref to attach to the modal's outer container
 */
export function useFocusTrap(isOpen, onClose) {
  const containerRef = useRef(null);
  const triggerElRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerElRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(container.querySelectorAll(FOCUSABLE))
      .filter(el => !el.disabled && el.offsetParent !== null);

    // Move initial focus into the modal
    const focusables = getFocusable();
    (focusables[0] || container).focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last  = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to whatever triggered the modal
      triggerElRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  return containerRef;
}
