/* This legacy Bangkok player responds to mouse input but ignores touchscreen taps.
 * Convert one finger to one mouse gesture, suppressing the browser's duplicate
 * compatibility mouse events and leaving every other map's touch input intact. */
(() => {
  "use strict";
  let active = null;
  function send(type, touch, target) {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      screenX: touch.screenX,
      screenY: touch.screenY,
      clientX: touch.clientX,
      clientY: touch.clientY,
      detail: 1,
      button: 0,
      buttons: type === "mouseup" || type === "click" ? 0 : 1,
    });
    Object.defineProperty(event, "which", { value: 1 });
    target.dispatchEvent(event);
  }
  function handle(event) {
    if (event.type === "touchstart") {
      if (
        active ||
        event.touches.length !== 1 ||
        event.target.tagName !== "CANVAS"
      )
        return;
      const touch = event.changedTouches[0];
      active = {
        id: touch.identifier,
        target: event.target,
        x: touch.clientX,
        y: touch.clientY,
        moved: false,
        started: performance.now(),
      };
      active.target.focus();
      // Unity keeps mouse position from motion events separately from buttons.
      send("mousemove", touch, active.target);
      send("mousedown", touch, active.target);
    } else {
      if (!active) return;
      const touch = [...event.changedTouches].find(
        (t) => t.identifier === active.id,
      );
      if (!touch) return;
      if (Math.hypot(touch.clientX - active.x, touch.clientY - active.y) > 8)
        active.moved = true;
      if (event.type === "touchmove") send("mousemove", touch, active.target);
      else {
        const gesture = active;
        const click = event.type !== "touchcancel" && !gesture.moved;
        // Unity polls button state each frame. Synthetic down/up in one task
        // can disappear before its first poll, unlike browser-native input.
        setTimeout(
          () => {
            send("mouseup", touch, gesture.target);
            if (click) send("click", touch, gesture.target);
          },
          Math.max(0, 60 - (performance.now() - gesture.started)),
        );
        active = null;
      }
    }
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"])
    window.addEventListener(type, handle, { capture: true, passive: false });
})();
