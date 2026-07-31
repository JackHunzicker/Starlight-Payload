// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import node from '@astrojs/node';

// https://astro.build/config
// Port 7776 per implementation_plan.md
// Base /docs/ for Next.js proxy integration
// SSR mode enabled for live TinaCMS editing without rebuilds
export default defineConfig({
	site: 'http://localhost:7773',
	base: '/docs/',
	server: { port: 7776, host: true },
	// Allow Docker service name 'starlight' as a host (Vite 6+ security)
	// Required for Next.js proxy: web container connects via http://starlight:7776
	vite: { server: { allowedHosts: ['starlight'] } },
	// SSR mode with Node adapter for live content editing
	output: 'server',
	adapter: node({
		mode: 'standalone'
	}),
	integrations: [
		// Content scrubbed 2026-07-29 (dev-era placeholders removed; preserved in
		// git history). /docs/ serves the under-construction page from
		// src/pages/index.astro — a static page beats Starlight's injected
		// [...slug] route. The integration stays installed, content-free, for
		// when real Archive content lands. NOTE: a manually-specified sidebar
		// slug with no matching doc crashes Starlight at boot — leave the
		// sidebar empty until content returns.
		starlight({
			title: 'Acme Commerce',
			sidebar: [],
		}),
	],
});
