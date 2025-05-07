import { IconConfig } from '@/lib/icon-overlay';

interface ExtraMosaic {
  src: string;
  offsetX: number;
  offsetY: number;
  blocks: number;
  tooltipText: string;
}

export const extraMosaics: ExtraMosaic[] = [
  {
    src: '/ford.png',
    offsetX: 214,
    offsetY: 277,
    blocks: 15,
    tooltipText: 'Ford Motor Company',
  },
  {
    src: '/gdls.png',
    offsetX: 214,
    offsetY: 310,
    blocks: 12,
    tooltipText: 'General Dynamics Land Systems',
  },
  {
    src: '/huawei.png',
    offsetX: 180,
    offsetY: 294,
    blocks: 12,
    tooltipText: 'Huawei Technologies',
  },
  {
    src: '/windriver.jpg',
    offsetX: 183,
    offsetY: 327,
    blocks: 12,
    tooltipText: 'Wind River',
  },
  {
    src: '/211z.jpeg',
    offsetX: 214,
    offsetY: 342,
    blocks: 12,
    tooltipText: 'SWC Robotics CO-OP',
  },
];

export function getExtraOverlayIcons(): IconConfig[] {
  return extraMosaics.map(({ src, offsetX, offsetY, blocks, tooltipText }) => ({
    offsetX,
    offsetY,
    size: blocks,
    onClick: () => window.open(src, '_blank'),
    tooltipText,
  }));
}
