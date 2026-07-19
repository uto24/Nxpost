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

        this.generateBoard();
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

                // টাইল কন্টেইনার এবং ব্যাকগ্রাউন্ড আঁকা
                const container = this.add.container(x, y);
                
                const bg = this.add.graphics();
                bg.fillStyle(0x1b5e20, 0.8);
                bg.fillRoundedRect(-this.tileSize / 2 + 2, -this.tileSize / 2 + 2, this.tileSize - 4, this.tileSize - 4, 10);
                bg.lineStyle(2, 0x33691e);
                bg.strokeRoundedRect(-this.tileSize / 2 + 2, -this.tileSize / 2 + 2, this.tileSize - 4, this.tileSize - 4, 10);

                const textObj = this.add.text(0, 0, randomFruit, { fontSize: '28px' }).setOrigin(0.5);

                container.add(bg);
                container.add(textObj);

                container.setData('row', row);
                container.setData('col', col);
                container.setData('fruit', randomFruit);
                container.setData('text', textObj);
                container.setData('bg', bg);

                container.setInteractive(new Phaser.Geom.Rectangle(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize), Phaser.Geom.Rectangle.Contains);
                this.grid[row][col] = container;

                container.on('pointerdown', () => this.handleTileSelection(container));
            }
        }
    }

    handleTileSelection(tile) {
        if (this.isProcessing) return; // অ্যানিমেশন প্রসেস চলাকালীন ক্লিক ব্লক

        if (!this.selectedTile) {
            this.selectedTile = tile;
            tile.setData('bg').lineStyle(3, 0xffeb3b);
            tile.setData('bg').strokeRoundedRect(-this.tileSize / 2 + 2, -this.tileSize / 2 + 2, this.tileSize - 4, this.tileSize - 4, 10);
        } else {
            const tile1 = this.selectedTile;
            const tile2 = tile;
            this.selectedTile = null;

            tile1.setData('bg').lineStyle(2, 0x33691e);
            tile1.setData('bg').strokeRoundedRect(-this.tileSize / 2 + 2, -this.tileSize / 2 + 2, this.tileSize - 4, this.tileSize - 4, 10);

            // চেক করুন পাশাপাশি কি না
            const dist = Math.abs(tile1.getData('row') - tile2.getData('row')) + Math.abs(tile1.getData('col') - tile2.getData('col'));
            if (dist === 1) {
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

        this.tweens.add({
            targets: tile1,
            x: this.gridOffset.x + c2 * this.tileSize + this.tileSize / 2,
            y: this.gridOffset.y + r2 * this.tileSize + this.tileSize / 2,
            duration: 200
        });

        this.tweens.add({
            targets: tile2,
            x: this.gridOffset.x + c1 * this.tileSize + this.tileSize / 2,
            y: this.gridOffset.y + r1 * this.tileSize + this.tileSize / 2,
            duration: 200,
            onComplete: () => {
                if (checkMatch) {
                    const matched = this.checkAndClearMatches();
                    if (!matched) {
                        this.swapTiles(tile1, tile2, false); // ম্যাচ না হলে আবার উল্টো দিকে সোয়াপ
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
            let listToDestroy = Array.from(matches);
            let animationCount = 0;

            listToDestroy.forEach(tile => {
                const r = tile.getData('row');
                const c = tile.getData('col');
                this.grid[r][c] = null; // গ্রিড থেকে সরিয়ে ফেলা

                this.tweens.add({
                    targets: tile,
                    scale: 0,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        tile.destroy();
                        animationCount++;
                        if (animationCount === listToDestroy.length) {
                            this.cascadeGravity(); // সকল ক্র্যাশ অ্যানিমেশন শেষ হলে উপর থেকে ফলের পতন শুরু
                        }
                    }
                });
            });

            const points = matches.size * 10;
            this.score += points;
            document.getElementById('current-score').innerText = this.score;

            if (this.score > parseInt(document.getElementById('high-score').innerText)) {
                document.getElementById('high-score').innerText = this.score;
            }

            this.saveCoinsToBackend(points);
            return true;
        }

        return false;
    }

    cascadeGravity() {
        let maxDropDelay = 0;

        for (let c = 0; c < this.gridSize; c++) {
            let emptySpots = 0;

            // নিচ থেকে উপরে স্ক্যান করে খালি জায়গাগুলোতে ফলের পতন করানো
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

            // একদম খালি হওয়া উপরের অংশে নতুন ফলের স্পন করানো
            for (let r = 0; r < emptySpots; r++) {
                const targetRow = r;
                const x = this.gridOffset.x + c * this.tileSize + this.tileSize / 2;
                const startY = this.gridOffset.y - (emptySpots - r) * this.tileSize;

                const randomFruit = Phaser.Math.RND.pick(this.fruits);
                const container = this.add.container(x, startY);
                container.setScale(0); // শুরুতে ছোট থেকে বড় হবে স্পন হওয়ার সময়

                const bg = this.add.graphics();
                bg.fillStyle(0x1b5e20, 0.8);
                bg.fillRoundedRect(-this.tileSize / 2 + 2, -this.tileSize / 2 + 2, this.tileSize - 4, this.tileSize - 4, 10);
                bg.lineStyle(2, 0x33691e);
                bg.strokeRoundedRect(-this.tileSize / 2 + 2, -this.tileSize / 2 + 2, this.tileSize - 4, this.tileSize - 4, 10);

                const textObj = this.add.text(0, 0, randomFruit, { fontSize: '28px' }).setOrigin(0.5);

                container.add(bg);
                container.add(textObj);

                container.setData('row', targetRow);
                container.setData('col', c);
                container.setData('fruit', randomFruit);
                container.setData('text', textObj);
                container.setData('bg', bg);

                container.setInteractive(new Phaser.Geom.Rectangle(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize), Phaser.Geom.Rectangle.Contains);
                this.grid[targetRow][c] = container;

                container.on('pointerdown', () => this.handleTileSelection(container));

                const dropDelay = r * 50;
                if (dropDelay > maxDropDelay) maxDropDelay = dropDelay;

                this.tweens.add({
                    targets: container,
                    y: this.gridOffset.y + targetRow * this.tileSize + this.tileSize / 2,
                    scale: 1,
                    delay: dropDelay,
                    duration: 300,
                    ease: 'Bounce.easeOut'
                });
            }
        }

        // ক্যাসকেড পুরোপুরি শেষ হলে অটোমেটিক চেইন ম্যাচ (Combo) আবার চেক করা হবে
        this.time.delayedCall(350 + maxDropDelay, () => {
            const hasMoreMatches = this.checkAndClearMatches();
            if (!hasMoreMatches) {
                this.isProcessing = false; // কোনো ম্যাচ না থাকলে প্লেয়ার ক্লিক অ্যাক্টিভ হবে
            }
        });
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
                updateUIBalances();
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
    scene: GameScene
};

window.fruitMatchGame = new Phaser.Game(gameConfig);
