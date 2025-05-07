'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  COLS,
  ROWS,
  CELL,
  RADIUS,
  STEP,
  TICK,
  BOOST_MULT,
  MAX_LEN,
  MARGIN,
  LERP,
  MINIMAP_SIZE,
  MINIMAP_PADDING,
  MINIMAP_SCALE,
  MIN_TAIL_SCALE,
  IMAGE_BLOCKS,
} from '@/lib/constants';
import { PALETTE, SNAKE_COL } from '@/lib/colors';
import { useIconOverlay } from '@/lib/icon-overlay';
import { extraMosaics, getExtraOverlayIcons } from '@/lib/extra-mosaics';

type Pos = { x: number; y: number };

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};

const isDev = process.env.NODE_ENV === 'development';

export default function CanvasContribMap({ grid: initialGrid, imageSrc }: { grid: string[][]; imageSrc?: string }) {
  const [showPopup, setShowPopup] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const gridRef = useRef<string[][]>(Array.from({ length: COLS }, (_, x) => initialGrid.map(row => row[x])));

  const dirRef = useRef<[number, number]>([0, 1]);
  const queueRef = useRef<[number, number][]>([]);
  const boostRef = useRef(false);
  const shakeIntensity = useRef(0);
  const snakeYOffset = 20;
  const initialHead: Pos = {
    x: Math.floor(COLS / 2),
    y: Math.floor(ROWS / 2) + snakeYOffset,
  };
  const snakeRef = useRef<Pos[]>([initialHead]);
  const lengthRef = useRef(MAX_LEN);
  const target = useRef<Pos>({ ...initialHead });
  const smooth = useRef<Pos>({ ...initialHead });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const imageOffsetX = Math.floor((COLS - IMAGE_BLOCKS) / 2);
  const imageOffsetY = Math.floor((ROWS - IMAGE_BLOCKS) / 2);
  const mosaicYOffset = Math.floor(snakeYOffset / 2);

  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text?: string;
  }>({ visible: false, x: 0, y: 0, text: '' });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedColorKey, setSelectedColorKey] = useState<string>('1');
  const [isPainting, setIsPainting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = COLS * STEP;
    off.height = ROWS * STEP;
    gridCanvasRef.current = off;
    const gctx = off.getContext('2d')!;

    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        roundRect(gctx, x * STEP, y * STEP, CELL, CELL, RADIUS, PALETTE[gridRef.current[x][y]]);
      }
    }

    const blocks = IMAGE_BLOCKS;
    const spacing = 3;
    const mosaicSpacing = blocks + spacing;
    const offsetXs = [imageOffsetX - mosaicSpacing, imageOffsetX, imageOffsetX + mosaicSpacing];
    const sources = ['/linkedin.png', imageSrc || '/github.png', '/email.png'];
    offsetXs.forEach((offsetX, idx) => {
      const img = new Image();
      img.onload = () => {
        const sw = img.width / blocks;
        const sh = img.height / blocks;
        const baseY = imageOffsetY + mosaicYOffset;
        for (let ix = 0; ix < blocks; ix++) {
          for (let iy = 0; iy < blocks; iy++) {
            const sx = ix * sw;
            const sy = iy * sh;
            const dx = (offsetX + ix) * STEP;
            const dy = (baseY + iy) * STEP;
            gctx.save();
            gctx.beginPath();
            gctx.moveTo(dx + RADIUS, dy);
            gctx.lineTo(dx + CELL - RADIUS, dy);
            gctx.quadraticCurveTo(dx + CELL, dy, dx + CELL, dy + RADIUS);
            gctx.lineTo(dx + CELL, dy + CELL - RADIUS);
            gctx.quadraticCurveTo(dx + CELL, dy + CELL, dx + CELL - RADIUS, dy + CELL);
            gctx.lineTo(dx + RADIUS, dy + CELL);
            gctx.quadraticCurveTo(dx, dy + CELL, dx, dy + CELL - RADIUS);
            gctx.lineTo(dx, dy + RADIUS);
            gctx.quadraticCurveTo(dx, dy, dx + RADIUS, dy);
            gctx.closePath();
            gctx.clip();
            gctx.drawImage(img, sx, sy, sw, sh, dx, dy, CELL, CELL);
            gctx.restore();
          }
        }
      };
      img.src = sources[idx];
    });

    extraMosaics.forEach(({ src, offsetX, offsetY, blocks }) => {
      const img = new Image();
      img.onload = () => {
        const heightBlocks = blocks;
        const widthBlocks = Math.round((img.width / img.height) * heightBlocks);
        const sw2 = img.width / widthBlocks;
        const sh2 = img.height / heightBlocks;
        for (let ix = 0; ix < widthBlocks; ix++) {
          for (let iy = 0; iy < heightBlocks; iy++) {
            const sx2 = ix * sw2;
            const sy2 = iy * sh2;
            const dx2 = (offsetX + ix) * STEP;
            const dy2 = (offsetY + iy) * STEP;
            gctx.save();
            gctx.beginPath();
            gctx.moveTo(dx2 + RADIUS, dy2);
            gctx.lineTo(dx2 + CELL - RADIUS, dy2);
            gctx.quadraticCurveTo(dx2 + CELL, dy2, dx2 + CELL, dy2 + RADIUS);
            gctx.lineTo(dx2 + CELL, dy2 + CELL - RADIUS);
            gctx.quadraticCurveTo(dx2 + CELL, dy2 + CELL, dx2 + CELL - RADIUS, dy2 + CELL);
            gctx.lineTo(dx2 + RADIUS, dy2 + CELL);
            gctx.quadraticCurveTo(dx2, dy2 + CELL, dx2, dy2 + CELL - RADIUS);
            gctx.lineTo(dx2, dy2 + RADIUS);
            gctx.quadraticCurveTo(dx2, dy2, dx2 + RADIUS, dy2);
            gctx.closePath();
            gctx.clip();
            gctx.drawImage(img, sx2, sy2, sw2, sh2, dx2, dy2, CELL, CELL);
            gctx.restore();
          }
        }
        for (let ix = 0; ix < widthBlocks; ix++) {
          for (let iy = 0; iy < heightBlocks; iy++) {
            gridRef.current[offsetX + ix][offsetY + iy] = '1';
          }
        }
      };
      img.src = src;
    });
    setShowPopup(true);
  }, [initialGrid, imageSrc, imageOffsetX, imageOffsetY, mosaicYOffset]);

  useIconOverlay({
    canvasRef,
    targetRef: target,
    icons: [
      ...(['linkedin', 'github', 'email'] as const).map((key, idx) => {
        const blocks = IMAGE_BLOCKS;
        const spacing = 3;
        const mosaicSpacing = blocks + spacing;
        const hrefMap: Record<string, string> = {
          linkedin: 'https://www.linkedin.com/in/sagarpatel211',
          github: 'https://github.com/sagarpatel211',
          email: 'mailto:2sagarpatel2@gmail.com',
        };
        const tooltipMap: Record<string, string> = {
          linkedin: 'Visit my LinkedIn!',
          github: 'Visit my GitHub!',
          email: 'Email me: 2sagarpatel2@gmail.com',
        };
        return {
          offsetX: [imageOffsetX - mosaicSpacing, imageOffsetX, imageOffsetX + mosaicSpacing][idx],
          offsetY: imageOffsetY + mosaicYOffset,
          size: blocks,
          onClick: () => window.open(hrefMap[key], '_blank'),
          tooltipText: tooltipMap[key],
        };
      }),
      ...getExtraOverlayIcons(),
    ],
    setTooltip,
  });

  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = MINIMAP_SIZE;
    off.height = MINIMAP_SIZE;
    minimapCanvasRef.current = off;
    const mctx = off.getContext('2d')!;
    mctx.fillStyle = '#0d1117';
    mctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    for (let x = 0; x < COLS; x += 4) {
      for (let y = 0; y < ROWS; y += 4) {
        roundRect(
          mctx,
          x * MINIMAP_SCALE,
          y * MINIMAP_SCALE,
          MINIMAP_SCALE * 2,
          MINIMAP_SCALE * 2,
          1.2,
          PALETTE[gridRef.current[x][y]]
        );
      }
    }
  }, [initialGrid]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      const vw = Math.floor(window.innerWidth / STEP);
      const vh = Math.floor(window.innerHeight / STEP);

      const headX = Math.floor(COLS / 2);
      const headY = Math.floor(ROWS / 2);
      target.current.x = clamp(headX - Math.floor(vw / 2), 0, COLS - vw);
      target.current.y = clamp(headY - Math.floor(vh / 2), 0, ROWS - vh);

      smooth.current.x = target.current.x;
      smooth.current.y = target.current.y;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dpr]);

  useEffect(() => {
    const tick = () => {
      if (showPopup || isEditing) return;
      const reps = boostRef.current ? BOOST_MULT : 1;
      shakeIntensity.current = boostRef.current ? 2 + Math.random() * 2 : 0;
      for (let i = 0; i < reps; i++) {
        if (queueRef.current.length) {
          dirRef.current = queueRef.current.shift()!;
        }

        const [dx, dy] = dirRef.current;
        const head = snakeRef.current[0];
        const nx = (head.x + dx + COLS) % COLS;
        const ny = (head.y + dy + ROWS) % ROWS;

        if (gridRef.current[nx][ny] !== '0' && gridRef.current[nx][ny] !== '-') {
          gridRef.current[nx][ny] = '-';
          const gctx = gridCanvasRef.current!.getContext('2d')!;
          const px = nx * STEP;
          const py = ny * STEP;
          gctx.clearRect(px, py, STEP, STEP);
          const isImgBlock =
            nx >= imageOffsetX &&
            nx < imageOffsetX + IMAGE_BLOCKS &&
            ny >= imageOffsetY &&
            ny < imageOffsetY + IMAGE_BLOCKS;
          if (isImgBlock && imgRef.current) {
            const img = imgRef.current;
            const sw = img.width / IMAGE_BLOCKS;
            const sh = img.height / IMAGE_BLOCKS;
            const ix = nx - imageOffsetX;
            const iy = ny - imageOffsetY;
            const sx = ix * sw;
            const sy = iy * sh;
            gctx.save();
            gctx.beginPath();
            gctx.moveTo(px + RADIUS, py);
            gctx.lineTo(px + CELL - RADIUS, py);
            gctx.quadraticCurveTo(px + CELL, py, px + CELL, py + RADIUS);
            gctx.lineTo(px + CELL, py + CELL - RADIUS);
            gctx.quadraticCurveTo(px + CELL, py + CELL, px + CELL - RADIUS, py + CELL);
            gctx.lineTo(px + RADIUS, py + CELL);
            gctx.quadraticCurveTo(px, py + CELL, px, py + CELL - RADIUS);
            gctx.lineTo(px, py + RADIUS);
            gctx.quadraticCurveTo(px, py, px + RADIUS, py);
            gctx.closePath();
            gctx.clip();
            gctx.filter = 'grayscale(100%) brightness(200%) opacity(0.3)';
            gctx.drawImage(img, sx, sy, sw, sh, px, py, CELL, CELL);
            gctx.restore();
          } else {
            roundRect(gctx, px, py, CELL, CELL, RADIUS, PALETTE['0']);
          }
          const mctx = minimapCanvasRef.current!.getContext('2d')!;
          const mx = nx * MINIMAP_SCALE;
          const my = ny * MINIMAP_SCALE;
          const s = MINIMAP_SCALE * 2;
          mctx.fillStyle = PALETTE['0'];
          mctx.fillRect(mx, my, s, s);
        }

        snakeRef.current.unshift({ x: nx, y: ny });
        if (snakeRef.current.length > lengthRef.current) {
          snakeRef.current.pop();
        }

        const vw = Math.floor(window.innerWidth / STEP);
        const vh = Math.floor(window.innerHeight / STEP);
        let tx = target.current.x;
        let ty = target.current.y;
        if (nx - tx < MARGIN) tx = clamp(nx - MARGIN, 0, COLS - vw);
        if (nx - tx > vw - MARGIN - 1) tx = clamp(nx - (vw - MARGIN - 1), 0, COLS - vw);
        if (ny - ty < MARGIN) ty = clamp(ny - MARGIN, 0, ROWS - vh);
        if (ny - ty > vh - MARGIN - 1) ty = clamp(ny - (vh - MARGIN - 1), 0, ROWS - vh);
        target.current = { x: tx, y: ty };
      }
    };

    const down = (e: KeyboardEvent) => {
      if (isEditing) {
        const dir = DIRS[e.key];
        if (!dir) return;
        e.preventDefault();
        const [dx, dy] = dir;
        const vw = Math.floor(window.innerWidth / STEP);
        const vh = Math.floor(window.innerHeight / STEP);
        let tx = target.current.x + dx;
        let ty = target.current.y + dy;
        tx = clamp(tx, 0, COLS - vw);
        ty = clamp(ty, 0, ROWS - vh);
        target.current = { x: tx, y: ty };
        smooth.current = { x: tx, y: ty };
        return;
      }
      if (e.code === 'Space') {
        boostRef.current = true;
      } else {
        const dir = DIRS[e.key];
        if (!dir) return;
        const last = queueRef.current[queueRef.current.length - 1] || dirRef.current;
        if (dir[0] === -last[0] && dir[1] === -last[1]) return;
        queueRef.current.push(dir);
        queueRef.current = queueRef.current.slice(-3);
      }
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') boostRef.current = false;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const id = setInterval(tick, TICK);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [imageOffsetX, imageOffsetY, showPopup, isEditing]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      smooth.current.x = lerp(smooth.current.x, target.current.x, LERP);
      smooth.current.y = lerp(smooth.current.y, target.current.y, LERP);

      const shakeX = (Math.random() - 0.5) * shakeIntensity.current;
      const shakeY = (Math.random() - 0.5) * shakeIntensity.current;
      const ox = smooth.current.x + shakeX / STEP;
      const oy = smooth.current.y + shakeY / STEP;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (gridCanvasRef.current) {
        ctx.drawImage(
          gridCanvasRef.current,
          ox * STEP,
          oy * STEP,
          window.innerWidth,
          window.innerHeight,
          0,
          0,
          window.innerWidth,
          window.innerHeight
        );
      }

      if (!isEditing) {
        const segs = snakeRef.current;
        const len = segs.length;
        for (let i = 0; i < len; i++) {
          const seg = segs[i];
          const t = i / (len - 1);
          const scale = lerp(1, MIN_TAIL_SCALE, t);
          const size = CELL * scale;
          const o = (CELL - size) / 2;
          const dx = (seg.x - ox) * STEP + o;
          const dy = (seg.y - oy) * STEP + o;
          roundRect(ctx, dx, dy, size, size, RADIUS, SNAKE_COL);
        }
      }

      const mx = window.innerWidth - MINIMAP_SIZE - MINIMAP_PADDING;
      const my = window.innerHeight - MINIMAP_SIZE - MINIMAP_PADDING;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(mx - 1, my - 1, MINIMAP_SIZE + 2, MINIMAP_SIZE + 2);
      if (minimapCanvasRef.current) {
        ctx.drawImage(minimapCanvasRef.current, mx, my);
      }

      const head = snakeRef.current[0];
      roundRect(
        ctx,
        mx + head.x * MINIMAP_SCALE,
        my + head.y * MINIMAP_SCALE,
        MINIMAP_SCALE * 2,
        MINIMAP_SCALE * 2,
        1.5,
        SNAKE_COL
      );

      ctx.strokeStyle = '#ffffff33';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mx + ox * MINIMAP_SCALE,
        my + oy * MINIMAP_SCALE,
        (window.innerWidth / STEP) * MINIMAP_SCALE,
        (window.innerHeight / STEP) * MINIMAP_SCALE
      );

      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }, [dpr, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const canvas = canvasRef.current!;
    const handleMouseDown = (e: MouseEvent) => {
      setIsPainting(true);
      paintCell(e);
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (isPainting) paintCell(e);
    };
    const handleMouseUp = () => setIsPainting(false);
    const paintCell = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cellX = Math.floor(mx / STEP);
      const cellY = Math.floor(my / STEP);
      const worldX = target.current.x + cellX;
      const worldY = target.current.y + cellY;
      gridRef.current[worldX][worldY] = selectedColorKey;
      const gctx = gridCanvasRef.current!.getContext('2d')!;
      const px = worldX * STEP;
      const py = worldY * STEP;
      roundRect(gctx, px, py, CELL, CELL, RADIUS, PALETTE[selectedColorKey]);
      const mctx = minimapCanvasRef.current!.getContext('2d')!;
      mctx.fillStyle = PALETTE[selectedColorKey];
      const mx2 = worldX * MINIMAP_SCALE;
      const my2 = worldY * MINIMAP_SCALE;
      mctx.fillRect(mx2, my2, MINIMAP_SCALE * 2, MINIMAP_SCALE * 2);
    };
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isEditing, isPainting, selectedColorKey]);

  useEffect(() => {
    let startX: number, startY: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isEditing && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const cellDx = Math.round(dx / STEP);
        const cellDy = Math.round(dy / STEP);
        const vw = Math.floor(window.innerWidth / STEP);
        const vh = Math.floor(window.innerHeight / STEP);
        const tx = clamp(target.current.x - cellDx, 0, COLS - vw);
        const ty = clamp(target.current.y - cellDy, 0, ROWS - vh);
        target.current = { x: tx, y: ty };
        smooth.current = { x: tx, y: ty };
        startX = touch.clientX;
        startY = touch.clientY;
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEditing) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let dir: [number, number] | null = null;
        if (absDx > absDy && absDx > 20) dir = dx > 0 ? [1, 0] : [-1, 0];
        else if (absDy > absDx && absDy > 20) dir = dy > 0 ? [0, 1] : [0, -1];
        if (dir) {
          const last = queueRef.current[queueRef.current.length - 1] || dirRef.current;
          if (!(dir[0] === -last[0] && dir[1] === -last[1])) {
            queueRef.current.push(dir);
            queueRef.current = queueRef.current.slice(-3);
          }
        }
      }
    };
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isEditing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isEditing || !canvas) {
      setHoverCell(null);
      return;
    }
    const handleHover = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cellX = Math.floor(mx / STEP) + target.current.x;
      const cellY = Math.floor(my / STEP) + target.current.y;
      setHoverCell({ x: cellX, y: cellY });
    };
    canvas.addEventListener('mousemove', handleHover);
    return () => {
      canvas.removeEventListener('mousemove', handleHover);
      setHoverCell(null);
    };
  }, [isEditing, target]);

  const saveMap = async () => {
    const blocks = IMAGE_BLOCKS;
    const spacing = 3;
    const mosaicSpacing = blocks + spacing;
    const offsetXs = [imageOffsetX - mosaicSpacing, imageOffsetX, imageOffsetX + mosaicSpacing];
    const y0 = imageOffsetY + mosaicYOffset;
    const originalMosaics = offsetXs.map(offX => ({ offsetX: offX, offsetY: y0, blocks }));
    const allMosaics = [...originalMosaics, ...extraMosaics];
    const rows = Array.from({ length: ROWS }, (_, y) =>
      gridRef.current
        .map((col, x) => {
          if (
            allMosaics.some(
              m => x >= m.offsetX && x < m.offsetX + m.blocks && y >= m.offsetY && y < m.offsetY + m.blocks
            )
          ) {
            return '0';
          }
          return col[y];
        })
        .join('')
    );
    try {
      await fetch('/api/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid: rows }),
      });
      setToast({ visible: true, message: 'File saved!' });
      setTimeout(() => setToast({ visible: false, message: '' }), 3000);
      setIsEditing(false);
    } catch {
      setToast({ visible: true, message: 'Save failed.' });
      setTimeout(() => setToast({ visible: false, message: '' }), 3000);
    }
  };

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="block w-full h-full bg-[#0d1117]" />
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg text-white text-sm bg-white/10 backdrop-blur-md shadow-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      {showPopup && (
        <div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-[#2e2e2e]/70 backdrop-blur-sm text-white text-lg px-4 py-4 rounded-lg shadow-xl flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 w-11/12 max-w-sm"
          style={{ zIndex: 20 }}
        >
          <span className="leading-snug text-center">
            Welcome to my site! Feel free to move around and eat blocks using the arrow keys. Hold space to boost. Hover
            over elements!
          </span>
          <button
            className="px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-md hover:bg-white/30 transition"
            onClick={() => setShowPopup(false)}
          >
            Dismiss
          </button>
        </div>
      )}
      {isDev && !isEditing && (
        <button
          className="absolute top-4 right-4 px-2 py-1 bg-gray-800 text-white rounded z-50"
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
      )}
      {isDev && isEditing && (
        <div className="absolute top-4 right-4 flex space-x-2 z-50">
          <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={saveMap}>
            Save
          </button>
          <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => window.location.reload()}>
            Cancel
          </button>
        </div>
      )}
      {isDev && isEditing && (
        <div className="absolute top-16 right-0 bottom-0 w-20 bg-[#0d1117]/80 p-2 flex flex-col items-center space-y-2 overflow-auto z-50">
          {Object.entries(PALETTE).map(([key, color]) => (
            <div
              key={key}
              className={`w-10 h-10 rounded cursor-pointer border-2 ${selectedColorKey === key ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColorKey(key)}
            />
          ))}
        </div>
      )}

      {toast.visible && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {toast.message}
        </div>
      )}

      {isEditing && hoverCell && (
        <div className="absolute top-0 left-0 m-2 p-1 bg-black/50 text-white text-sm z-50">
          {hoverCell.x}, {hoverCell.y}
        </div>
      )}
    </div>
  );
}
