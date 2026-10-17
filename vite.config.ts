import {apiPort,webPort} from './server/ports';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({cacheDir:process.env.GO100_VITE_CACHE_DIR??'node_modules/.vite',plugins:[react()],server:{host:'127.0.0.1',port:webPort,strictPort:true,proxy:{'/api':`http://127.0.0.1:${apiPort}`}},build:{chunkSizeWarningLimit:850}});