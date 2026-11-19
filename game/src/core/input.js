// input.js — keyboard and mouse state for the game. Everything else reads the plain
// `keys` set, the `pressed` edge set (keys that went down since the last frame) and
// the mouse position in canvas pixels; this file owns the listeners and the
// conversion from page coordinates to canvas coordinates.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false };

let attachedCanvas = null;

export function attachInput(canvas) {
  attachedCanvas = canvas;
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      // A press carries its own position: a tap (or a click with no prior
      // mousemove) must land where it fell, not where the pointer last hovered.
      const rect = canvas.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
      mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}

export function moveAxis() {
  // The on-foot / steering axis from the keyboard: x and y in -1..1.
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  return { x, y };
}

export function canvasPoint() {
  return { x: mouse.x, y: mouse.y, canvas: attachedCanvas };
}
