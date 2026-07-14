/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
    // pdfjs-dist carrega seu "worker" via um require/import relativo em tempo de execução;
    // se o webpack empacotar a lib em chunks, esse arquivo não existe no bundle da função
    // serverless (erro "Setting up fake worker failed" na Vercel). Mantendo como pacote
    // externo, ela é carregada normal do node_modules, onde o arquivo do worker existe.
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
};

export default nextConfig;
