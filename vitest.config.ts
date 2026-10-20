import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		restoreMocks: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			// Only measure the code we own and can unit test.
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/app.d.ts']
		}
	}
});
