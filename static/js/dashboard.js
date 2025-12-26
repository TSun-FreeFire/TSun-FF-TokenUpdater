// TSun Token Fetcher Dashboard - Modular JavaScript
// Professional, hand-crafted code structure

/* ==================== STATE MANAGEMENT ==================== */

const state = {
    startTime: null,
    currentStatus: 'idle',
    previousStatus: 'idle',
    eventSource: null,
    statusInterval: null,
    logInterval: null
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

/* ==================== TAB MANAGEMENT ==================== */

function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all tab links
    document.querySelectorAll('.nav-tab').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected tab content
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Add active class to selected tab link
    const selectedLink = document.getElementById(`tab-link-${tabName}`);
    if (selectedLink) {
        selectedLink.classList.add('active');
    }

    // If health tab, refresh health data
    if (tabName === 'health') {
        refreshHealthData();
    }
}

async function refreshHealthData() {
    try {
        const response = await fetch('/health');
        const data = await response.json();

        // Update health UI
        document.getElementById('health-last-check').textContent = new Date().toLocaleTimeString();
        document.getElementById('health-env-mode').textContent = data.environment.toUpperCase();
        document.getElementById('health-env-platform').textContent = data.environment === 'serverless' ? 'Vercel' : 'Local Host';

        document.getElementById('health-conf-concurrent').textContent = data.configuration.max_concurrent;
        document.getElementById('health-conf-retries').textContent = data.configuration.max_retries;
        document.getElementById('health-conf-timeout').textContent = data.configuration.timeout_per_account;

        const githubStatus = data.github.configured ? '✅ Connected' : '❌ Not Configured';
        document.getElementById('health-github-status').textContent = githubStatus;
        document.getElementById('health-github-repo').textContent = data.github.repo;
        document.getElementById('health-github-path').textContent = data.github.path;

        // Update API list
        const apiList = document.getElementById('health-api-list');
        apiList.innerHTML = '';
        data.api_endpoints.forEach(url => {
            const item = document.createElement('div');
            item.className = 'info-item';
            item.innerHTML = `
                <span class="info-label">${new URL(url).hostname}</span>
                <span class="info-value" style="font-size: 11px; opacity: 0.7;">${url}</span>
            `;
            apiList.appendChild(item);
        });

    } catch (error) {
        console.error('Health data fetch error:', error);
    }
}

/* ==================== DOM ELEMENTS ==================== */

const elements = {
    statusDot: document.getElementById('status-dot'),
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
    historyTbody: document.getElementById('history-tbody'),
    api1Count: document.getElementById('api-1-count'),
    api2Count: document.getElementById('api-2-count'),
    api3Count: document.getElementById('api-3-count')
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
        if (!state.startTime) {
            state.startTime = Date.now();
        }
    } else {
        elements.progressSection.classList.remove('active');
        state.startTime = null;
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

    // Update API distribution stats
    if (stats.api_usage) {
        elements.api1Count.textContent = stats.api_usage.API_1 || 0;
        elements.api2Count.textContent = stats.api_usage.API_2 || 0;
        elements.api3Count.textContent = stats.api_usage.API_3 || 0;
    } else {
        // Reset to dashes when no data
        elements.api1Count.textContent = '-';
        elements.api2Count.textContent = '-';
        elements.api3Count.textContent = '-';
    }
}

/* ==================== LOG MANAGEMENT ==================== */

function clearLogs() {
    elements.logContainer.innerHTML = '<div class="italic" style="color: var(--text-muted);">Establishing secure connection...</div>';
}

function addLog(log) {
    // Handle special progress logs
    if (log.message.startsWith('PROGRESS:')) {
        const parts = log.message.split(':');
        const region = parts[1];
        const progress = parts[2]; // "678/1000"
        const timer = parts[3];    // "1m 34s"

        const [completed, total] = progress.split('/').map(Number);
        updateConsoleProgress(region, completed, total, timer);
        return;
    }

    // Remove placeholder if exists
    const placeholder = elements.logContainer.querySelector('.italic');
    if (placeholder) {
        elements.logContainer.innerHTML = '';
    }

    const logEntry = document.createElement('div');
    logEntry.className = 'fade-in-up';
    logEntry.style.marginBottom = '4px';

    const levelColors = {
        success: 'log-success',
        error: 'log-error',
        warning: 'log-warning',
        info: 'log-info'
    };

    const colorClass = levelColors[log.level] || '';

    logEntry.innerHTML = `
        <span class="log-timestamp">[${log.timestamp}]</span>
        <span class="${colorClass}">${log.message}</span>
    `;

    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;

    // Keep only last 100 logs
    while (elements.logContainer.children.length > 100) {
        elements.logContainer.removeChild(elements.logContainer.firstChild);
    }
}

function updateConsoleProgress(region, completed, total, timer) {
    const progressId = `console-progress-${region}`;
    let progressEl = document.getElementById(progressId);

    if (!progressEl) {
        // Remove placeholder if exists
        const placeholder = elements.logContainer.querySelector('.italic');
        if (placeholder) {
            elements.logContainer.innerHTML = '';
        }

        progressEl = document.createElement('div');
        progressEl.id = progressId;
        progressEl.className = 'console-progress fade-in-up';
        elements.logContainer.appendChild(progressEl);
    }

    const percentage = Math.round((completed / total) * 100);

    progressEl.innerHTML = `
        <div class="region-label">${region}</div>
        <div class="bar-container">
            <div class="bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="stats-label">${completed}/${total}</div>
        <div class="timer-label">${timer}</div>
    `;

    // Auto-scroll to bottom if it's a new element or we're already at bottom
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

/* ==================== HISTORY MANAGEMENT ==================== */

function updateHistory(history) {
    if (!history || history.length === 0) return;

    elements.historyTbody.innerHTML = '';

    // Reverse to show newest first
    const reversedHistory = [...history].reverse();

    reversedHistory.forEach(run => {
        if (run.result && run.result.results) {
            run.result.results.forEach(regionResult => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-700/30 transition-colors';

                const successRate = regionResult.success_rate;
                const badgeClass = successRate >= 95
                    ? 'badge-success'
                    : successRate >= 80
                        ? 'badge-warning'
                        : 'badge-error';

                row.innerHTML = `
                    <td style="padding: 12px 16px;" class="text-white font-medium">#${run.run_number}</td>
                    <td style="padding: 12px 16px;" class="text-gray-300 mono">${regionResult.region}</td>
                    <td style="padding: 12px 16px;" class="text-gray-300 mono">${regionResult.total}</td>
                    <td style="padding: 12px 16px;">
                        <span class="badge ${badgeClass}">
                            ${successRate.toFixed(1)}%
                        </span>
                    </td>
                    <td style="padding: 12px 16px;" class="text-gray-300 mono">${formatDuration(regionResult.duration || run.elapsed)}</td>
                `;
                elements.historyTbody.appendChild(row);
            });
        }
    });
}

/* ==================== API CALLS ==================== */

async function pollStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        state.previousStatus = state.currentStatus;
        state.currentStatus = data.status;

        updateStatus(data.status);
        updateProgress(data.stats);

        if (data.last_run) {
            elements.lastRunTime.textContent = formatTime(data.last_run.started_at);
        }

        // Show serverless indicator if applicable
        if (data.is_serverless) {
            const statusText = elements.statusText;
            if (!statusText.textContent.includes('Serverless')) {
                statusText.textContent = statusText.textContent + ' (Serverless)';
            }
        }

        // Handle status transitions
        handleStatusTransition();

    } catch (error) {
        console.error('Status poll error:', error);
    }
}

function handleStatusTransition() {
    // If transitioned from running to completed/idle, refresh history and clear logs
    if (state.previousStatus === 'running' && state.currentStatus !== 'running') {
        pollHistory();
        stopLogPolling();
        
        // Clear logs after execution ends (ephemeral logs)
        setTimeout(() => {
            clearLogs();
            console.log('🧹 Logs cleared - execution ended');
        }, 3000); // Wait 3 seconds to show final messages
    }

    // If transitioned to running, start log polling if not using SSE
    if (state.currentStatus === 'running' && state.previousStatus !== 'running') {
        // Clear logs when new execution starts
        clearLogs();
        
        if (!state.eventSource) {
            startLogPolling();
        }
    }

    // Adjust polling interval based on status
    const newInterval = state.currentStatus === 'running' ? 2000 : 10000;
    resetStatusPolling(newInterval);
}

function resetStatusPolling(intervalMs) {
    if (state.statusIntervalMs === intervalMs) return;

    if (state.statusInterval) {
        clearInterval(state.statusInterval);
    }

    state.statusIntervalMs = intervalMs;
    state.statusInterval = setInterval(pollStatus, intervalMs);
    console.log(`📡 Polling interval adjusted to ${intervalMs}ms`);
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
        // Get auth token from prompt
        const token = prompt('Enter authentication token (set in Vercel as RUN_SECRET_TOKEN):');
        if (!token) {
            addLog({
                timestamp: new Date().toLocaleTimeString(),
                message: '⚠️ Run cancelled - no token provided',
                level: 'warning'
            });
            return;
        }

        const response = await fetch('/api/run?token=' + encodeURIComponent(token), { 
            method: 'POST'
        });
        
        if (response.ok) {
            addLog({
                timestamp: new Date().toLocaleTimeString(),
                message: '🚀 Manual run triggered successfully',
                level: 'info'
            });
        } else {
            const data = await response.json();
            addLog({
                timestamp: new Date().toLocaleTimeString(),
                message: `❌ ${data.error || 'Failed to trigger run'}: ${data.message || ''}`,
                level: 'error'
            });
        }
    } catch (error) {
        addLog({
            timestamp: new Date().toLocaleTimeString(),
            message: '❌ Failed to trigger run: ' + error.message,
            level: 'error'
        });
    }
}

/* ==================== SERVER-SENT EVENTS / POLLING ==================== */

function initializeLogStream() {
    // Try SSE first, fallback to polling for serverless
    try {
        state.eventSource = new EventSource('/api/logs');

        state.eventSource.onmessage = function (event) {
            const log = JSON.parse(event.data);
            addLog(log);
        };

        state.eventSource.onerror = function (error) {
            console.log('SSE not available, switching to polling mode');
            state.eventSource.close();
            state.eventSource = null;
            // Use polling instead
            startLogPolling();
        };
    } catch (e) {
        console.log('SSE not supported, using polling mode');
        startLogPolling();
    }
}

function startLogPolling() {
    if (state.logInterval) return;

    let lastLogCount = 0;
    state.logInterval = setInterval(async () => {
        if (state.currentStatus !== 'running') {
            stopLogPolling();
            return;
        }

        try {
            const response = await fetch('/api/logs');
            const data = await response.json();

            if (data.logs && data.logs.length > lastLogCount) {
                const newLogs = data.logs.slice(lastLogCount);
                newLogs.forEach(log => addLog(log));
                lastLogCount = data.logs.length;
            }
        } catch (error) {
            console.error('Log polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}

function stopLogPolling() {
    if (state.logInterval) {
        clearInterval(state.logInterval);
        state.logInterval = null;
        console.log('🛑 Log polling stopped');
    }
}

/* ==================== EVENT LISTENERS ==================== */

function initializeEventListeners() {
    // Force run button
    if (elements.forceRunBtn) {
        elements.forceRunBtn.addEventListener('click', triggerRun);
    }
}

/* ==================== INITIALIZATION ==================== */

function initialize() {
    // Clear logs on page load (ephemeral logs - don't store in browser)
    clearLogs();
    
    // Initial data load
    pollStatus();
    pollHistory();

    // Initial status polling setup (idle by default)
    resetStatusPolling(10000);

    // Initialize log stream (will check status internally)
    initializeLogStream();

    // Setup event listeners
    initializeEventListeners();

    console.log('🔥 TSun Dashboard initialized successfully');
    console.log('📝 Logs are ephemeral - cleared on refresh and after execution');
}

/* ==================== PAGE LOAD ==================== */

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}