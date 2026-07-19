let currentUser = null;

// পেজ লোড হলে সেশন চেক করে অ্যাপ লোড বা লগইন পেইজে রিডাইরেক্ট করবে
window.onload = () => {
    const saved = localStorage.getItem('blockbuster_user');
    if (!saved) {
        window.location.href = '/login';
    } else {
        currentUser = JSON.parse(saved);
        enterApp();
    }
};

// PWA সার্ভিস ওয়ার্কার রেজিস্টার করা (এটি ডোমেইন ক্যাশ প্রটেক্টেড)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log("PWA Service Worker Registered!"))
        .catch(err => console.error("SW Registration failed: ", err));
}

// PWA ইনস্টল ইভেন্ট ট্র্যাকিং এবং ম্যানুয়াল বাটন শো করা
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // ১. ম্যানুয়াল ডাউনলোড বাটনটি ড্যাশবোর্ডে শো করা
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }

    // ২. নতুন সাইন-আপ সম্পন্ন হয়ে থাকলে অটো-প্রম্পট দেখাবে
    if (sessionStorage.getItem('is_new_signup') === 'true') {
        showPWAInstallPrompt();
    }
});

function showPWAInstallPrompt() {
    if (deferredPrompt) {
        sessionStorage.removeItem('is_new_signup'); // প্রম্পট শো করার পর ফ্ল্যাগ ক্লিন
        
        if (confirm("নিবন্ধন সফল হয়েছে! আপনি কি আপনার মোবাইলের হোম স্ক্রিনে গেমটি অ্যাপ হিসেবে নামাতে (Download/Install) চান?")) {
            triggerPWAInstall();
        }
    }
}

// PWA ইনস্টলেশন রান করার মূল মেথড
async function triggerPWAInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install: ${outcome}`);
        deferredPrompt = null;
        
        // ইনস্টলেশন শুরু হলে বাটনটি হাইড করে দেওয়া
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.classList.add('hidden');
        }
    }
}

// ম্যানুয়াল ডাউনলোড বাটনের ক্লিক লজিক কানেক্ট করা
function setupPWAInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', () => {
            triggerPWAInstall();
        });
    }
}

function enterApp() {
    updateUIBalances();
    switchTab('home');
    setupPWAInstallButton(); // ইনস্টলেশন ইভেন্ট কানেকশন
    startHeartbeatTimer();
}

function updateUIBalances() {
    if (!currentUser) return;
    
    document.getElementById('coin-balance').innerText = currentUser.coin_balance || 0;
    document.getElementById('coin-gem').innerText = currentUser.diamond_balance || 0;
    
    document.getElementById('header-username').innerText = currentUser.nickname;
    document.getElementById('wallet-gem').innerText = currentUser.diamond_balance || 0;
    
    // কয়েন কনভার্সন (৬৭৭,৪০০ কয়েন = $১.০০)
    const coinUSD = ((currentUser.coin_balance || 0) / 677400).toFixed(2);
    document.getElementById('coin-usd').innerText = `=$${coinUSD}`;
    
    document.getElementById('referral-link').value = `${window.location.origin}/signup?ref=${currentUser.id}`;
}

function switchTab(tabName) {
    document.getElementById('home-tab').classList.add('hidden');
    document.getElementById('referrals-tab').classList.add('hidden');
    document.getElementById('gems-tab').classList.add('hidden');

    if (tabName === 'home') {
        document.getElementById('home-tab').classList.remove('hidden');
    } else if (tabName === 'referrals') {
        document.getElementById('referrals-tab').classList.remove('hidden');
        loadReferralData();
    } else if (tabName === 'gems') {
        document.getElementById('gems-tab').classList.remove('hidden');
    }
}

function handleLogout() {
    localStorage.removeItem('blockbuster_user');
    currentUser = null;
    window.location.href = '/login';
}

function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }
function openRulesModal() { document.getElementById('rules-modal').classList.remove('hidden'); }
function closeRulesModal() { document.getElementById('rules-modal').classList.add('hidden'); }

function copyRefLink() {
    const linkInput = document.getElementById('referral-link');
    linkInput.select();
    document.execCommand('copy');
    alert("রেফারেল লিংক কপি করা হয়েছে!");
}

async function loadReferralData() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/referrals?userId=${currentUser.id}`);
        const referrals = await res.json();
        const listContainer = document.getElementById('ref-list-container');
        listContainer.innerHTML = '';

        if (referrals.length === 0) {
            listContainer.innerHTML = `<div class="text-xs text-gray-400 text-center py-4">কোনো রেফারেল রেকর্ড পাওয়া যায়নি</div>`;
            return;
        }

        referrals.forEach(ref => {
            const rUser = ref.referred;
            const itemHtml = `
                <div class="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-2xl">
                    <div class="flex items-center space-x-2">
                        <img class="w-8 h-8 rounded-full" src="${rUser.avatar_url || 'https://i.ibb.co/default-avatar.png'}">
                        <div>
                            <div class="text-xs font-bold">${rUser.nickname}</div>
                            <span class="text-[9px] text-gray-400">LV${rUser.level || 0}</span>
                        </div>
                    </div>
                    <span class="text-[10px] bg-yellow-600/30 text-yellow-300 border border-yellow-600/50 px-2 py-1 rounded-full">${ref.status}</span>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
    } catch (err) {
        console.error("Referral fetch error: ", err);
    }
}

function startHeartbeatTimer() {
    setInterval(async () => {
        if (!currentUser) return;
        try {
            await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });
            console.log("Activity heartbeat logged.");
        } catch (err) {
            console.error("Heartbeat error: ", err);
        }
    }, 5 * 60 * 1000);
}
