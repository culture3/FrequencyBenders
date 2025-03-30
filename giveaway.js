// giveaway.js

$(document).ready(function () {
    // Core variables
    const participants = new Set();
    const potentialDrops = [
        { name: "MAX WIN 50 Tip", probability: 1, image: "item1.png" },
        { name: "25 Tip", probability: 2, image: "item2.png" },
        { name: "15 Tip", probability: 7, image: "item3.png" },
        { name: "10 Tip", probability: 10, image: "item4.png" },
        { name: "Chef's Kiss", probability: 10, image: "item5.png" },
        { name: "5 Tip", probability: 70, image: "item6.png" },
    ];
    let reelItems = [];
    let currentWinner = null;
    let winnerSelected = false;
    let isSpinning = false;
    let keyword = '';
    let winnerMessagesList = [];
    let isSpecialSpin = false;
    let specialItemPool = [];

    const sortedDrops = [...potentialDrops].sort((a, b) => a.probability - b.probability);
    let cumulativeProbTop10 = 0;
    const top10PercentItems = sortedDrops.filter((item) => {
        if (cumulativeProbTop10 < 10) {
            cumulativeProbTop10 += item.probability;
            return true;
        }
        return false;
    });

    // DOM elements
    const keywordInput = $('#keyword-input');
    const participantCount = $('#participant-count');
    const winnerName = $('#winner-name');
    const winnerMessages = $('#winner-messages');
    const spinContainer = $('.spin-container');
    const spinButton = $('#spin-wheel');
    const rerollButton = $('#clear-giveaway');
    const tickSound = document.getElementById('tickSound');

    let cumulativeProb = 0;
    const cumulativeProbs = potentialDrops.map((item) => {
        cumulativeProb += item.probability;
        return cumulativeProb;
    });

    function cumulativeProbsForPool(itemPool) {
        let cumProb = 0;
        return itemPool.map((item) => (cumProb += item.probability));
    }

    // WebSocket setup
    const channelId = '11408596';
    const ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false');
    ws.onopen = () => {
        console.log('Connected to Kick Chat WebSocket');
        ws.send(JSON.stringify({
            event: 'pusher:subscribe',
            data: { channel: `chatrooms.${channelId}.v2` }
        }));
    };
    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.event === 'App\\Events\\ChatMessageEvent') {
            const chatData = JSON.parse(data.data);
            const username = chatData.sender.username;
            let content = chatData.content;
            const emoteMatch = content.match(/\[emote:\d+:(.*?)\]/);
            if (emoteMatch) content = emoteMatch[1];
            if (!isSpinning && keyword && content.trim().toLowerCase() === keyword.toLowerCase()) {
                if (participants.add(username)) updateParticipants();
            }
            if (currentWinner && username === currentWinner) {
                winnerMessagesList.push(content);
                updateWinnerMessages();
            }
        }
    };
    ws.onerror = (error) => console.error('WebSocket Error:', error);
    ws.onclose = (event) => console.log('WebSocket Closed - Code:', event.code, 'Reason:', event.reason);

    // Keyword input listener
    keywordInput.on('input', function () {
        keyword = $(this).val().trim();
        console.log('Active keyword:', keyword);
    });

    // Update participants
    function updateParticipants() {
        participantCount.text(participants.size);
        populateReel(Array.from(participants));
    }

    // Populate reel
    function populateReel(itemPool) {
        spinContainer.empty();
        reelItems = [];
        const totalReelItems = 100;
        if (itemPool.length === 0) return;

        if (typeof itemPool[0] === 'string') {
            for (let i = 0; i < totalReelItems; i++) {
                const randomParticipant = itemPool[Math.floor(Math.random() * itemPool.length)];
                const itemDiv = $(`
                    <div class="item">
                        <div class="item-wrapper">
                            <span class="participant-name">${randomParticipant}</span>
                        </div>
                    </div>
                `);
                spinContainer.append(itemDiv);
                reelItems.push(randomParticipant);
            }
        } else {
            const poolToUse = isSpecialSpin ? specialItemPool : itemPool;
            const probsToUse = cumulativeProbsForPool(poolToUse);
            for (let i = 0; i < totalReelItems; i++) {
                const randomItem = getRandomItem(poolToUse, probsToUse);
                const isTop10 = !isSpecialSpin && top10PercentItems.some(item => item.name === randomItem.name);
                const displayImage = isTop10 ? "golden.gif" : randomItem.image;
                const displayName = isTop10 ? "Frequency Spin" : randomItem.name;
                const itemDiv = $(`
                    <div class="item">
                        <div class="item-wrapper">
                            <img src="TM.png" alt="Watermark" class="watermark">
                            <img src="${displayImage}" alt="${displayName}" class="item-image">
                            <span class="winning-item-text">${displayName}</span>
                        </div>
                    </div>
                `);
                spinContainer.append(itemDiv);
                reelItems.push(randomItem);
            }
        }
    }

    // Update winner messages
    function updateWinnerMessages() {
        winnerMessages.empty();
        winnerMessagesList.forEach((msg) => {
            const msgDiv = $(`<div class="winner-message">${currentWinner}: ${msg}</div>`);
            winnerMessages.append(msgDiv);
        });
        winnerMessages.scrollTop(winnerMessages[0].scrollHeight);
    }

    // Get random item
    function getRandomItem(itemPool, probs) {
        const totalProb = probs[probs.length - 1];
        const rand = Math.random() * totalProb;
        for (let i = 0; i < probs.length; i++) {
            if (rand <= probs[i]) return itemPool[i];
        }
        return itemPool[itemPool.length - 1];
    }

    // Update buttons
    function updateButtons() {
        spinButton.text(winnerSelected ? 'Open Case' : 'Spin');
        rerollButton.text(winnerSelected ? 'Re-roll' : 'Clear');
    }

    // Spin wheel (modified to clear winner name)
    function spinWheel(button, isPrizeSpin = false) {
        isSpinning = true;
        button.prop('disabled', true).text(isPrizeSpin ? 'Opening...' : 'Spinning...');
        spinContainer.css('left', '0px');

        if (!isPrizeSpin) {
            // Clear previous winner, messages, and name on new participant spin
            currentWinner = null;
            winnerName.text('None'); // Clear the winner name
            winnerMessages.empty();
            winnerMessagesList = [];
            populateReel(Array.from(participants));
        } else {
            populateReel(potentialDrops);
        }

        $('.case-container').removeClass('hide-separator');
        $('.item').css({ transform: 'none', animation: 'none', opacity: 0.5 });

        const itemWidth = $('.item').outerWidth(true);
        const totalWidth = itemWidth * 100;
        const minStopIndex = 50;
        const maxStopIndex = 90;
        const stopIndex = Math.floor(Math.random() * (maxStopIndex - minStopIndex + 1) + minStopIndex);
        const caseContainerWidth = $('.case-container').width();
        const centerPosition = -1 * (itemWidth * stopIndex - caseContainerWidth / 2 + itemWidth / 2);
        const randomOffset = Math.random() * 100 - 50;
        const stopPosition = centerPosition + randomOffset;

        const caseContainerLeft = $('.case-container').offset().left;
        const absoluteCenter = caseContainerLeft + caseContainerWidth / 2;
        let lastCenteredItemIndex = -1;

        spinContainer.animate(
            { left: stopPosition },
            {
                duration: 7500,
                easing: 'easeOutExpo',
                step: function (now) {
                    lastCenteredItemIndex = updateItemOpacityAndSound(itemWidth, absoluteCenter, lastCenteredItemIndex);
                },
                complete: function () {
                    let closestItemIndex = -1;
                    let minDistanceFromCenter = Infinity;
                    $('.item').each(function (index) {
                        const itemLeft = $(this).offset().left;
                        const itemCenter = itemLeft + itemWidth / 2;
                        const distanceFromCenter = Math.abs(itemCenter - absoluteCenter);
                        if (distanceFromCenter < minDistanceFromCenter) {
                            minDistanceFromCenter = distanceFromCenter;
                            closestItemIndex = index;
                        }
                    });

                    const finalCenterPosition = -1 * (itemWidth * closestItemIndex - caseContainerWidth / 2 + itemWidth / 2);

                    spinContainer.animate(
                        { left: finalCenterPosition },
                        {
                            duration: 700,
                            easing: 'easeInOutQuad',
                            step: function (now) {
                                lastCenteredItemIndex = updateItemOpacityAndSound(itemWidth, absoluteCenter, lastCenteredItemIndex);
                            },
                            complete: function () {
                                $('.case-container').addClass('hide-separator');
                                const winningItem = reelItems[closestItemIndex];
                                const winningElement = $(spinContainer.children()[closestItemIndex]);
                                winningElement.css({ opacity: 1 });
                                $('.item').not(winningElement).css('opacity', 0.5);

                                if (!isPrizeSpin) {
                                    currentWinner = winningItem;
                                    winnerName.text(currentWinner);
                                    winningElement.find('.participant-name')
                                        .addClass('float-image')
                                        .css({ 'max-width': 'none', 'overflow': 'visible' });
                                    winnerSelected = true;
                                    updateButtons();
                                } else {
                                    const isTop10Percent = !isSpecialSpin && top10PercentItems.some(item => item.name === winningItem.name);
                                    const displayImage = isTop10Percent ? "golden.gif" : winningItem.image;
                                    const displayName = isTop10Percent ? "Frequency Spin" : winningItem.name;

                                    winnerName.text(currentWinner);
                                    winningElement.find('.item-wrapper').html(
                                        `<img src="TM.png" alt="Watermark" class="watermark">
                                         <img src="${displayImage}" alt="${displayName}" class="item-image float-image">
                                         <span class="winning-item-text">${displayName}</span>`
                                    );

                                    if (isTop10Percent && !isSpecialSpin) {
                                        console.log("Frequency Spin triggered! Re-spinning with top 10% items...");
                                        isSpecialSpin = true;
                                        specialItemPool = top10PercentItems;
                                        setTimeout(() => spinWheel(button, true), 1500);
                                    } else {
                                        triggerConfetti(winningElement);
                                        winnerSelected = false;
                                        if (isSpecialSpin) isSpecialSpin = false;
                                        updateButtons();
                                    }
                                }

                                isSpinning = false;
                                button.prop('disabled', false);
                                updateButtons();
                            }
                        }
                    );
                }
            }
        );
    }

    // Unchanged functions: updateItemOpacityAndSound, triggerConfetti
    function updateItemOpacityAndSound(itemWidth, absoluteCenter, lastCenteredItemIndex) {
        let closestItemIndex = -1;
        let minDistanceFromCenter = Infinity;

        $('.item').each(function (index) {
            const item = $(this);
            const itemLeft = item.offset().left;
            const itemCenter = itemLeft + itemWidth / 2;
            const distanceFromCenter = Math.abs(itemCenter - absoluteCenter);
            item.css('opacity', distanceFromCenter < itemWidth / 2 ? 1 : 0.5);

            if (distanceFromCenter < minDistanceFromCenter) {
                minDistanceFromCenter = distanceFromCenter;
                closestItemIndex = index;
            }
        });

        if (closestItemIndex !== -1 && closestItemIndex !== lastCenteredItemIndex) {
            tickSound.currentTime = 0;
            tickSound.play().catch((error) => console.log('Error playing tick sound:', error));
            return closestItemIndex;
        }
        return lastCenteredItemIndex;
    }

    function triggerConfetti(winningElement) {
        const itemPosition = winningElement.offset();
        const itemWidth = winningElement.width();
        const originX = (itemPosition.left + itemWidth / 2) / window.innerWidth;
        const originY = Math.max(0, (itemPosition.top - -75)) / window.innerHeight;

        confetti({
            particleCount: 100,
            spread: 300,
            origin: { x: originX, y: originY },
            colors: ['#28a745', '#ff0000', '#00ff00', '#0000ff', '#ffff00'],
            shapes: ['square', 'circle'],
            gravity: 0.2,
            scalar: 1.2,
            startVelocity: 40,
        });
    }

    // Button listeners
    spinButton.on('click', function () {
        if (!winnerSelected) {
            if (participants.size === 0) return;
            spinWheel($(this), false);
        } else {
            spinWheel($(this), true);
        }
    });

    rerollButton.on('click', function () {
        if (winnerSelected) {
            spinWheel($(this), false); // Re-roll clears previous winner
        } else {
            participants.clear();
            currentWinner = null;
            winnerSelected = false;
            keyword = '';
            keywordInput.val('');
            winnerName.text('None');
            winnerMessages.empty();
            winnerMessagesList = [];
            updateParticipants();
            updateButtons();
        }
    });

    // Initial setup
    updateButtons();
    participantCount.text('0');
});
