// Debug mode - set to false for production
const DEBUG_MODE = false;

let timerInterval;
let isRunning = false;

// Available time presets in minutes
const timePresets = [15, 25, 45, 60];
let currentPresetIndex = 1; // Start with 25 minutes (index 1)
let selectedMinutes = timePresets[currentPresetIndex];
let timeRemaining = selectedMinutes * 60;

// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const timerPresetDisplay = document.querySelector('.timer-preset');
const decreaseTimeBtn = document.getElementById('decreaseTime');
const increaseTimeBtn = document.getElementById('increaseTime');

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updatePresetDisplay() {
    if (timerPresetDisplay) {
        timerPresetDisplay.textContent = `${selectedMinutes} min`;
    }
}

function decreaseTime() {
    if (!isRunning && currentPresetIndex > 0) {
        currentPresetIndex--;
        selectedMinutes = timePresets[currentPresetIndex];
        timeRemaining = selectedMinutes * 60;
        updateTimerDisplay();
        updatePresetDisplay();
    }
}

function increaseTime() {
    if (!isRunning && currentPresetIndex < timePresets.length - 1) {
        currentPresetIndex++;
        selectedMinutes = timePresets[currentPresetIndex];
        timeRemaining = selectedMinutes * 60;
        updateTimerDisplay();
        updatePresetDisplay();
    }
}

function startTimer() {
    if (!isRunning) {
        isRunning = true;
        startBtn.style.display = 'none';
        if (pauseBtn) {
            pauseBtn.style.display = 'flex';
            pauseBtn.classList.add('show');
        }
        
        timerInterval = setInterval(() => {
            if (timeRemaining > 0) {
                timeRemaining--;
                updateTimerDisplay();
            } else {
                stopTimer();
                showTimerCompleteAlert();
            }
        }, 1000);
    }
}

function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.style.display = 'flex';
    if (pauseBtn) {
        pauseBtn.style.display = 'none';
        pauseBtn.classList.remove('show');
    }
}

function resetTimer() {
    stopTimer();
    timeRemaining = selectedMinutes * 60;
    updateTimerDisplay();
}

function showTimerCompleteAlert() {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 2rem 3rem;
        border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        z-index: 10000;
        text-align: center;
        animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    alertDiv.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
        <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Session Completed!</h3>
        <p style="font-size: 1rem; opacity: 0.9;">Great work! You've completed your study session.</p>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1.5rem;
            padding: 0.75rem 2rem;
            background: white;
            color: #059669;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            Awesome!
        </button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 5000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translate(-50%, -60%);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
    }
`;
document.head.appendChild(style);

if (startBtn) startBtn.addEventListener('click', startTimer);
if (pauseBtn) pauseBtn.addEventListener('click', stopTimer);
if (resetBtn) resetBtn.addEventListener('click', resetTimer);
if (decreaseTimeBtn) decreaseTimeBtn.addEventListener('click', decreaseTime);
if (increaseTimeBtn) increaseTimeBtn.addEventListener('click', increaseTime);

const userMenu = document.getElementById('userMenu');
const userDropdown = document.getElementById('userDropdown');

if (userMenu && userDropdown) {
    userMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });
}

const viewProfileBtn = document.getElementById('viewProfile');
if (viewProfileBtn) {
    viewProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (userDropdown) userDropdown.classList.remove('active');
        alert('View Profile clicked - Navigate to profile page');
    });
}

const settingsBtn = document.getElementById('settingsOption');
if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (userDropdown) userDropdown.classList.remove('active');
        alert('Settings clicked - Navigate to settings page');
    });
}

const logoutBtn = document.getElementById('logoutOption');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (userDropdown) userDropdown.classList.remove('active');
        showLogoutConfirmation();
    });
}

function showLogoutConfirmation() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #111f3a;
        border: 1px solid #1e3a5f;
        border-radius: 1rem;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    modal.innerHTML = `
        <div style="text-align: center;">
            <div style="width: 60px; height: 60px; margin: 0 auto 1.5rem; background: rgba(239, 68, 68, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </div>
            <h3 style="color: #f8fafc; font-size: 1.5rem; margin-bottom: 0.75rem; font-weight: 600;">Confirm Logout</h3>
            <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">Are you sure you want to logout? Any unsaved progress will be lost.</p>
            <div style="display: flex; gap: 1rem;">
                <button id="cancelLogout" style="
                    flex: 1;
                    padding: 0.75rem 1.5rem;
                    background: #1a2942;
                    color: #cbd5e1;
                    border: 1px solid #1e3a5f;
                    border-radius: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#243654'" onmouseout="this.style.background='#1a2942'">
                    Cancel
                </button>
                <button id="confirmLogout" style="
                    flex: 1;
                    padding: 0.75rem 1.5rem;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                    Logout
                </button>
            </div>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const fadeStyle = document.createElement('style');
    fadeStyle.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(fadeStyle);
    
    document.getElementById('cancelLogout').addEventListener('click', () => {
        overlay.remove();
    });
    
    document.getElementById('confirmLogout').addEventListener('click', () => {
        overlay.remove();
        alert('Logging out... Redirecting to login page');
        // window.location.href = 'login.html';
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

const notificationIcon = document.getElementById('notificationIcon');
const notificationSidebar = document.getElementById('notificationSidebar');
const notificationOverlay = document.getElementById('notificationOverlay');
const closeNotification = document.getElementById('closeNotification');

if (notificationIcon && notificationSidebar && notificationOverlay) {
notificationIcon.addEventListener('click', (e) => {
e.stopPropagation();
notificationSidebar.classList.add('active');
notificationOverlay.classList.add('active');
document.body.style.overflow = 'hidden';
});
}

function closeNotificationSidebar() {
    if (notificationSidebar) notificationSidebar.classList.remove('active');
    if (notificationOverlay) notificationOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (closeNotification) closeNotification.addEventListener('click', closeNotificationSidebar);
if (notificationOverlay) notificationOverlay.addEventListener('click', closeNotificationSidebar);

const notificationItems = document.querySelectorAll('.notification-item');
notificationItems.forEach(item => {
    item.addEventListener('click', () => {
        item.classList.remove('unread');
        updateNotificationBadge();
    });
});

function updateNotificationBadge() {
    const unreadCount = document.querySelectorAll('.notification-item.unread').length;
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

const weeklyData = [
    { day: 'Mon', hours: 4.5 },
    { day: 'Tue', hours: 6.2 },
    { day: 'Wed', hours: 3.8 },
    { day: 'Thu', hours: 5.5 },
    { day: 'Fri', hours: 4.0 },
    { day: 'Sat', hours: 2.5 },
    { day: 'Sun', hours: 1.5 }
];

function createWeeklyChart() {
    const chartContainer = document.getElementById('weeklyChart');
    if (!chartContainer) return;

    chartContainer.innerHTML = '';
    
    const maxHours = Math.max(...weeklyData.map(d => d.hours));

    weeklyData.forEach((data, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'progress-bar-wrapper';

        const barContainer = document.createElement('div');
        barContainer.className = 'progress-bar';
        const heightPercent = maxHours > 0 ? (data.hours / maxHours) * 100 : 0;
        barContainer.style.height = `${heightPercent}%`;

        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.height = '0';

        const value = document.createElement('div');
        value.className = 'progress-value';
        value.textContent = `${data.hours}h`;

        const label = document.createElement('div');
        label.className = 'progress-label';
        label.textContent = data.day;

        fill.appendChild(value);
        barContainer.appendChild(fill);
        wrapper.appendChild(barContainer);
        wrapper.appendChild(label);
        chartContainer.appendChild(wrapper);

        setTimeout(() => {
            fill.style.height = '100%';
        }, index * 100 + 100);
    });
}

const sidebar = document.getElementById('sidebar');
const menuToggle = document.createElement('button');
menuToggle.innerHTML = '☰';
menuToggle.style.cssText = 'display: none; position: fixed; top: 15px; left: 15px; z-index: 101; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); padding: 0.5rem 0.75rem; border-radius: 0.5rem; cursor: pointer; font-size: 1.25rem;';
document.body.appendChild(menuToggle);

function checkMobileMenu() {
    if (window.innerWidth <= 768) {
        menuToggle.style.display = 'block';
    } else {
        menuToggle.style.display = 'none';
        if (sidebar) sidebar.classList.remove('active');
    }
}

menuToggle.addEventListener('click', () => {
    if (sidebar) sidebar.classList.toggle('active');
});

window.addEventListener('resize', checkMobileMenu);

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        sidebar && 
        sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        e.target !== menuToggle) {
        sidebar.classList.remove('active');
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Room Creation & Waiting Room Functionality
let roomCode = 'F40LN2';
let waitingRoomInterval = null;
let playersInRoom = [];
let roomCreated = false;

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create a new room
function createRoom() {
    roomCode = generateRoomCode();
    roomCreated = true;
    showRoomCreatedModal();
}

// Show Room Created Modal (with room code)
function showRoomCreatedModal() {
    const modal = document.getElementById('roomCreatedModal');
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const waitingRoomCode = document.getElementById('waitingRoomCode');
    const redirectLoading = document.getElementById('redirectLoading');
    
    if (!modal) {
        console.error('Room created modal not found!');
        return;
    }
    
    if (!roomCodeDisplay) {
        console.error('Room code display not found!');
        return;
    }
    
    // Update room code displays
    roomCodeDisplay.textContent = roomCode;
    if (waitingRoomCode) {
        waitingRoomCode.textContent = roomCode;
    }
    
    // Hide loading indicator initially
    if (redirectLoading) {
        redirectLoading.style.display = 'none';
    }
    
    // Hide enter room button initially
    const enterRoomBtn = document.getElementById('enterRoomBtn');
    if (enterRoomBtn) {
        enterRoomBtn.classList.remove('show');
    }
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Room Created Modal
function closeRoomCreatedModalFunc() {
    const modal = document.getElementById('roomCreatedModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        // If user cancels, reset room
        if (!roomCreated) {
            roomCode = '';
        }
    }
}

// Alias for backward compatibility
const closeRoomCreatedModal = closeRoomCreatedModalFunc;

// Show Waiting Room Modal
function showWaitingRoomModal() {
    console.log('showWaitingRoomModal called');
    const roomCreatedModal = document.getElementById('roomCreatedModal');
    const waitingModal = document.getElementById('waitingRoomModal');
    const waitingRoomCode = document.getElementById('waitingRoomCode');
    
    console.log('waitingModal element:', waitingModal);
    console.log('Current roomCode:', roomCode);
    
    if (!waitingModal) {
        console.error('❌ Waiting room modal not found in HTML!');
        alert('Waiting room modal not found. Please refresh the page.');
        return;
    }
    
    // Close room created modal if open
    if (roomCreatedModal) {
        roomCreatedModal.classList.remove('active');
        console.log('Closed room created modal');
    }
    
    // Update room code in waiting room
    if (waitingRoomCode && roomCode) {
        waitingRoomCode.textContent = roomCode;
        console.log('Updated waiting room code to:', roomCode);
    }
    
    // Show waiting room modal
    waitingModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log('✅ Waiting room modal should now be visible');
    
    // Start checking for players
    startWaitingRoomCheck();
}

// Close Waiting Room Modal
function closeWaitingRoomModal() {
    const modal = document.getElementById('waitingRoomModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        stopWaitingRoomCheck();
        playersInRoom = [];
        roomCreated = false;
        roomCode = '';
    }
}

// Start checking for players joining
function startWaitingRoomCheck() {
    // Reset players list (only show host initially)
    playersInRoom = [];
    updatePlayersList();
    
    // Simulate checking for players every 2 seconds
    waitingRoomInterval = setInterval(() => {
        checkForPlayers();
    }, 2000);
    
    // Simulate a player joining after 5 seconds (for demo purposes)
    setTimeout(() => {
        simulatePlayerJoin();
    }, 5000);
}

// Stop checking for players
function stopWaitingRoomCheck() {
    if (waitingRoomInterval) {
        clearInterval(waitingRoomInterval);
        waitingRoomInterval = null;
    }
}

// Check for players (this would normally be an API call)
function checkForPlayers() {
    // In a real implementation, this would check the server/API
    // For now, we'll simulate it
    if (DEBUG_MODE) console.log('Checking for players...');
}

// Simulate a player joining
function simulatePlayerJoin() {
    const newPlayer = {
        id: Date.now(),
        name: 'Opponent',
        avatar: 'OP',
        status: 'ready'
    };
    
    playersInRoom.push(newPlayer);
    updatePlayersList();
    updateWaitingStatus('Opponent joined! Starting game...');
    
    // After showing the joined message, start the game
    setTimeout(() => {
        startGame();
    }, 2000);
}

// Update players list in the UI
function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    // Clear existing players (except host)
    const hostItem = playersList.querySelector('.player-item.host');
    playersList.innerHTML = '';
    
    // Add host
    if (hostItem) {
        playersList.appendChild(hostItem);
    } else {
        const hostDiv = document.createElement('div');
        hostDiv.className = 'player-item host';
        hostDiv.innerHTML = `
            <div class="player-avatar">AQ</div>
            <div class="player-info">
                <div class="player-name">You (Host)</div>
                <div class="player-status ready">Ready</div>
            </div>
        `;
        playersList.appendChild(hostDiv);
    }
    
    // Add other players
    playersInRoom.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item joined';
        playerDiv.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-status ${player.status}">${player.status === 'ready' ? 'Ready' : 'Waiting'}</div>
            </div>
        `;
        playersList.appendChild(playerDiv);
    });
}

// Update waiting status text
function updateWaitingStatus(text) {
    const statusText = document.getElementById('waitingStatusText');
    if (statusText) {
        statusText.textContent = text;
    }
}

// Start the game (this would navigate to the game/competition page)
function startGame() {
    updateWaitingStatus('Starting game...');
    
    // In a real implementation, this would navigate to the game page
    setTimeout(() => {
        closeWaitingRoomModal();
        alert('Game starting! This would navigate to the game/competition page.');
        // window.location.href = 'game.html?room=' + roomCode;
    }, 1000);
}

// Copy room code to clipboard
function copyRoomCode() {
    const code = roomCode;
    
    if (!code) {
        console.error('No room code available!');
        alert('Error: No room code available. Please create a room first.');
        return;
    }
    
    const copyBtn = document.getElementById('copyCodeBtn');
    const copyText = document.getElementById('copyCodeText');
    const enterRoomBtn = document.getElementById('enterRoomBtn');
    const redirectLoading = document.getElementById('redirectLoading');
    
    if (!copyBtn || !copyText) {
        console.error('Copy button elements not found!');
        return;
    }
    
    // Show copied state immediately
    copyBtn.classList.add('copied');
    copyText.textContent = 'Copied!';
    
    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
            // Success - show Enter Room button
            showEnterRoomButton(enterRoomBtn, redirectLoading);
        }).catch(err => {
            console.error('Failed to copy code:', err);
            // Fallback: select text for manual copy
            fallbackCopyTextToClipboard(code);
            // Still show Enter Room button even if copy fails
            showEnterRoomButton(enterRoomBtn, redirectLoading);
        });
    } else {
        // Fallback for browsers that don't support clipboard API
        fallbackCopyTextToClipboard(code);
        // Show Enter Room button
        showEnterRoomButton(enterRoomBtn, redirectLoading);
    }
    
    // Reset button text after 2 seconds
    setTimeout(() => {
        if (copyBtn) {
            copyBtn.classList.remove('copied');
        }
        if (copyText) {
            copyText.textContent = 'Copy Code';
        }
    }, 2000);
}

// Show Enter Room button after copying code
function showEnterRoomButton(enterRoomBtn, redirectLoading) {
    // Hide loading indicator if it was shown
    if (redirectLoading) {
        redirectLoading.style.display = 'none';
    }
    
    // Show Enter Room button
    if (enterRoomBtn) {
        enterRoomBtn.classList.add('show');
        console.log('Enter Room button shown');
    } else {
        console.error('Enter Room button element not found!');
    }
}

// Show loading indicator and redirect to waiting room (kept for backward compatibility)
function showLoadingAndRedirect(redirectLoading) {
    console.log('showLoadingAndRedirect called');
    
    // Show loading indicator
    if (redirectLoading) {
        redirectLoading.style.display = 'flex';
        console.log('Loading indicator shown');
    } else {
        console.error('Redirect loading element not found!');
    }
    
    // Automatically redirect to waiting room after a short delay
    setTimeout(() => {
        console.log('Redirecting to waiting room now...');
        showWaitingRoomModal();
    }, 1000); // 1 second after copying
}

// Fallback copy method for older browsers
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Code copied using fallback method:', text);
        } else {
            console.warn('Fallback copy failed');
        }
    } catch (err) {
        console.error('Fallback copy error:', err);
    }
    
    document.body.removeChild(textArea);
}

// Event Listeners for Modals
document.addEventListener('DOMContentLoaded', () => {
    updateTimerDisplay();
    updatePresetDisplay();
    updateNotificationBadge();
    createWeeklyChart();
    checkMobileMenu();
    
    // Room Created Modal
    const closeRoomCreatedModal = document.getElementById('closeRoomCreatedModal');
    const closeRoomCreatedBtn = document.getElementById('closeRoomCreatedBtn');
    const roomCreatedModal = document.getElementById('roomCreatedModal');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    
    if (closeRoomCreatedModal) {
        closeRoomCreatedModal.addEventListener('click', () => {
            roomCreated = false;
            closeRoomCreatedModalFunc();
        });
    }
    
    if (closeRoomCreatedBtn) {
        closeRoomCreatedBtn.addEventListener('click', () => {
            roomCreated = false;
            closeRoomCreatedModalFunc();
        });
    }
    
    if (roomCreatedModal) {
        roomCreatedModal.addEventListener('click', (e) => {
            if (e.target === roomCreatedModal) {
                roomCreated = false;
                closeRoomCreatedModalFunc();
            }
        });
    }
    
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            copyRoomCode();
        });
    } else {
        console.error('Copy code button NOT found!');
    }
    
    // Enter Room Button
    const enterRoomBtn = document.getElementById('enterRoomBtn');
    if (enterRoomBtn) {
        enterRoomBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Close the room created modal first
            closeRoomCreatedModalFunc();
            // Then show the waiting room modal
            setTimeout(() => {
                showWaitingRoomModal();
            }, 300); // Small delay for smooth transition
        });
    } else {
        console.error('Enter room button NOT found!');
    }
    
    // Waiting Room Modal
    const closeWaitingRoomModalBtn = document.getElementById('closeWaitingRoomModal');
    const cancelWaitingBtn = document.getElementById('cancelWaitingBtn');
    const waitingRoomModal = document.getElementById('waitingRoomModal');
    
    if (closeWaitingRoomModalBtn) {
        closeWaitingRoomModalBtn.addEventListener('click', closeWaitingRoomModal);
    }
    
    if (cancelWaitingBtn) {
        cancelWaitingBtn.addEventListener('click', closeWaitingRoomModal);
    }
    
    if (waitingRoomModal) {
        waitingRoomModal.addEventListener('click', (e) => {
            if (e.target === waitingRoomModal) {
                closeWaitingRoomModal();
            }
        });
    }
    
    // Copy waiting room code button
    const copyWaitingRoomCode = document.getElementById('copyWaitingRoomCode');
    if (copyWaitingRoomCode) {
        copyWaitingRoomCode.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (roomCode) {
                navigator.clipboard.writeText(roomCode).then(() => {
                    const btn = e.target.closest('button');
                    if (btn) {
                        const originalHTML = btn.innerHTML;
                        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                        setTimeout(() => {
                            btn.innerHTML = originalHTML;
                        }, 2000);
                    }
                }).catch(err => {
                    console.error('Failed to copy:', err);
                });
            }
        });
    }
    
    // Make functions available globally (for testing or other triggers)
    window.createRoom = createRoom;
    window.showRoomCreatedModal = showRoomCreatedModal;
    window.copyRoomCode = copyRoomCode;
    window.showWaitingRoomModal = showWaitingRoomModal;
    
    // Verify all elements exist
    const roomCreatedModal = document.getElementById('roomCreatedModal');
    const waitingRoomModal = document.getElementById('waitingRoomModal');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    
    if (!roomCreatedModal) {
        console.error('❌ Room Created Modal not found in HTML!');
    }
    if (!waitingRoomModal) {
        console.error('❌ Waiting Room Modal not found in HTML!');
    }
    if (!copyCodeBtn) {
        console.error('❌ Copy Code Button not found in HTML!');
    }
    
    if (roomCreatedModal && waitingRoomModal && copyCodeBtn) {
        console.log('✅ All modal elements found! Ready to use.');
        console.log('💡 Test by calling: createRoom()');
    }
});