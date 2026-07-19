const CACHE_NAME = 'blockbuster-pwa-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/login',
    '/signup',
    '/verify',
    '/app.js',
    '/game.js',
    '/manifest.json'
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

// Network-First Strategy: সবসময় সার্ভার থেকে নতুন কোড আনবে, সার্ভার ডাউন থাকলে বা অফলাইনে ক্যাশ থেকে লোড করবে
self.addEventListener('fetch', (event) => {
    // API এবং POST রিকোয়েস্ট ইন্টারসেপ্ট করা সম্পূর্ণ বন্ধ রাখা হয়েছে (সিকিউরিটির জন্য)
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
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
