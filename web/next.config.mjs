/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.marktplaats.com" },
    ],
  },
};

export default nextConfig;
