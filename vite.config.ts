import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', '');
	return {
		plugins: [
			react(),
			tailwindcss(),
		],
		define: {
			'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "openscreen-clone/src"),
			},
		},
		server: {
			host: "0.0.0.0",
			port: 3000,
			hmr: process.env.DISABLE_HMR !== 'true',
		},
		build: {
			target: "esnext",
		},
	};
});
