import { useEffect, useRef, useState, type RefObject } from "react";
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
  return Boolean(
    target instanceof Element &&
      target.closest(
        "button, a, input, select, label, textarea, [data-slot='select-trigger'], [data-slot='dropdown-menu-trigger'], [data-slot='checkbox']"
      )
  );
}

export function useDragPosition(
  wrapRef: RefObject<HTMLElement | null>,
  position: Position,
  onMove: (next: Position) => void,
  onCommit: (next: Position) => void
) {
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef(position);
  const onMoveRef = useRef(onMove);
  const onCommitRef = useRef(onCommit);
  positionRef.current = position;
  onMoveRef.current = onMove;
  onCommitRef.current = onCommit;

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    let moved = false;
    let ignoreClick = false;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || isDragIgnore(event.target)) return;
      pointerId = event.pointerId;
      root.setPointerCapture(pointerId);
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      const rect = root.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
    };

    const onMovePointer = (event: PointerEvent) => {
      if (pointerId == null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true;
        setDragging(true);
      }
      if (!moved) return;
      onMoveRef.current(clampPosition(root, startRight - dx, startBottom - dy));
    };

    const onEnd = (event: PointerEvent) => {
      if (pointerId == null) return;
      pointerId = null;
      setDragging(false);
      if (moved) {
        event.preventDefault();
        ignoreClick = true;
        onCommitRef.current(positionRef.current);
      }
    };

    const onClick = (event: MouseEvent) => {
      if (moved || ignoreClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
        ignoreClick = false;
      }
    };

    const onResize = () => {
      onMoveRef.current(clampPosition(root, positionRef.current.right, positionRef.current.bottom));
    };

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMovePointer);
    root.addEventListener("pointerup", onEnd);
    root.addEventListener("pointercancel", onEnd);
    root.addEventListener("click", onClick, true);
    window.addEventListener("resize", onResize);
    return () => {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMovePointer);
      root.removeEventListener("pointerup", onEnd);
      root.removeEventListener("pointercancel", onEnd);
      root.removeEventListener("click", onClick, true);
      window.removeEventListener("resize", onResize);
    };
  }, [wrapRef]);

  return { dragging, clamp: (right: number, bottom: number) => clampPosition(wrapRef.current, right, bottom) };
}
