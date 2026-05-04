import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: '/survey_all/',
  plugins: [react()],
  server: {
    port: 5173,
  },
});
