const CACHE_NAME = 'blockbuster-pwa-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/login',
    '/signup',
    '/verify',
    '/app.js',
    '/game.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// ইনস্টলেশন এবং ফাইল অফলাইন ক্যাশিং
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => console.log("PWA Caching failed: ", err));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Chrome PWA Audit পাস করার জন্য প্রতিটি রিকোয়েস্টে respondWith ব্যবহার নিশ্চিত করা হয়েছে
self.addEventListener('fetch', (event) => {
    // API বা POST রিকোয়েস্ট সরাসরি নেটওয়ার্ক দিয়ে পাস করানো
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (event.request.headers.get('accept').includes('text/html')) {
                        return caches.match('/');
                    }
                });
            })
    );
});
