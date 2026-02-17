import type {NextConfig} from 'next';

const nextConfig = {
  /* config options here */
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.chughtailab.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'www.aku.edu',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'shaukatkhanum.org.pk',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'www.prcs.org.pk',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
