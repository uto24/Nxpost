self.addEventListener('install', (event) => {
    // আগের কোনো ক্যাশ কনফ্লিক্ট এড়াতে ক্যাশ বাইপাস রাখা হয়েছে
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // সরাসরি নেটওয়ার্ক থেকে ফাইল লোড করবে
    event.respondWith(fetch(event.request));
});
