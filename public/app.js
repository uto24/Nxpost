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

// অ্যাপ প্রবেশ এবং ইনিশিয়াল ফাংশন কল
function enterApp() {
    // ক্র্যাশ প্রতিরোধের জন্য 'login-screen' রেফারেন্স সম্পূর্ণ বাদ দেওয়া হয়েছে
    const header = document.getElementById('app-header');
    const nav = document.getElementById('app-nav');
    
    if (header) header.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');
    
    updateUIBalances();
    switchTab('game');
    
    // Phaser গেম অবজেক্ট রিস্টার্ট
    if (window.fruitMatchGame) {
        window.fruitMatchGame.scene.keys['GameScene'].scene.restart();
    }
    
    // ব্যাকগ্রাউন্ড হার্টবিট সার্ভিস চালু করা
    startHeartbeatTimer();
}

// ওয়ালেট ব্যালেন্স, ইউজারনেম এবং রেফারেল লিংক আপডেট
function updateUIBalances() {
    if (!currentUser) return;
    
    document.getElementById('coin-balance').innerText = currentUser.coin_balance || 0;
    document.getElementById('gem-balance').innerText = currentUser.diamond_balance || 0;
    
    document.getElementById('drawer-username').innerText = currentUser.nickname;
    document.getElementById('header-username').innerText = currentUser.nickname;
    document.getElementById('drawer-coin').innerText = currentUser.coin_balance || 0;
    document.getElementById('drawer-gem').innerText = currentUser.diamond_balance || 0;
    document.getElementById('wallet-gem').innerText = currentUser.diamond_balance || 0;
    
    // কয়েন কনভার্সন (৬৭৭,৪০০ কয়েন = $১.০০)
    const coinUSD = ((currentUser.coin_balance || 0) / 677400).toFixed(2);
    document.getElementById('coin-usd').innerText = `=$${coinUSD}`;
    
    // ইউনিক রেফারেল লিংক জেনারেট
    document.getElementById('referral-link').value = `${window.location.origin}/signup?ref=${currentUser.id}`;
}

// ট্যাব সুইচিং (Game, Referral, Gems)
function switchTab(tabName) {
    document.getElementById('game-tab').classList.add('hidden');
    document.getElementById('referrals-tab').classList.add('hidden');
    document.getElementById('gems-tab').classList.add('hidden');

    if (tabName === 'game') {
        document.getElementById('game-tab').classList.remove('hidden');
    } else if (tabName === 'referrals') {
        document.getElementById('referrals-tab').classList.remove('hidden');
        loadReferralData();
    } else if (tabName === 'gems') {
        document.getElementById('gems-tab').classList.remove('hidden');
    }
}

// প্রোফাইল ড্রয়ার ওপেন/ক্লোজ টগল
function toggleDrawer(open) {
    const drawer = document.getElementById('profile-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (open) {
        drawer.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        drawer.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// ইউজার লগআউট প্রসেস
function handleLogout() {
    localStorage.removeItem('blockbuster_user');
    currentUser = null;
    window.location.href = '/login';
}

// সেটিংস ওভারলে ওপেন/ক্লোজ লজিক
function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }
function openRulesModal() { document.getElementById('rules-modal').classList.remove('hidden'); }
function closeRulesModal() { document.getElementById('rules-modal').classList.add('hidden'); }

// গেম রিস্টার্ট বাটন ট্রিগার
function restartGame() {
    if (window.fruitMatchGame) {
        window.fruitMatchGame.scene.keys['GameScene'].scene.restart();
    }
    closeSettings();
}

// রেফারেল লিংক ক্লিপবোর্ডে কপি
function copyRefLink() {
    const linkInput = document.getElementById('referral-link');
    linkInput.select();
    document.execCommand('copy');
    alert("রেফারেল লিংক কপি করা হয়েছে!");
}

// ডাটাবেজ থেকে রিয়েল-টাইম রেফারেল ডাটা নিয়ে আসা
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

// প্রতি ৫ মিনিট পরপর হার্টবিট বা অ্যাক্টিভিটি পিং পাঠানো
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
