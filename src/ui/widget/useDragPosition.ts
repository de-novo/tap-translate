import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefCallback } from "react";
import type { Position } from "../../lib/settings";

function clampPosition(wrap: HTMLElement | null, right: number, bottom: number): Position {
  const rect = wrap?.getBoundingClientRect();
  const width = rect?.width || 56;
  const height = rect?.height || 48;
  return {
    right: Math.min(Math.max(8, right), Math.max(8, window.innerWidth - width - 8)),
    bottom: Math.min(Math.max(8, bottom), Math.max(8, window.innerHeight - height - 8))
  };
}

function isDragIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-drag-handle]")) return false;
  return Boolean(
    target.closest(
      "button, a, input, select, label, textarea, [data-slot='select-trigger'], [data-slot='dropdown-menu-trigger'], [data-slot='checkbox']"
    )
  );
}

export function useDragPosition(
  enabled: boolean,
  position: Position,
  onMove: (next: Position) => void,
  onCommit: (next: Position) => void
) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef(position);
  const onMoveRef = useRef(onMove);
  const onCommitRef = useRef(onCommit);
  const enabledRef = useRef(enabled);
  positionRef.current = position;
  onMoveRef.current = onMove;
  onCommitRef.current = onCommit;
  enabledRef.current = enabled;

  const dragRef = useCallback<RefCallback<HTMLElement>>((el) => {
    setNode(el);
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!enabledRef.current || event.button !== 0 || isDragIgnore(event.target)) return;
    const root = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = root.getBoundingClientRect();
    const startRight = window.innerWidth - rect.right;
    const startBottom = window.innerHeight - rect.bottom;
    let moved = false;

    const onMovePointer = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        moved = true;
        setDragging(true);
      }
      if (!moved) return;
      moveEvent.preventDefault();
      onMoveRef.current(clampPosition(root, startRight - dx, startBottom - dy));
    };

    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMovePointer, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      setDragging(false);
      if (!moved) return;
      endEvent.preventDefault();
      onCommitRef.current(positionRef.current);
      const suppressClick = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
      };
      root.addEventListener("click", suppressClick, true);
      window.setTimeout(() => root.removeEventListener("click", suppressClick, true), 0);
    };

    window.addEventListener("pointermove", onMovePointer, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
  }, []);

  useEffect(() => {
    if (!node) return;
    const onResize = () => {
      onMoveRef.current(clampPosition(node, positionRef.current.right, positionRef.current.bottom));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [node]);

  return { dragging, dragRef, onPointerDown };
}
