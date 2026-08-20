import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS || false;
let repo = '';
if (isGithubActions) {
  const repository = process.env.GITHUB_REPOSITORY || '';
  repo = repository.split('/')[1] || '';
}

const basePath = repo ? `/${repo}` : '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
