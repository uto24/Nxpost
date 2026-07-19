class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.score = 0;
        this.gridSize = 6; // ৬x৬ ফল গ্রিড
        this.tileSize = 52;
        this.gridOffset = { x: 25, y: 50 };
        
        // ফল ফ্রুট লিস্ট
        this.fruits = ['🍎', '🍌', '🍉', '🍕', '🍒', '🍦'];
        this.grid = [];
        this.selectedTile = null;
        this.isProcessing = false; // ক্যাসকেড চলাকালীন ক্লিকে বাধা দেওয়ার জন্য
        this.comboCount = 0; // কম্বো ট্র্যাকার

        // সোয়াইপ বা ড্র্যাগ কন্ট্রোল ট্র্যাক করার ভেরিয়েবল
        this.isDragging = false;
        this.activeDragTile = null;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this.generateBoard();
        this.setupDragEvents();
    }

    generateBoard() {
        for (let row = 0; row < this.gridSize; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                const x = this.gridOffset.x + col * this.tileSize + this.tileSize / 2;
                const y = this.gridOffset.y + row * this.tileSize + this.tileSize / 2;
                
                let randomFruit = Phaser.Math.RND.pick(this.fruits);
                
                // গেমের শুরুতে যাতে ৩টি ম্যাচ না তৈরি হয়ে যায় তার জন্য প্রটেকশন
                while ((col >= 2 && this.grid[row][col-1].getData('fruit') === randomFruit && this.grid[row][col-2].getData('fruit') === randomFruit) ||
                       (row >= 2 && this.grid[row-1][col].getData('fruit') === randomFruit && this.grid[row-2][col].getData('fruit') === randomFruit)) {
                    randomFruit = Phaser.Math.RND.pick(this.fruits);
                }

                this.createTileAt(row, col, x, y, randomFruit);
            }
        }

        // শুরুতে কোনো সম্ভাব্য চাল না থাকলে অটো শাফেল করা
        this.time.delayedCall(500, () => {
            this.checkAndReshuffleIfNeeded();
        });
    }

    createTileAt(row, col, x, y, fruit) {
        const container = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, this.tileSize - 4, this.tileSize - 4, 0x1b5e20, 0.8);
        bg.setStrokeStyle(2, 0x33691e);

        const textObj = this.add.text(0, 0, fruit, { fontSize: '28px' }).setOrigin(0.5);

        container.add(bg);
        container.add(textObj);

        container.setData('row', row);
        container.setData('col', col);
        container.setData('fruit', fruit);
        container.setData('text', textObj);
        container.setData('bg', bg);

        bg.setInteractive();
        this.grid[row][col] = container;

        // টাচ ডাউন ইভেন্টে সিলেকশন ও সোয়াইপ ট্র্যাক শুরু
        bg.on('pointerdown', (pointer) => {
            if (this.isProcessing) return;
            this.handleTileSelection(container);
            
            this.isDragging = true;
            this.activeDragTile = container;
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
        });
    }

    // টেনে ফল সোয়াপ (Drag and Swipe swapping) করার গলোবাল ইভেন্ট
    setupDragEvents() {
        this.input.on('pointerup', () => {
            this.isDragging = false;
            this.activeDragTile = null;
        });

        this.input.on('pointermove', (pointer) => {
            if (this.isDragging && this.activeDragTile && !this.isProcessing) {
                const dx = pointer.x - this.dragStartX;
                const dy = pointer.y - this.dragStartY;
                const threshold = 30; // সোয়াইপ লিমিট ৩০ পিক্সেল করা হয়েছে
                
                if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
                    this.isDragging = false; // একাধিক সোয়াইপ প্রতিরোধে ড্র্যাগিং অফ
                    
                    const r = this.activeDragTile.getData('row');
                    const c = this.activeDragTile.getData('col');
                    let targetRow = r;
                    let targetCol = c;
                    
                    // সোয়াইপ অভিমুখে টার্গেট গ্রিড নির্ণয়
                    if (Math.abs(dx) > Math.abs(dy)) {
                        targetCol = dx > 0 ? c + 1 : c - 1;
                    } else {
                        targetRow = dy > 0 ? r + 1 : r - 1;
                    }
                    
                    if (targetRow >= 0 && targetRow < this.gridSize && targetCol >= 0 && targetCol < this.gridSize) {
                        const targetTile = this.grid[targetRow][targetCol];
                        if (targetTile) {
                            this.activeDragTile.getData('bg').setStrokeStyle(2, 0x33691e);
                            this.selectedTile = null;
                            this.comboCount = 0; // কম্বো রিসেট
                            this.swapTiles(this.activeDragTile, targetTile, true);
                        }
                    }
                }
            }
        });
    }

    handleTileSelection(tile) {
        if (this.isProcessing) return;

        if (!this.selectedTile) {
            this.selectedTile = tile;
            // বাগ ফিক্স: setData পরিবর্তন করে সঠিক getData('bg') ব্যবহার করা হয়েছে
            tile.getData('bg').setStrokeStyle(3, 0xffeb3b); // হলুদ সিলেকশন বর্ডার
        } else {
            const tile1 = this.selectedTile;
            const tile2 = tile;
            this.selectedTile = null;

            // বাগ ফিক্স: এখানেও getData('bg') ফিক্স করা হয়েছে
            tile1.getData('bg').setStrokeStyle(2, 0x33691e); // আগের সবুজ বর্ডার

            const dist = Math.abs(tile1.getData('row') - tile2.getData('row')) + Math.abs(tile1.getData('col') - tile2.getData('col'));
            if (dist === 1) {
                this.comboCount = 0; // ক্লিক সোয়াপে কম্বো রিসেট
                this.swapTiles(tile1, tile2, true);
            }
        }
    }

    swapTiles(tile1, tile2, checkMatch = true) {
        this.isProcessing = true;
        const r1 = tile1.getData('row');
        const c1 = tile1.getData('col');
        const r2 = tile2.getData('row');
        const c2 = tile2.getData('col');

        this.grid[r1][c1] = tile2;
        this.grid[r2][c2] = tile1;

        tile1.setData('row', r2).setData('col', c2);
        tile2.setData('row', r1).setData('col', c1);

        // মসৃণ স্লাইড সোয়াপিং অ্যানিমেশন
        this.tweens.add({
            targets: tile1,
            x: this.gridOffset.x + c2 * this.tileSize + this.tileSize / 2,
            y: this.gridOffset.y + r2 * this.tileSize + this.tileSize / 2,
            ease: 'Quad.easeInOut',
            duration: 220
        });

        this.tweens.add({
            targets: tile2,
            x: this.gridOffset.x + c1 * this.tileSize + this.tileSize / 2,
            y: this.gridOffset.y + r1 * this.tileSize + this.tileSize / 2,
            ease: 'Quad.easeInOut',
            duration: 220,
            onComplete: () => {
                if (checkMatch) {
                    const matched = this.checkAndClearMatches();
                    if (!matched) {
                        // ম্যাচ না হলে লাল "No Match!" পপ-আপ সহ রিভার্স সোয়াপ
                        this.spawnFloatingText((tile1.x + tile2.x) / 2, (tile1.y + tile2.y) / 2, "❌ No Match!", '#FF3D00');
                        this.swapTiles(tile1, tile2, false);
                    } else {
                        this.isProcessing = false;
                    }
                } else {
                    this.isProcessing = false;
                }
            }
        });
    }

    checkAndClearMatches() {
        let matches = new Set();

        // রো চেকিং
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize - 2; c++) {
                if (!this.grid[r][c] || !this.grid[r][c+1] || !this.grid[r][c+2]) continue;
                const f1 = this.grid[r][c].getData('fruit');
                const f2 = this.grid[r][c+1].getData('fruit');
                const f3 = this.grid[r][c+2].getData('fruit');
                if (f1 === f2 && f2 === f3) {
                    matches.add(this.grid[r][c]);
                    matches.add(this.grid[r][c+1]);
                    matches.add(this.grid[r][c+2]);
                }
            }
        }

        // কলাম চেকিং
        for (let c = 0; c < this.gridSize; c++) {
            for (let r = 0; r < this.gridSize - 2; r++) {
                if (!this.grid[r][c] || !this.grid[r+1][c] || !this.grid[r+2][c]) continue;
                const f1 = this.grid[r][c].getData('fruit');
                const f2 = this.grid[r+1][c].getData('fruit');
                const f3 = this.grid[r+2][c].getData('fruit');
                if (f1 === f2 && f2 === f3) {
                    matches.add(this.grid[r][c]);
                    matches.add(this.grid[r+1][c]);
                    matches.add(this.grid[r+2][c]);
                }
            }
        }

        if (matches.size > 0) {
            this.isProcessing = true;
            this.comboCount++; // কম্বো চেইন প্লাস
            
            let listToDestroy = Array.from(matches);
            let animationCount = 0;

            let avgX = 0, avgY = 0;
            listToDestroy.forEach(t => { avgX += t.x; avgY += t.y; });
            avgX /= listToDestroy.length;
            avgY /= listToDestroy.length;

            listToDestroy.forEach(tile => {
                const r = tile.getData('row');
                const c = tile.getData('col');
                this.grid[r][c] = null;

                // পিন এবং স্পিন বিস্ফোরিত অ্যানিমেশন
                this.tweens.add({
                    targets: tile,
                    scaleX: 0,
                    scaleY: 0,
                    angle: 180, // ১৮০ ডিগ্রি ঘোরে সংকুচিত হবে
                    alpha: 0,
                    duration: 250,
                    onComplete: () => {
                        tile.destroy();
                        animationCount++;
                        if (animationCount === listToDestroy.length) {
                            this.cascadeGravity();
                        }
                    }
                });
            });

            // কম্বো বোনাসসহ স্কোর হিসেব
            const basePoints = matches.size * 10;
            const comboBonus = (this.comboCount - 1) * 15;
            const points = basePoints + comboBonus;
            
            this.score += points;
            document.getElementById('current-score').innerText = this.score;

            if (this.score > parseInt(document.getElementById('high-score').innerText)) {
                document.getElementById('high-score').innerText = this.score;
            }

            // কয়েন এবং কম্বো ফ্লোটিং পপ-আপ টেক্সট স্পন করানো
            this.spawnFloatingText(avgX, avgY, `+${points}🪙`, '#ffeb3b');
            if (this.comboCount > 1) {
                this.time.delayedCall(300, () => {
                    this.spawnFloatingText(avgX, avgY - 25, `Combo x${this.comboCount}!`, '#00E676');
                });
            }

            this.saveCoinsToBackend(points);
            return true;
        }

        return false;
    }

    spawnFloatingText(x, y, text, color) {
        const popup = this.add.text(x, y, text, {
            fontSize: '18px',
            fill: color,
            fontWeight: 'extrabold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: popup,
            y: y - 45,
            alpha: 0,
            duration: 850,
            onComplete: () => popup.destroy()
        });
    }

    cascadeGravity() {
        let maxDropDelay = 0;

        for (let c = 0; c < this.gridSize; c++) {
            let emptySpots = 0;

            for (let r = this.gridSize - 1; r >= 0; r--) {
                if (this.grid[r][c] === null) {
                    emptySpots++;
                } else if (emptySpots > 0) {
                    const tile = this.grid[r][c];
                    const targetRow = r + emptySpots;

                    this.grid[targetRow][c] = tile;
                    this.grid[r][c] = null;

                    tile.setData('row', targetRow);

                    this.tweens.add({
                        targets: tile,
                        y: this.gridOffset.y + targetRow * this.tileSize + this.tileSize / 2,
                        duration: 300,
                        ease: 'Bounce.easeOut'
                    });
                }
            }

            for (let r = 0; r < emptySpots; r++) {
                const targetRow = r;
                const x = this.gridOffset.x + c * this.tileSize + this.tileSize / 2;
                const startY = this.gridOffset.y - (emptySpots - r) * this.tileSize;

                const randomFruit = Phaser.Math.RND.pick(this.fruits);
                this.createTileAt(targetRow, c, x, startY, randomFruit);

                const tileContainer = this.grid[targetRow][c];
                tileContainer.setScale(0);

                const dropDelay = r * 50;
                if (dropDelay > maxDropDelay) maxDropDelay = dropDelay;

                this.tweens.add({
                    targets: tileContainer,
                    y: this.gridOffset.y + targetRow * this.tileSize + this.tileSize / 2,
                    scaleX: 1,
                    scaleY: 1,
                    delay: dropDelay,
                    duration: 300,
                    ease: 'Bounce.easeOut'
                });
            }
        }

        this.time.delayedCall(350 + maxDropDelay, () => {
            const hasMoreMatches = this.checkAndClearMatches();
            if (!hasMoreMatches) {
                this.isProcessing = false;
                this.checkAndReshuffleIfNeeded(); // সম্ভাব্য কোনো চাল না থাকলে শাফেল করা হবে
            }
        });
    }

    hasPossibleMoves() {
        // রো চেকিং
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize - 1; c++) {
                if (this.checkSwapCreatesMatch(r, c, r, c + 1)) return true;
            }
        }
        // কলাম চেকিং
        for (let r = 0; r < this.gridSize - 1; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.checkSwapCreatesMatch(r, c, r + 1, c)) return true;
            }
        }
        return false;
    }

    checkSwapCreatesMatch(r1, c1, r2, c2) {
        const f1 = this.grid[r1][c1].getData('fruit');
        const f2 = this.grid[r2][c2].getData('fruit');

        this.grid[r1][c1].setData('fruit', f2);
        this.grid[r2][c2].setData('fruit', f1);

        let matchFound = false;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                // রো চেক ৩-ম্যাচ
                if (c < this.gridSize - 2) {
                    if (this.grid[r][c].getData('fruit') === this.grid[r][c+1].getData('fruit') &&
                        this.grid[r][c+1].getData('fruit') === this.grid[r][c+2].getData('fruit')) {
                        matchFound = true;
                        break;
                    }
                }
                // কলাম চেক ৩-ম্যাচ
                if (r < this.gridSize - 2) {
                    if (this.grid[r][c].getData('fruit') === this.grid[r+1][c].getData('fruit') &&
                        this.grid[r+1][c].getData('fruit') === this.grid[r+2][c].getData('fruit')) {
                        matchFound = true;
                        break;
                    }
                }
            }
            if (matchFound) break;
        }

        this.grid[r1][c1].setData('fruit', f1);
        this.grid[r2][c2].setData('fruit', f2);

        return matchFound;
    }

    checkAndReshuffleIfNeeded() {
        if (!this.hasPossibleMoves()) {
            this.isProcessing = true;
            this.spawnFloatingText(180, 200, "No Moves! Shuffling...", '#FF3D00');

            this.time.delayedCall(1000, () => {
                for (let r = 0; r < this.gridSize; r++) {
                    for (let c = 0; c < this.gridSize; c++) {
                        if (this.grid[r][c]) {
                            this.grid[r][c].destroy();
                            this.grid[r][c] = null;
                        }
                    }
                }
                this.generateBoard();
                this.isProcessing = false;
            });
        }
    }

    showMoveHint() {
        if (this.isProcessing) return;

        let hintMove = null;

        // রো চেকিং
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize - 1; c++) {
                if (this.checkSwapCreatesMatch(r, c, r, c + 1)) {
                    hintMove = { t1: this.grid[r][c], t2: this.grid[r][c+1] };
                    break;
                }
            }
            if (hintMove) break;
        }

        // কলাম চেকিং
        if (!hintMove) {
            for (let r = 0; r < this.gridSize - 1; r++) {
                for (let c = 0; c < this.gridSize; c++) {
                    if (this.checkSwapCreatesMatch(r, c, r + 1, c)) {
                        hintMove = { t1: this.grid[r][c], t2: this.grid[r+1][c] };
                        break;
                    }
                }
                if (hintMove) break;
            }
        }

        if (hintMove) {
            this.isProcessing = true;
            const bg1 = hintMove.t1.getData('bg');
            const bg2 = hintMove.t2.getData('bg');

            bg1.setStrokeStyle(3, 0xffeb3b);
            bg2.setStrokeStyle(3, 0xffeb3b);

            this.spawnFloatingText(hintMove.t1.x, hintMove.t1.y, "💡 Here!", '#ffeb3b');

            this.tweens.add({
                targets: [hintMove.t1, hintMove.t2],
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 250,
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    hintMove.t1.setScale(1);
                    hintMove.t2.setScale(1);
                    bg1.setStrokeStyle(2, 0x33691e);
                    bg2.setStrokeStyle(2, 0x33691e);
                    this.isProcessing = false;
                }
            });
        } else {
            this.spawnFloatingText(180, 200, "No moves possible!", '#FF3D00');
        }
    }

    async saveCoinsToBackend(amount) {
        if (!currentUser) return;
        try {
            const res = await fetch('/api/add-coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, coinsEarned: amount })
            });
            const data = await res.json();
            if (res.ok) {
                currentUser.coin_balance = data.newBalance;
                localStorage.setItem('blockbuster_user', JSON.stringify(currentUser));
                
                const coinText = document.getElementById('coin-balance-game');
                if (coinText) {
                    coinText.innerText = data.newBalance;
                }
            }
        } catch (err) {
            console.error("Coin save error: ", err);
        }
    }
}

const gameConfig = {
    type: Phaser.AUTO,
    width: 360,
    height: 400,
    parent: 'block-game-container',
    backgroundColor: '#0a2f12',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: GameScene
};

window.fruitMatchGame = new Phaser.Game(gameConfig);
