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
import { mosaics, MosaicConfig } from '@/lib/mosaics';
import { roundRect } from '@/lib/canvas-utils';
import { drawTextOnGrid } from '@/lib/text-renderer';

type Pos = { x: number; y: number };

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const isDev = process.env.NODE_ENV === 'development';

interface CanvasText {
  text: string;
  x: number;
  y: number;
  color: string;
  cellColorKey: string;
  fontSize: number;
}

export default function CanvasContribMap({ grid: initialGrid }: { grid: string[][] }) {
  const [showPopup, setShowPopup] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const gridRef = useRef<string[][]>(Array.from({ length: COLS }, (_, x) => initialGrid.map(row => row[x])));
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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

  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text?: string;
    experienceDetails?: {
      title: string;
      company: string;
      period: string;
      description?: string;
    };
  }>({ visible: false, x: 0, y: 0, text: '' });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedColorKey, setSelectedColorKey] = useState<string>('1');
  const [isPainting, setIsPainting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const [gridCanvasReady, setGridCanvasReady] = useState(false);
  const [minimapCanvasReady, setMinimapCanvasReady] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [texts, setTexts] = useState<CanvasText[]>([]);

  const CTX_IMAGE_BLOCKS = IMAGE_BLOCKS;
  const CTX_IMAGE_SPACING = 3;
  const CTX_MOSAIC_SPACING = CTX_IMAGE_BLOCKS + CTX_IMAGE_SPACING;

  const imageOffsetX = Math.floor((COLS - CTX_IMAGE_BLOCKS) / 2);
  const imageOffsetY = Math.floor((ROWS - CTX_IMAGE_BLOCKS) / 2);
  const mosaicYOffset = Math.floor(snakeYOffset / 2);

  const socialIconsOffsetXs = [imageOffsetX - CTX_MOSAIC_SPACING, imageOffsetX, imageOffsetX + CTX_MOSAIC_SPACING];
  const socialIconsBaseY = imageOffsetY + mosaicYOffset;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = 'https://fonts.gstatic.com';
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);

      const pixelFontLink = document.createElement('link');
      pixelFontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      pixelFontLink.rel = 'stylesheet';
      document.head.appendChild(pixelFontLink);

      const checkFontLoaded = () => {
        const testEl = document.createElement('span');
        testEl.style.fontFamily = '"Press Start 2P", monospace';
        testEl.style.fontSize = '0px';
        testEl.style.visibility = 'hidden';
        testEl.textContent = 'Test Font';
        document.body.appendChild(testEl);

        setTimeout(() => {
          setFontLoaded(true);
          document.body.removeChild(testEl);
        }, 500);
      };

      document.fonts.ready.then(checkFontLoaded);
    }
  }, []);

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

    const mosaicsWithOffsetsCalculated: MosaicConfig[] = mosaics.map((m, idx) => {
      if (idx < 3) {
        return {
          ...m,
          offsetX: socialIconsOffsetXs[idx],
          offsetY: socialIconsBaseY,
        };
      }
      return m;
    });

    mosaicsWithOffsetsCalculated.forEach(mosaic => {
      const img = new Image();
      img.onload = () => {
        const cellCountForHeight = mosaic.blocks;

        if (cellCountForHeight === 0) return;

        const imageAspectRatio = img.width / img.height;
        const idealCellCountForWidth = imageAspectRatio * cellCountForHeight;
        const actualCellCountForWidth = Math.round(idealCellCountForWidth);

        if (actualCellCountForWidth === 0) return;

        const mosaicIdx = mosaics.findIndex(
          m => m.src === mosaic.src && m.offsetX === mosaic.offsetX && m.offsetY === mosaic.offsetY
        );
        if (mosaicIdx >= 0) {
          mosaics[mosaicIdx] = {
            ...mosaics[mosaicIdx],
            width: actualCellCountForWidth,
          };
        }

        const sourcePixelWidthPerIdealCell = img.width / idealCellCountForWidth;
        const sourcePixelHeightPerCell = img.height / cellCountForHeight;

        let imageData: ImageData | null = null;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const isFordOrHuawei = mosaic.src.includes('ford.png') || mosaic.src.includes('huawei.png');

        if (isFordOrHuawei && tempCtx) {
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          tempCtx.drawImage(img, 0, 0);
          imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        }

        for (let iy = 0; iy < cellCountForHeight; iy++) {
          for (let ix = 0; ix < actualCellCountForWidth; ix++) {
            const sx = ix * sourcePixelWidthPerIdealCell;
            const sy = iy * sourcePixelHeightPerCell;

            const destCanvasX = (mosaic.offsetX + ix) * STEP;
            const destCanvasY = (mosaic.offsetY + iy) * STEP;

            if (mosaic.offsetX + ix >= COLS || mosaic.offsetY + iy >= ROWS) {
              continue;
            }

            let skipTMarking = false;
            if (isFordOrHuawei && imageData) {
              const centerX = Math.floor(sx + sourcePixelWidthPerIdealCell / 2);
              const centerY = Math.floor(sy + sourcePixelHeightPerCell / 2);
              if (centerX < img.width && centerY < img.height) {
                const pixelIndex = (centerY * img.width + centerX) * 4;
                const alpha = imageData.data[pixelIndex + 3];
                if (alpha < 50) {
                  skipTMarking = true;
                }
              }
            }

            gctx.save();
            gctx.beginPath();
            roundRect(gctx, destCanvasX, destCanvasY, CELL, CELL, RADIUS, 'rgba(0,0,0,0)');
            gctx.clip();
            gctx.drawImage(
              img,
              sx,
              sy,
              sourcePixelWidthPerIdealCell,
              sourcePixelHeightPerCell,
              destCanvasX,
              destCanvasY,
              CELL,
              CELL
            );
            gctx.restore();

            const gridX = mosaic.offsetX + ix;
            const gridY = mosaic.offsetY + iy;
            if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
              if (!skipTMarking) {
                gridRef.current[gridX][gridY] = 't';
              }
            }
          }
        }
      };
      img.src = mosaic.src;
    });

    setShowPopup(true);
    setGridCanvasReady(true);
  }, [initialGrid]);

  useIconOverlay({
    canvasRef,
    targetRef: target,
    icons: [
      ...(['linkedin', 'github', 'email'] as const).map((key, idx) => {
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
          offsetX: socialIconsOffsetXs[idx],
          offsetY: socialIconsBaseY,
          size: CTX_IMAGE_BLOCKS,
          onClick: () => window.open(hrefMap[key], '_blank'),
          tooltipText: tooltipMap[key],
        };
      }),
      ...mosaics
        .filter((_, idx) => idx >= 3)
        .map(mosaic => ({
          offsetX: mosaic.offsetX,
          offsetY: mosaic.offsetY,
          size: mosaic.blocks,
          width: mosaic.width,
          tooltipText: mosaic.tooltipText || '',
          experienceDetails: mosaic.experienceDetails,
        })),
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
    setMinimapCanvasReady(true);
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
      if (showPopup || isEditing || isPaused) return;
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
          roundRect(gctx, px, py, CELL, CELL, RADIUS, PALETTE[gridRef.current[nx][ny]]);
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

      if (e.key === 'p' || e.key === 'P') {
        setIsPaused(prev => !prev);
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
  }, [showPopup, isEditing, isPaused]);

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

  useEffect(() => {
    fetch('/texts.json')
      .then(res => res.json())
      .then(setTexts)
      .catch(() => setTexts([]));
  }, []);

  useEffect(() => {
    if (
      gridCanvasReady &&
      minimapCanvasReady &&
      fontLoaded &&
      gridCanvasRef.current &&
      minimapCanvasRef.current &&
      initialGrid
    ) {
      const gctx = gridCanvasRef.current.getContext('2d')!;
      const mctx = minimapCanvasRef.current.getContext('2d')!;

      texts.forEach(t => {
        drawTextOnGrid(gctx, mctx, gridRef, t.text, t.x, t.y, t.cellColorKey, t.color, t.fontSize);
      });
    }
  }, [initialGrid, gridCanvasReady, minimapCanvasReady, fontLoaded, texts]);

  const saveMap = async () => {
    const rows = Array.from({ length: ROWS }, (_, y) => {
      let rowString = '';
      for (let x = 0; x < COLS; x++) {
        rowString += gridRef.current[x][y];
      }
      return rowString;
    });

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
    <div className="relative h-screen w-full overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full bg-[#0d1117]" style={{ touchAction: 'none' }} />
      {tooltip.visible && (
        <div
          className={`absolute pointer-events-none rounded-lg text-white shadow-lg ${tooltip.experienceDetails ? 'bg-black/80 p-4 max-w-md' : 'bg-white/10 backdrop-blur-md px-3 py-2 text-base'}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.experienceDetails ? (
            <div className="flex flex-col gap-2">
              <div className="font-bold text-xl">{tooltip.experienceDetails.title}</div>
              <div className="text-lg">{tooltip.experienceDetails.company}</div>
              <div className="text-base text-gray-300">{tooltip.experienceDetails.period}</div>
              {tooltip.experienceDetails.description && (
                <div className="text-base text-gray-200 mt-1">{tooltip.experienceDetails.description}</div>
              )}
            </div>
          ) : (
            tooltip.text
          )}
        </div>
      )}
      {isPaused && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-8 py-4 rounded-lg text-3xl font-bold font-sans">
          PAUSED
        </div>
      )}
      {showPopup && (
        <div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-[#2e2e2e]/70 backdrop-blur-sm text-white text-3xl px-12 py-10 rounded-lg shadow-xl flex flex-col items-center space-y-8 sm:flex-row sm:space-y-0 sm:space-x-10 w-11/12 max-w-2xl md:max-w-3xl"
          style={{ zIndex: 20 }}
        >
          <span className="leading-snug text-center font-sans">
            Welcome to my site! Feel free to move around and eat blocks using the arrow keys.
            <strong className="font-semibold"> Hold space to boost.</strong> Press P to pause. Hover over elements!
          </span>
          <button
            className={`px-6 py-3 text-xl font-sans bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white rounded-md transition whitespace-nowrap flex items-center gap-2`}
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
