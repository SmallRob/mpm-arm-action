import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    host: '0.0.0.0', // Allow external access
    port: 5173,
    proxy: {
      '/api/sso': {
        target: 'http://localhost:8881',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8880',
        changeOrigin: true,
        // 支持代理到 HTTP 目标（不验证 SSL）
        secure: false,
      },
      '/_ai': {
        target: 'http://localhost:8880',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
