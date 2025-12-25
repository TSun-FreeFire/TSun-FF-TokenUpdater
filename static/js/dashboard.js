// TSun Token Fetcher Dashboard - Modular JavaScript
// Professional, hand-crafted code structure

/* ==================== STATE MANAGEMENT ==================== */

const state = {
    startTime: null,
    currentStatus: 'idle',
    eventSource: null
};

/* ==================== UTILITY FUNCTIONS ==================== */

function formatTime(isoString) {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString();
}

function formatDuration(seconds) {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function calculateSpeed(completed, startTime) {
    if (!startTime || completed === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    return (completed / elapsed).toFixed(1);
}

/* ==================== DOM ELEMENTS ==================== */

const elements = {
    statusDot: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    forceRunBtn: document.getElementById('force-run-btn'),
    lastRunTime: document.getElementById('last-run-time'),
    progressSection: document.getElementById('progress-section'),
    currentRegion: document.getElementById('current-region'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    successCount: document.getElementById('success-count'),
    failedCount: document.getElementById('failed-count'),
    speedMetric: document.getElementById('speed-metric'),
    logContainer: document.getElementById('log-container'),
    historyTbody: document.getElementById('history-tbody')
};

/* ==================== STATUS MANAGEMENT ==================== */

function updateStatus(status) {
    state.currentStatus = status;
    
    const statusConfig = {
        running: {
            class: 'status-running',
            text: 'Running',
            btnDisabled: true,
            showProgress: true
        },
        completed: {
            class: 'status-idle',
            text: 'Completed',
            btnDisabled: false,
            showProgress: false
        },
        error: {
            class: 'status-error',
            text: 'Error',
            btnDisabled: false,
            showProgress: false
        },
        idle: {
            class: 'status-idle',
            text: 'Idle',
            btnDisabled: false,
            showProgress: false
        }
    };

    const config = statusConfig[status] || statusConfig.idle;
    
    elements.statusDot.className = `status-dot ${config.class}`;
    elements.statusText.textContent = config.text;
    elements.forceRunBtn.disabled = config.btnDisabled;
    
    if (config.showProgress) {
        elements.progressSection.classList.add('active');
        state.startTime = Date.now();
    } else {
        elements.progressSection.classList.remove('active');
    }
}

/* ==================== PROGRESS MANAGEMENT ==================== */

function updateProgress(stats) {
    if (!stats || stats.total === 0) return;

    const percentage = Math.round((stats.completed / stats.total) * 100);
    
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressText.textContent = `${stats.completed} / ${stats.total} (${percentage}%)`;
    elements.successCount.textContent = stats.success || 0;
    
    // Show failed count with timeout info if applicable
    const failedCount = stats.failed || 0;
    const timedOutCount = stats.timed_out || 0;
    if (timedOutCount > 0) {
        elements.failedCount.textContent = `${failedCount} (${timedOutCount} timeout)`;
    } else {
        elements.failedCount.textContent = failedCount;
    }
    
    elements.currentRegion.textContent = stats.current_region || 'Processing...';

    // Calculate and display speed
    if (state.startTime && stats.completed > 0) {
        const speed = calculateSpeed(stats.completed, state.startTime);
        elements.speedMetric.textContent = speed;
    }
}

/* ==================== LOG MANAGEMENT ==================== */

function addLog(log) {
    // Remove placeholder if exists
    const placeholder = elements.logContainer.querySelector('.text-gray-500');
    if (placeholder) {
        elements.logContainer.innerHTML = '';
    }

    const logEntry = document.createElement('div');
    logEntry.className = 'flex items-start space-x-2 fade-in-up';
    
    const levelColors = {
        success: 'text-green-400',
        error: 'text-red-400',
        warning: 'text-yellow-400',
        info: 'text-cyan-400'
    };
    
    const colorClass = levelColors[log.level] || 'text-gray-300';
    
    logEntry.innerHTML = `
        <span class="text-gray-500">[${log.timestamp}]</span>
        <span class="${colorClass}">${log.message}</span>
    `;
    
    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;

    // Keep only last 100 logs
    while (elements.logContainer.children.length > 100) {
        elements.logContainer.removeChild(elements.logContainer.firstChild);
    }
}

/* ==================== HISTORY MANAGEMENT ==================== */

function updateHistory(history) {
    if (!history || history.length === 0) return;

    elements.historyTbody.innerHTML = '';

    history.reverse().forEach(run => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-700/30 transition-colors';
        
        const regions = run.result?.results?.map(r => r.region).join(', ') || 'N/A';
        const avgSuccess = run.result?.results
            ? run.result.results.reduce((sum, r) => sum + r.success_rate, 0) / run.result.results.length
            : 0;
        
        const badgeClass = avgSuccess >= 95 
            ? 'badge-success' 
            : avgSuccess >= 80 
            ? 'badge-warning' 
            : 'badge-error';
        
        row.innerHTML = `
            <td class="px-4 py-3 text-white font-medium">#${run.run_number}</td>
            <td class="px-4 py-3 text-gray-300 mono">${formatTime(run.started_at)}</td>
            <td class="px-4 py-3 text-gray-300">${regions}</td>
            <td class="px-4 py-3">
                <span class="badge ${badgeClass}">
                    ${avgSuccess.toFixed(1)}%
                </span>
            </td>
            <td class="px-4 py-3 text-gray-300 mono">${formatDuration(run.elapsed)}</td>
        `;
        
        elements.historyTbody.appendChild(row);
    });
}

/* ==================== API CALLS ==================== */

async function pollStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        updateStatus(data.status);
        updateProgress(data.stats);
        
        if (data.last_run) {
            elements.lastRunTime.textContent = formatTime(data.last_run.started_at);
        }
    } catch (error) {
        console.error('Status poll error:', error);
    }
}

async function pollHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        updateHistory(data.history);
    } catch (error) {
        console.error('History poll error:', error);
    }
}

async function triggerRun() {
    try {
        const response = await fetch('/api/run', { method: 'POST' });
        if (response.ok) {
            addLog({ 
                timestamp: new Date().toLocaleTimeString(), 
                message: '🚀 Manual run triggered', 
                level: 'info' 
            });
        }
    } catch (error) {
        addLog({ 
            timestamp: new Date().toLocaleTimeString(), 
            message: '❌ Failed to trigger run', 
            level: 'error' 
        });
    }
}

/* ==================== SERVER-SENT EVENTS ==================== */

function initializeLogStream() {
    state.eventSource = new EventSource('/api/logs');
    
    state.eventSource.onmessage = function(event) {
        const log = JSON.parse(event.data);
        addLog(log);
    };
    
    state.eventSource.onerror = function(error) {
        console.error('SSE connection error:', error);
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
            if (state.eventSource.readyState === EventSource.CLOSED) {
                initializeLogStream();
            }
        }, 5000);
    };
}

/* ==================== EVENT LISTENERS ==================== */

function initializeEventListeners() {
    // Force run button
    elements.forceRunBtn.addEventListener('click', triggerRun);
    
    // Tab navigation (if implemented)
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

/* ==================== INITIALIZATION ==================== */

function initialize() {
    // Initial data load
    pollStatus();
    pollHistory();
    
    // Setup polling intervals
    setInterval(pollStatus, 2000);  // Poll status every 2 seconds
    setInterval(pollHistory, 10000); // Poll history every 10 seconds
    
    // Initialize log stream
    initializeLogStream();
    
    // Setup event listeners
    initializeEventListeners();
    
    console.log('🔥 TSun Dashboard initialized successfully');
}

/* ==================== PAGE LOAD ==================== */

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}