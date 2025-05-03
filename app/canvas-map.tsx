'use client';

import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
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

type Pos = { x: number; y: number };

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

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

export default function CanvasContribMap({
  grid: initialGrid,
  imageSrc,
}: {
  grid: string[][];
  imageSrc?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const [mobileScale, setMobileScale] = useState(1);
  useEffect(() => {
    const updateScale = () => setMobileScale(window.innerWidth < 640 ? 0.6 : 1);
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
  const gridRef = useRef<string[][]>(
    Array.from({ length: COLS }, (_, x) => initialGrid.map(row => row[x]))
  );

  const dirRef = useRef<[number, number]>([1, 0]);
  const queueRef = useRef<[number, number][]>([]);
  const boostRef = useRef(false);
  const shakeIntensity = useRef(0);
  const snakeYOffset = 20;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const initialHead: Pos = {
    x: Math.floor(COLS / 2),
    y: Math.floor(ROWS / 2) + snakeYOffset,
  };
  const snakeRef = useRef<Pos[]>([initialHead]);
  const lengthRef = useRef(MAX_LEN);
  const target = useRef<Pos>({ ...initialHead });
  const smooth = useRef<Pos>({ ...initialHead });

  const imageOffsetX = Math.floor((COLS - IMAGE_BLOCKS) / 2);
  const imageOffsetY = Math.floor((ROWS - IMAGE_BLOCKS) / 2);
  const mosaicYOffset = Math.floor(snakeYOffset / 2);

  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text?: string;
  }>({ visible: false, x: 0, y: 0, text: '' });
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [gridReady, setGridReady] = useState(false);
  const paintedRef = useRef(false);

  useLayoutEffect(() => {
    const off = document.createElement('canvas');
    off.width = COLS * STEP;
    off.height = ROWS * STEP;
    gridCanvasRef.current = off;
    const gctx = off.getContext('2d')!;

    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        roundRect(
          gctx,
          x * STEP,
          y * STEP,
          CELL,
          CELL,
          RADIUS,
          PALETTE[gridRef.current[x][y]]
        );
      }
    }

    const blocks = IMAGE_BLOCKS;
    const spacing = 3;
    const mosaicSpacing = blocks + spacing;
    const offsetXs = [
      imageOffsetX - mosaicSpacing,
      imageOffsetX,
      imageOffsetX + mosaicSpacing,
    ];
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
            gctx.quadraticCurveTo(
              dx + CELL,
              dy + CELL,
              dx + CELL - RADIUS,
              dy + CELL
            );
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
        for (let ix = 0; ix < blocks; ix++) {
          for (let iy = 0; iy < blocks; iy++) {
            gridRef.current[offsetX + ix][imageOffsetY + mosaicYOffset + iy] =
              '1';
          }
        }
      };
      img.src = sources[idx];
    });
  }, [initialGrid, imageSrc, imageOffsetX, imageOffsetY, mosaicYOffset]);

  useIconOverlay({
    canvasRef,
    targetRef: target,
    icons: (['linkedin', 'github', 'email'] as const).map((key, idx) => {
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
        offsetX: [
          imageOffsetX - mosaicSpacing,
          imageOffsetX,
          imageOffsetX + mosaicSpacing,
        ][idx],
        offsetY: imageOffsetY + mosaicYOffset,
        size: blocks,
        onClick: () => window.open(hrefMap[key], '_blank'),
        tooltipText: tooltipMap[key],
      };
    }),
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
    if (welcomeVisible) return;
    const tick = () => {
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

        if (
          gridRef.current[nx][ny] !== '0' &&
          gridRef.current[nx][ny] !== '-'
        ) {
          lengthRef.current++;
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
            gctx.quadraticCurveTo(
              px + CELL,
              py + CELL,
              px + CELL - RADIUS,
              py + CELL
            );
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
        if (nx - tx > vw - MARGIN - 1)
          tx = clamp(nx - (vw - MARGIN - 1), 0, COLS - vw);
        if (ny - ty < MARGIN) ty = clamp(ny - MARGIN, 0, ROWS - vh);
        if (ny - ty > vh - MARGIN - 1)
          ty = clamp(ny - (vh - MARGIN - 1), 0, ROWS - vh);
        target.current = { x: tx, y: ty };
      }
    };

    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        boostRef.current = true;
      } else {
        const dir = DIRS[e.key];
        if (!dir) return;
        const last =
          queueRef.current[queueRef.current.length - 1] || dirRef.current;
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
  }, [welcomeVisible, imageOffsetX, imageOffsetY]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      if (!paintedRef.current) {
        paintedRef.current = true;
        setGridReady(true);
      }
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

      const mx = window.innerWidth - MINIMAP_SIZE - MINIMAP_PADDING;
      const my = window.innerHeight - MINIMAP_SIZE - MINIMAP_PADDING;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(mx - 1, my - 1, MINIMAP_SIZE + 2, MINIMAP_SIZE + 2);
      if (minimapCanvasRef.current) {
        ctx.drawImage(minimapCanvasRef.current, mx, my);
      }

      const head = segs[0];
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
  }, [dpr]);

  return (
    <div
      className="relative"
      style={{
        width: `${100 / mobileScale}%`,
        height: `${100 / mobileScale}%`,
        overflow: 'hidden',
      }}
    >
      {gridReady && welcomeVisible && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center pointer-events-auto">
          <div className="bg-white/20 backdrop-blur-lg p-6 rounded-lg shadow-lg text-center max-w-xs">
            <p className="text-white text-base">
              Welcome to my site! Feel free to slither around using the arrow
              keys. Hold space to boost. Hover over elements and eat them!
            </p>
            <button
              onClick={() => setWelcomeVisible(false)}
              className="mt-4 px-4 py-2 bg-white/30 text-white rounded-lg hover:bg-white/40 mx-auto"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="block w-full h-full bg-[#0d1117]" />
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg text-white text-sm bg-white/10 backdrop-blur-md shadow-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
