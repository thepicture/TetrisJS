'use strict';

const FIELD_WIDTH = 10;
const FIELD_HEIGHT = 15;
const PIXEL_SIZE = 30;
const UPDATE_INTERVAL_MS = 700;
const BLINK_INTERVAL_MS = 1000;
const BG_CHANGE_INTERVAL_MS = 5000;

const gameField = document.querySelector('.game-field');
const interfaceButton = document.querySelector('.interface-button');
const infoDiv = document.querySelector('.info');
const scoreDiv = document.querySelector('.score');

let blockGroupHistory = [];

const GAME_STATE = Object.freeze({
    PLAYING: 0,
    PAUSED: 1,
});

let currentGameState = GAME_STATE['PAUSED'];
let isPaused = true;

const blockColorsEnum = Object.freeze({
    0: 'red',
    1: 'orange',
    2: 'yellow',
    3: 'green',
    4: 'lightskyblue',
    5: 'blue',
    6: 'purple',
});

const bgColorsEnum = Object.freeze({
    0: 'darkred',
    1: 'darkgoldenrod',
    2: 'darkkhaki',
    3: 'darkgreen',
    4: 'lightskyblue',
    5: 'midnightblue',
    6: 'rebeccapurple',
});

class Block {
    x;
    y;
    color;
    block;
    blinkingInterval;

    constructor(x, y) {
        if (x < 0 || y < 0) throw new TetrisError(`Bad constructor use of Block: x and y must be 
                                                   positive integers.`);
        this.x = x;
        this.y = y;
    }

    setColor(color) {
        this.color = color;
    }

    createBlock() {
        let block = document.createElement('div');

        block.style.width = PIXEL_SIZE + 'px';
        block.style.height = PIXEL_SIZE + 'px';

        block.style.left = PIXEL_SIZE * this.x + 'px';
        block.style.top = PIXEL_SIZE * this.y + 'px';

        block.classList.add('block');
        block.style.backgroundColor = blockColorsEnum[this.color];


        gameField.append(block);

        this.blinkingInterval = setInterval(() => {
            if (this.block.style.backgroundColor !== "white") {
                this.block.style.backgroundColor = "white";
            } else {
                this.block.style.backgroundColor = blockColorsEnum[this.color];
            }
        }, BLINK_INTERVAL_MS);

        this.block = block;
    }

    moveTo(x, y) {
        if (!this.block) {
            throw new TetrisError(`Can't move a block because it is destroyed`);
        }

        this.block.style.left = PIXEL_SIZE * x + 'px';
        this.block.style.top = PIXEL_SIZE * y + 'px';

        this.x = x;
        this.y = y;
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    destroy() {
        this.block.remove();
        this.block = null;
        clearInterval(this.blinkingInterval);
        this.blinkingInterval = null;
    }
}

class GameOverHandler {
    constructor() {
    }

    static isOverwhelmed() {
        for (let blockGroup of blockGroupHistory) {
            if (blockGroup.filter((b) => b.getY() === 0).length > 0) {
                return true;
            }
        }
        return false;
    }

    static initializeGameOver() {
        interfaceButton.click();
    }
}

class BlockGroup {
    blockArray;
    isFrozen;
    interval;

    constructor(blockArray) {
        document.addEventListener('keydown', this.keyboardHandler.bind(this));

        this.blockArray = blockArray;

        blockArray.forEach((b) => b.createBlock());

        this.isFrozen = true;
        this.unfreeze();

        leftBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.moveLeft();
        });
        rightBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.moveRight();
        });
        downBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.moveDown();
        });

        rotateBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.rotate();
        });
    }

    keyboardHandler(event) {
        event.preventDefault();

        if (isPaused) return;

        if (event.key === 'ArrowLeft' || event.code === 'KeyA') {
            this.moveLeft();
        } else if (event.key === 'ArrowRight' || event.code === 'KeyD') {
            this.moveRight();
        } else if (event.key === 'ArrowDown' || event.code === 'KeyS') {
            this.moveDown();
        } else if (event.code === 'Space') {
            this.rotate();
        }
    }

    unfreeze() {
        if (this.isFrozen) {
            this.interval = setInterval(() => {
                if (!isPaused) {
                    this.moveDown();
                }
            }, UPDATE_INTERVAL_MS);
            this.isFrozen = false;
        } else {
            throw new TetrisError('Attempt to unfreeze unfrozen BlockGroup');
        }
    }

    freeze() {
        if (!this.isFrozen) {
            clearInterval(this.interval);
            this.interval = null;
            this.isFrozen = true;

            gameField.removeEventListener('keydown', this.keyboardHandler.bind(this));

            blockGroupHistory.push(this.blockArray);

            if (GameOverHandler.isOverwhelmed()) {
                GameOverHandler.initializeGameOver();
                return;
            }

            gameField.dispatchEvent(new CustomEvent('blockfreeze'));

            this.checkRows();
        } else {
            throw new TetrisError('Attempt to freeze frozen BlockGroup');
        }
    }

    moveLeft() {
        if (this.isFrozen) return;

        if (
            Math.min(...this.blockArray.map((b) => b.getX())) <= 0 ||
            this.hasLeftBlock()
        ) {
            return;
        }

        for (let block of this.blockArray) {
            block.moveTo(block.getX() - 1, block.getY());
        }
    }

    moveRight() {
        if (this.isFrozen) return;

        if (
            Math.max(...this.blockArray.map((b) => b.getX())) >= FIELD_WIDTH - 1 ||
            this.hasRightBlock()
        ) {
            return;
        }

        for (let block of this.blockArray) {
            block.moveTo(block.getX() + 1, block.getY());
        }
    }

    moveDown() {
        if (this.isFrozen) return;

        if (
            Math.max(...this.blockArray.map((b) => b.getY())) >= FIELD_HEIGHT - 1 ||
            this.hasBottomBlock()
        ) {
            this.freeze();
            return;
        }

        for (let block of this.blockArray) {
            block.moveTo(block.getX(), block.getY() + 1);
        }
    }

    rotate() {
        if (this.isFrozen) return;

        if (this.isCannotRotate()) {
            return;
        }

        let oldX = Math.min(...this.blockArray.map(b => b.getX()));
        let oldY = Math.min(...this.blockArray.map(b => b.getY()));

        for (let block of this.blockArray) {
            block.moveTo(block.getY(), block.getX());
        }

        let newX = Math.min(...this.blockArray.map(b => b.getX()));
        let newY = Math.min(...this.blockArray.map(b => b.getY()));

        for (let block of this.blockArray) {
            block.moveTo(block.getX() - (newX - oldX), block.getY() - (newY - oldY));
        }

        oldY = Math.max(...this.blockArray.map(b => b.getY()));

        for (let block of this.blockArray) {
            block.moveTo(block.getX(), -block.getY());
        }

        newY = Math.max(...this.blockArray.map(b => b.getY()));

        for (let deltaY = 0; deltaY < Math.abs(newY - oldY); deltaY++) {
            this.moveDown();
        }

        while (Math.max(...this.blockArray.map(b => b.getX())) >= FIELD_WIDTH) {
            this.moveLeft();
        }

        while (Math.min(...this.blockArray.map(b => b.getX())) < 0) {
            this.moveRight();
        }
    }

    isCannotRotate() {
        return Math.max(...this.blockArray.map(b => b.getX() + 1)) >= FIELD_WIDTH ||
            Math.min(...this.blockArray.map(b => b.getX() + 1)) < 0
            || this.hasRightBlock()
            || this.hasLeftBlock();
    }

    hasLeftBlock() {
        for (let blockGroup of blockGroupHistory) {
            for (let oldBlock of blockGroup) {
                for (let newBlock of this.blockArray) {
                    if (
                        newBlock.getX() - 1 === oldBlock.getX() &&
                        newBlock.getY() === oldBlock.getY()
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    hasRightBlock() {
        for (let blockGroup of blockGroupHistory) {
            for (let oldBlock of blockGroup) {
                for (let newBlock of this.blockArray) {
                    if (
                        newBlock.getX() + 1 === oldBlock.getX() &&
                        newBlock.getY() === oldBlock.getY()
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    hasBottomBlock() {
        for (let blockGroup of blockGroupHistory) {
            for (let oldBlock of blockGroup) {
                for (let newBlock of this.blockArray) {
                    if (
                        newBlock.getX() === oldBlock.getX() &&
                        newBlock.getY() + 1 === oldBlock.getY()
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkRows() {
        for (let y = FIELD_HEIGHT; y >= 0; y--) {
            let satisfiedBlocks = [];

            for (let blockGroup of blockGroupHistory) {
                satisfiedBlocks.push(...blockGroup.filter((b) => b.getY() === y));
            }
            if (satisfiedBlocks.length === FIELD_WIDTH) {
                ScoreTable.update(10);
                this.deleteBlocksOf(satisfiedBlocks);
                this.moveBlocksUpTo(y);
            }
        }
    }

    deleteBlocksOf(satisfiedBlocks) {
        satisfiedBlocks.forEach((b) => {
            for (let deletingGroup of blockGroupHistory) {
                let index = deletingGroup.indexOf(b);

                if (index === -1) continue;

                b.destroy();
                deletingGroup.splice(index, 1);
            }
        });
    }

    moveBlocksUpTo(y) {
        isPaused = true;
        for (let i = 0; i < FIELD_HEIGHT; i++) {
            for (let blockGroup of blockGroupHistory) {
                for (let block of blockGroup) {
                    if (block.getY() < y) {
                        let satisfiedBlocks = [];
                        for (let i = 0; i < FIELD_HEIGHT; i++) {
                            for (let satisfiedGroup of blockGroupHistory) {
                                satisfiedBlocks.push(
                                    ...satisfiedGroup.filter(
                                        (b) =>
                                            b.getX() === block.getX() && b.getY() === block.getY() + 1
                                    )
                                );
                            }
                            if (satisfiedBlocks.length > 0 || block.getY() === FIELD_HEIGHT - 1) continue;

                            block.moveTo(block.getX(), block.getY() + 1);
                        }
                    }
                }
            }
            this.checkRows();
        }
        isPaused = false;
    }
}

class BlockGenerator {
    static figureArray = [
        [
            [0, 0],
            [1, 0],
            [2, 0],
            [1, 1],
        ],
        [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ],
        [
            [0, 0],
            [1, 0],
            [2, 0],
            [2, 1],
        ],
        [
            [0, 0],
            [1, 0],
            [2, 0],
            [0, 1],
            [1, 1],
            [2, 1],
        ],
        [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 2]
        ]
    ];

    static generate() {
        let color = Math.floor(Math.random() * Object.keys(blockColorsEnum).length);

        let coords = this.figureArray[
            Math.floor(Math.random() * this.figureArray.length)
            ];

        for (let coordsPair of coords) {
            for (let blockGroup of blockGroupHistory) {
                let intersectedBlocks = blockGroup.filter(
                    (b) => b.getX() === coordsPair[0] && b.getY() === coordsPair[1]
                );
                if (intersectedBlocks.length > 0) {
                    GameOverHandler.initializeGameOver();
                    return [];
                }
            }
        }

        return coords.map((coord) => {
            let block = new Block(coord[0], coord[1]);
            block.setColor(color);
            return block;
        });
    }
}

class ScoreTable {
    constructor() {
    }

    static update(value) {
        this.value += value;
        scoreDiv.textContent = 'Score: ' + this.value;
    }

    static restart() {
        this.value = 0;
        this.update(this.value);
    }

    static getValue() {
        return this.value;
    }
}

class TetrisError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TetrisError';
    }
}

class Info {
    constructor() {
    }

    static showResults() {
        infoDiv.textContent = `Game over\r\nTotal score: ${ScoreTable.getValue()}`;
    }
}

class Background {
    static interval;

    constructor() {
    }

    static changeColor() {
        gameField.style.backgroundColor = bgColorsEnum[Math.floor(Math.random() * Object.keys(bgColorsEnum).length)];
    }

    static enableAnimation() {
        this.interval = setInterval(() => {
            Background.changeColor();
        }, BG_CHANGE_INTERVAL_MS);
    }

    static disableAnimation() {
        clearInterval(this.interval);
        this.interval = null;
        gameField.style.backgroundColor = "black";
    }
}

interfaceButton.addEventListener('click', () => {
    switch (currentGameState) {
        case 0:
            clearHistory();
            isPaused = true;
            currentGameState = GAME_STATE['PAUSED'];
            interfaceButton.hidden = infoDiv.hidden = false;
            Info.showResults();
            scoreDiv.hidden = true;
            Background.disableAnimation();
            break;
        case 1:
            isPaused = false;
            currentGameState = GAME_STATE['PLAYING'];
            new BlockGroup(BlockGenerator.generate());
            interfaceButton.hidden = infoDiv.hidden = true;
            scoreDiv.hidden = false;
            ScoreTable.restart();
            Background.enableAnimation();
            break;
    }
});

function clearHistory() {
    for (let blockGroup of blockGroupHistory) {
        for (let block of blockGroup) {
            block.destroy();
        }
    }
    blockGroupHistory = [];
}

gameField.addEventListener('blockfreeze', () => {
    new BlockGroup(BlockGenerator.generate());
});

interfaceButton.style.width =
    PIXEL_SIZE * FIELD_WIDTH - interfaceButton.clientLeft * 2 + 'px';

gameField.style.width = PIXEL_SIZE * FIELD_WIDTH + 'px';
gameField.style.height = PIXEL_SIZE * FIELD_HEIGHT + 'px';