let currentUser = null;

window.onload = () => {
    const saved = localStorage.getItem('blockbuster_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        enterApp();
    }
};

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const device_fingerprint = document.getElementById('login-device').value;

    if (!email || !device_fingerprint) {
        return alert("অনুগ্রহ করে সঠিক ইমেইল এবং ডিভাইস আইডি লিখুন।");
    }

    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email,
            device_fingerprint: device_fingerprint,
            age: 20,
            gender: 'Female',
            country: 'Bangladesh'
        })
    });

    const data = await response.json();
    if (response.ok) {
        currentUser = data.user;
        localStorage.setItem('blockbuster_user', JSON.stringify(currentUser));
        enterApp();
    } else {
        alert(data.detail || data.error);
    }
}

function enterApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('app-nav').classList.remove('hidden');
    
    updateUIBalances();
    switchTab('game');
    
    // গেম স্ক্রিন রিস্টার্ট
    if (window.fruitMatchGame) {
        window.fruitMatchGame.scene.keys['GameScene'].scene.restart();
    }
    
    // ব্যাকগ্রাউন্ড হার্টবিট সার্ভিস চালু করা
    startHeartbeatTimer();
}

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

    document.getElementById('referral-link').value = `${window.location.origin}/u/${currentUser.id}`;
}

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

function handleLogout() {
    localStorage.removeItem('blockbuster_user');
    currentUser = null;
    location.reload();
}

function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }
function openRulesModal() { document.getElementById('rules-modal').classList.remove('hidden'); }
function closeRulesModal() { document.getElementById('rules-modal').classList.add('hidden'); }

function restartGame() {
    if (window.fruitMatchGame) {
        window.fruitMatchGame.scene.keys['GameScene'].scene.restart();
    }
    closeSettings();
}

function copyRefLink() {
    const linkInput = document.getElementById('referral-link');
    linkInput.select();
    document.execCommand('copy');
    alert("রেফারেল লিংক ক্লিপবোর্ডে কপি করা হয়েছে!");
}

async function loadReferralData() {
    if (!currentUser) return;
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
}

function startHeartbeatTimer() {
    // প্রতি ৫ মিনিট পরপর হার্টবিট সার্ভিস চালু করা
    setInterval(async () => {
        if (!currentUser) return;
        await fetch('/api/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        console.log("Heartbeat logged.");
    }, 5 * 60 * 1000);
      }
