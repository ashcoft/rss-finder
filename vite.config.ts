import adapterAuto from '@sveltejs/adapter-auto';
import adapterNode from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Determine which adapter to use based on deployment type environment variable
const deploymentType = process.env.DEPLOYMENT_TYPE || 'auto';
const adapter = deploymentType === 'node' ? adapterNode : adapterAuto;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter()
		})
	]
});
