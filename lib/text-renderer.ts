import type { MutableRefObject } from 'react';
import { PALETTE } from '@/lib/colors';
import { COLS, ROWS, CELL, STEP, MINIMAP_SCALE, RADIUS } from '@/lib/constants';
import { roundRect } from '@/lib/canvas-utils';

export const drawTextOnGrid = (
  gctx: CanvasRenderingContext2D,
  mctx: CanvasRenderingContext2D,
  gridRef: MutableRefObject<string[][]>,
  text: string,
  startGridX: number,
  startGridY: number,
  cellColorKey: string,
  textColor: string,
  fontSize?: number
) => {
  const CHAR_WIDTH = 3;
  const CHAR_HEIGHT = 3;
  const FONT_SIZE = fontSize ?? Math.max(24, Math.floor(CELL * 3.0));
  const FONT_FAMILY = '"Press Start 2P", monospace';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const currentGridX = startGridX + i * CHAR_WIDTH;
    const currentGridY = startGridY;

    if (currentGridX < 0 || currentGridX >= COLS || currentGridY < 0 || currentGridY >= ROWS) {
      continue;
    }

    for (let dy = 0; dy < CHAR_HEIGHT; dy++) {
      for (let dx = 0; dx < CHAR_WIDTH; dx++) {
        const cellX = currentGridX + dx;
        const cellY = currentGridY + dy;

        if (cellX < 0 || cellX >= COLS || cellY < 0 || cellY >= ROWS) {
          continue;
        }

        const cellBgColor = PALETTE[cellColorKey] || PALETTE['0'];
        gridRef.current[cellX][cellY] = cellColorKey;

        const cellPx = cellX * STEP;
        const cellPy = cellY * STEP;
        roundRect(gctx, cellPx, cellPy, CELL, CELL, RADIUS, cellBgColor);

        if (mctx) {
          const minimapCellX = cellX * MINIMAP_SCALE;
          const minimapCellY = cellY * MINIMAP_SCALE;
          const minimapCellSize = MINIMAP_SCALE * 2;
          mctx.fillStyle = cellBgColor;
          mctx.fillRect(minimapCellX, minimapCellY, minimapCellSize, minimapCellSize);
        }
      }
    }

    if (char !== ' ') {
      const tempCanvas = document.createElement('canvas');
      const charWidth = CHAR_WIDTH * CELL;
      const charHeight = CHAR_HEIGHT * CELL;
      tempCanvas.width = charWidth;
      tempCanvas.height = charHeight;
      const tempCtx = tempCanvas.getContext('2d')!;

      tempCtx.fillStyle = textColor;
      tempCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';

      tempCtx.imageSmoothingEnabled = false;

      tempCtx.fillText(char, charWidth / 2, charHeight / 2);

      for (let dy = 0; dy < CHAR_HEIGHT; dy++) {
        for (let dx = 0; dx < CHAR_WIDTH; dx++) {
          const cellX = currentGridX + dx;
          const cellY = currentGridY + dy;

          if (cellX < 0 || cellX >= COLS || cellY < 0 || cellY >= ROWS) {
            continue;
          }

          const cellPx = cellX * STEP;
          const cellPy = cellY * STEP;

          gctx.save();
          gctx.beginPath();
          roundRect(gctx, cellPx, cellPy, CELL, CELL, RADIUS, 'rgba(0,0,0,0)');
          gctx.clip();

          gctx.drawImage(tempCanvas, dx * CELL, dy * CELL, CELL, CELL, cellPx, cellPy, CELL, CELL);

          gctx.restore();
        }
      }
    }
  }
};
