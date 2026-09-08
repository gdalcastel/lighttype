import * as THREE from "three";

const TEX_SIZE = 1024;

/** Dark PEI-style build plate texture (slicer-like). */
function drawGrid(ctx: CanvasRenderingContext2D, size: number, inset: number) {
  const usable = size - inset * 2;
  const cells = 20;
  const cell = usable / cells;

  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, usable, usable);
  ctx.clip();

  ctx.strokeStyle = "rgba(150, 156, 164, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= cells; i += 1) {
    const p = inset + i * cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, inset);
    ctx.lineTo(p, inset + usable);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(inset, p);
    ctx.lineTo(inset + usable, p);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(175, 182, 190, 0.38)";
  ctx.lineWidth = 1.25;
  for (let i = 0; i <= cells; i += 5) {
    const p = inset + i * cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, inset);
    ctx.lineTo(p, inset + usable);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(inset, p);
    ctx.lineTo(inset + usable, p);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlateChrome(ctx: CanvasRenderingContext2D, size: number, inset: number) {
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, "rgba(255,255,255,0.04)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(inset + size * 0.028, size * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(220, 226, 232, 0.55)";
  ctx.font = `600 ${size * 0.028}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText("Lighttype Build Plate", 0, 0);
  ctx.restore();

  const stripY = size - inset - size * 0.055;
  ctx.fillStyle = "rgba(210, 216, 222, 0.72)";
  ctx.font = `600 ${size * 0.022}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("PLA  ·  PETG  ·  ABS", inset + size * 0.04, stripY);

  const badge = size * 0.048;
  const bx = size - inset - badge * 0.7;
  const by = size - inset - badge * 0.7;
  const hw = badge * 0.55;
  const hh = badge * 0.4;
  const br = badge * 0.16;
  ctx.fillStyle = "#3ddc84";
  ctx.beginPath();
  ctx.moveTo(bx - hw + br, by - hh);
  ctx.lineTo(bx + hw - br, by - hh);
  ctx.quadraticCurveTo(bx + hw, by - hh, bx + hw, by - hh + br);
  ctx.lineTo(bx + hw, by + hh - br);
  ctx.quadraticCurveTo(bx + hw, by + hh, bx + hw - br, by + hh);
  ctx.lineTo(bx - hw + br, by + hh);
  ctx.quadraticCurveTo(bx - hw, by + hh, bx - hw, by + hh - br);
  ctx.lineTo(bx - hw, by - hh + br);
  ctx.quadraticCurveTo(bx - hw, by - hh, bx - hw + br, by - hh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b1a10";
  ctx.font = `700 ${size * 0.026}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("01", bx, by);

  ctx.strokeStyle = "rgba(80, 200, 120, 0.7)";
  ctx.lineWidth = 2;
  const ox = inset + 2;
  const oy = size - inset - 2;
  const tick = size * 0.035;
  ctx.beginPath();
  ctx.moveTo(ox, oy - tick);
  ctx.lineTo(ox, oy);
  ctx.lineTo(ox + tick, oy);
  ctx.stroke();
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function createFloorTexture(options?: { showGrid?: boolean }): THREE.CanvasTexture {
  const showGrid = options?.showGrid !== false;
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const inset = TEX_SIZE * 0.04;
  const radius = TEX_SIZE * 0.035;

  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  // Match scene background so square plane corners disappear
  ctx.fillStyle = "#383838";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  roundedRectPath(ctx, 0, 0, TEX_SIZE, TEX_SIZE, radius);
  ctx.fillStyle = "#2a2d32";
  ctx.fill();

  roundedRectPath(
    ctx,
    inset * 0.35,
    inset * 0.35,
    TEX_SIZE - inset * 0.7,
    TEX_SIZE - inset * 0.7,
    radius * 0.85,
  );
  ctx.fillStyle = "#32363c";
  ctx.fill();

  if (showGrid) drawGrid(ctx, TEX_SIZE, inset);
  drawPlateChrome(ctx, TEX_SIZE, inset);

  roundedRectPath(ctx, 1, 1, TEX_SIZE - 2, TEX_SIZE - 2, radius);
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 3;
  ctx.stroke();
  roundedRectPath(ctx, 2.5, 2.5, TEX_SIZE - 5, TEX_SIZE - 5, radius * 0.95);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}
