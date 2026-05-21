/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `pandemic-${version}`;

const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);

	// Same-origin only. Skip cross-origin (Supabase, fonts CDNs, etc).
	if (url.origin !== location.origin) return;

	// Never cache live API mutations, Supabase realtime, or auth callbacks.
	if (
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/auth/') ||
		url.search.length > 0
	) {
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Build artifacts and static files: cache-first (immutable, content-hashed).
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// HTML / data routes: network-first, fall back to cache so the shell still loads offline.
			try {
				const fresh = await fetch(req);
				if (fresh && fresh.ok && fresh.type === 'basic') {
					cache.put(req, fresh.clone());
				}
				return fresh;
			} catch {
				const cached = await cache.match(req);
				if (cached) return cached;
				const shell = await cache.match('/');
				if (shell) return shell;
				return new Response('Offline', { status: 503, statusText: 'Offline' });
			}
		})()
	);
});

export {};
