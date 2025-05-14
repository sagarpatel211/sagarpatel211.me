import { useEffect } from 'react';
import { STEP } from '@/lib/constants';

type Pos = { x: number; y: number };

type IconConfig = {
  offsetX: number;
  offsetY: number;
  size: number;
  width?: number;
  onClick?: () => void;
  tooltipText: string;
  experienceDetails?: {
    title: string;
    company: string;
    period: string;
    description?: string;
  };
};

export function useIconOverlay(params: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  targetRef: React.MutableRefObject<Pos>;
  icons: IconConfig[];
  setTooltip: (tip: {
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
  }) => void;
}) {
  const { canvasRef, targetRef, icons, setTooltip } = params;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || icons.length === 0) return;

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cellX = Math.floor(mx / STEP);
      const cellY = Math.floor(my / STEP);
      const worldX = targetRef.current.x + cellX;
      const worldY = targetRef.current.y + cellY;

      for (const icon of icons) {
        const iconWidth = icon.width ?? icon.size;
        if (
          worldX >= icon.offsetX &&
          worldX < icon.offsetX + iconWidth &&
          worldY >= icon.offsetY &&
          worldY < icon.offsetY + icon.size
        ) {
          if (icon.onClick) {
            icon.onClick();
          }
          break;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cellX = Math.floor(mx / STEP);
      const cellY = Math.floor(my / STEP);
      const worldX = targetRef.current.x + cellX;
      const worldY = targetRef.current.y + cellY;

      let hovered: IconConfig | undefined;
      for (const icon of icons) {
        const iconWidth = icon.width ?? icon.size;
        if (
          worldX >= icon.offsetX &&
          worldX < icon.offsetX + iconWidth &&
          worldY >= icon.offsetY &&
          worldY < icon.offsetY + icon.size
        ) {
          hovered = icon;
          break;
        }
      }

      if (hovered) {
        setTooltip({
          visible: true,
          x: e.clientX + 10,
          y: e.clientY + 10,
          text: hovered.tooltipText,
          experienceDetails: hovered.experienceDetails,
        });
        canvas.style.cursor = hovered.onClick ? 'pointer' : 'default';
      } else {
        setTooltip({ visible: false, x: 0, y: 0 });
        canvas.style.cursor = 'default';
      }
    };

    const handleMouseLeave = () => {
      setTooltip({ visible: false, x: 0, y: 0 });
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [canvasRef, icons, targetRef, setTooltip]);
}
