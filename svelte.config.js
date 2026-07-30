import adapter from '@sveltejs/adapter-static';

// This detects if you are running in development mode (npm run dev)
const dev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,    // set to '200.html' for SPA mode
			precompress: false,
			strict: true
		}),
		// THIS is the critical addition for your subpath deployment
		paths: {
			base: dev ? '' : '/voleybal' // Replace 'voleybal' if your repo name is different
		}
	}
};

export default config;