'use client';

import React, { useEffect, useRef, useMemo } from 'react';

const SCALE = 1.7;
const COLS = 500;
const ROWS = 500;
const BASE_CELL = 12;
const BASE_GAP = 4;
const CELL = BASE_CELL * SCALE;
const GAP = BASE_GAP * SCALE;
const RADIUS = 3;
const STEP = CELL + GAP;
const TICK = 100;
const BOOST_MULT = 3;
const MAX_LEN = 5;
const SHRINK = 0.05;
const MARGIN = 10;
const LERP = 0.18;
const PALETTE = ['#161b22', '#0e4429'] as const;
const SNAKE_COL = '#c084fc';

const MINIMAP_SIZE = 160;
const MINIMAP_PADDING = 12;
const MINIMAP_SCALE = MINIMAP_SIZE / COLS;

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export default function CanvasContribMap({
  grid: initialGrid,
}: {
  grid: number[][];
}) {
  const grid = useMemo(
    () => initialGrid.map(row => Uint8Array.from(row)),
    [initialGrid]
  );

  type Pos = { x: number; y: number };
  const snakeRef = useRef<Pos[]>([
    { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
  ]);

  const dirRef = useRef<[number, number]>([1, 0]);
  const queueRef = useRef<[number, number][]>([]);
  const boostRef = useRef(false);
  const target = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dpr]);

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

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = MINIMAP_SIZE;
    offscreen.height = MINIMAP_SIZE;
    const ctx = offscreen.getContext('2d')!;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    for (let x = 0; x < COLS; x += 4) {
      for (let y = 0; y < ROWS; y += 4) {
        const color = PALETTE[grid[x][y]];
        const px = x * MINIMAP_SCALE;
        const py = y * MINIMAP_SCALE;
        const size = MINIMAP_SCALE * 2;
        roundRect(ctx, px, py, size, size, 1.2, color);
      }
    }

    minimapCanvasRef.current = offscreen;
  }, [grid]);

  useEffect(() => {
    const tick = () => {
      const reps = boostRef.current ? BOOST_MULT : 1;
      for (let n = 0; n < reps; n++) {
        if (queueRef.current.length) dirRef.current = queueRef.current.shift()!;
        const [dx, dy] = dirRef.current;
        const head = snakeRef.current[0];
        const nh = {
          x: (head.x + dx + COLS) % COLS,
          y: (head.y + dy + ROWS) % ROWS,
        };
        snakeRef.current = [nh, ...snakeRef.current.slice(0, MAX_LEN - 1)];

        const vw = Math.floor(window.innerWidth / STEP);
        const vh = Math.floor(window.innerHeight / STEP);
        let tx = target.current.x;
        let ty = target.current.y;
        if (nh.x - tx < MARGIN) tx = clamp(nh.x - MARGIN, 0, COLS - vw);
        if (nh.x - tx > vw - MARGIN - 1)
          tx = clamp(nh.x - (vw - MARGIN - 1), 0, COLS - vw);
        if (nh.y - ty < MARGIN) ty = clamp(nh.y - MARGIN, 0, ROWS - vh);
        if (nh.y - ty > vh - MARGIN - 1)
          ty = clamp(nh.y - (vh - MARGIN - 1), 0, ROWS - vh);
        target.current = { x: tx, y: ty };
      }
    };
    const id = setInterval(tick, TICK);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') boostRef.current = true;
      else {
        const dir = DIRS[e.key];
        if (!dir) return;
        const last = queueRef.current.length
          ? queueRef.current[queueRef.current.length - 1]
          : dirRef.current;
        if (dir[0] === -last[0] && dir[1] === -last[1]) return;
        if (queueRef.current.length < 3) queueRef.current.push(dir);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') boostRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const draw = () => {
      smooth.current.x = lerp(smooth.current.x, target.current.x, LERP);
      smooth.current.y = lerp(smooth.current.y, target.current.y, LERP);
      const ox = smooth.current.x;
      const oy = smooth.current.y;
      const vw = Math.ceil(window.innerWidth / STEP) + 1;
      const vh = Math.ceil(window.innerHeight / STEP) + 1;
      const sx = Math.floor(ox);
      const sy = Math.floor(oy);

      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      for (let x = 0; x < vw; x++) {
        for (let y = 0; y < vh; y++) {
          const gx = sx + x;
          const gy = sy + y;
          if (gx >= COLS || gy >= ROWS) continue;
          const color = PALETTE[grid[gx][gy]];
          const px = x * STEP - (ox % 1) * STEP;
          const py = y * STEP - (oy % 1) * STEP;
          roundRect(ctx, px, py, CELL, CELL, RADIUS, color);
        }
      }

      snakeRef.current.forEach((seg, i) => {
        const size = CELL * (1 - i * SHRINK);
        const o = (CELL - size) / 2;
        const px = (seg.x - ox) * STEP + o;
        const py = (seg.y - oy) * STEP + o;
        roundRect(ctx, px, py, size, size, RADIUS, SNAKE_COL);
      });

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
  }, [dpr, grid]);

  return (
    <canvas ref={canvasRef} className="block w-full h-full bg-[#0d1117]" />
  );
}
