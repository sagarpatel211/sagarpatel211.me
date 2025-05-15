export interface MosaicConfig {
  src: string;
  offsetX: number;
  offsetY: number;
  blocks: number;
  width?: number;
  tooltipText?: string;
  href?: string;
  experienceDetails?: {
    title: string;
    company: string;
    period: string;
    description?: string;
  };
  projectDetails?: {
    title: string;
    tech: string[];
    description: string;
    stars?: number;
    forks?: number;
    url: string;
  };
}

export const mosaics: MosaicConfig[] = [
  {
    src: '/images/linkedin.png',
    offsetX: 0,
    offsetY: 0,
    blocks: 8,
    tooltipText: 'Visit my LinkedIn!',
    href: 'https://www.linkedin.com/in/sagarpatel211',
  },
  {
    src: '/images/github.png',
    offsetX: 0,
    offsetY: 0,
    blocks: 8,
    tooltipText: 'Visit my GitHub!',
    href: 'https://github.com/sagarpatel211',
  },
  {
    src: '/images/email.png',
    offsetX: 0,
    offsetY: 0,
    blocks: 8,
    tooltipText: 'Email me: 2sagarpatel2@gmail.com',
    href: 'mailto:2sagarpatel2@gmail.com',
  },
  {
    src: '/images/ford.png',
    offsetX: 214,
    offsetY: 277,
    blocks: 15,
    tooltipText: 'Ford Motor Company',
    experienceDetails: {
      title: 'Software Engineer Intern',
      company: 'Ford Motor Company',
      period: 'January 2025 - April 2025',
      description: 'Developed infotainment systems in Kotlin, Java, and C++',
    },
  },
  {
    src: '/images/gdls.png',
    offsetX: 214,
    offsetY: 310,
    blocks: 12,
    tooltipText: 'General Dynamics Land Systems',
    experienceDetails: {
      title: 'Software Engineer Intern',
      company: 'General Dynamics Land Systems',
      period: 'September 2023 - December 2023',
      description: 'Worked on light-armoured vehicle systems',
    },
  },
  {
    src: '/images/huawei.png',
    offsetX: 180,
    offsetY: 294,
    blocks: 12,
    tooltipText: 'Huawei Technologies',
    experienceDetails: {
      title: 'Machine Learning Engineer Intern',
      company: 'Huawei Technologies',
      period: 'April 2024 - August 2024',
      description: 'Configured OpenHarmony software for Raspberry Pi',
    },
  },
  {
    src: '/images/windriver.jpg',
    offsetX: 183,
    offsetY: 327,
    blocks: 12,
    tooltipText: 'Wind River',
    experienceDetails: {
      title: 'Software Developer Intern',
      company: 'Wind River',
      period: 'September 2022 - December 2022',
      description: 'Worked with MLOps Tools and containerized applications',
    },
  },
  {
    src: '/images/211z.jpeg',
    offsetX: 214,
    offsetY: 342,
    blocks: 12,
    tooltipText: 'SWC Robotics CO-OP',
    experienceDetails: {
      title: 'Robotics Engineer',
      company: 'SWC Robotics',
      period: 'Sept 2019 - June 2020',
      description: 'Built VEX Competition robots and systems!',
    },
  },
  {
    src: '/images/python.png',
    offsetX: 232,
    offsetY: 200,
    blocks: 8,
    tooltipText: 'Python',
  },
  {
    src: '/images/c.png',
    offsetX: 242,
    offsetY: 200,
    blocks: 8,
    tooltipText: 'C',
  },
  {
    src: '/images/c++.png',
    offsetX: 252,
    offsetY: 200,
    blocks: 8,
    tooltipText: 'C++',
  },
  {
    src: '/images/kotlin.png',
    offsetX: 262,
    offsetY: 200,
    blocks: 8,
    tooltipText: 'Kotlin',
  },
  {
    src: '/images/java.png',
    offsetX: 247,
    offsetY: 190,
    blocks: 8,
    tooltipText: 'Java',
  },
  // GitHub Project Cards
  {
    src: '/images/1.png',
    offsetX: 140,
    offsetY: 130,
    blocks: 18,
    tooltipText: 'Portfolio Website',
    projectDetails: {
      title: 'Portfolio Website',
      tech: ['Next.js', 'TypeScript', 'Tailwind CSS'],
      description:
        'Interactive portfolio website with a unique canvas-based UI featuring a snake game that interacts with displayed content.',
      stars: 12,
      forks: 3,
      url: 'https://github.com/sagarpatel211/sagarpatel211.me',
    },
    href: 'https://github.com/sagarpatel211/sagarpatel211.me',
  },
  {
    src: '/images/2.png',
    offsetX: 140,
    offsetY: 160,
    blocks: 18,
    tooltipText: 'Project #1',
    projectDetails: {
      title: 'AI Chatbot',
      tech: ['Python', 'TensorFlow', 'Flask'],
      description: 'A conversational AI assistant that uses state-of-the-art NLP models to provide helpful responses.',
      stars: 45,
      forks: 12,
      url: 'https://github.com/sagarpatel211/ai-chatbot',
    },
    href: 'https://github.com/sagarpatel211/ai-chatbot',
  },
  {
    src: '/images/3.png',
    offsetX: 170,
    offsetY: 130,
    blocks: 18,
    tooltipText: 'Project #2',
    projectDetails: {
      title: 'Autonomous Robot',
      tech: ['C++', 'ROS', 'OpenCV'],
      description: 'An autonomous robot platform that can navigate complex environments using computer vision.',
      stars: 28,
      forks: 7,
      url: 'https://github.com/sagarpatel211/autonomous-robot',
    },
    href: 'https://github.com/sagarpatel211/autonomous-robot',
  },
];
