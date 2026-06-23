// State Management
let state = {
    smtpConfig: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: 'ssl',
        user: '',
        pass: ''
    },
    email: {
        subject: '',
        body: ''
    },
    attachment: null, // Stores { filename, originalName, size } once uploaded
    recipients: [],
    campaignStatus: 'idle', // 'idle', 'running', 'paused', 'done'
    delaySeconds: 5,
    queue: [],
    currentIndex: 0,
    metrics: {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
    },
    timerId: null
};

// DOM Elements
const elements = {
    smtpHost: document.getElementById('smtp-host'),
    smtpPort: document.getElementById('smtp-port'),
    smtpSecure: document.getElementById('smtp-secure'),
    smtpUser: document.getElementById('smtp-user'),
    smtpPass: document.getElementById('smtp-pass'),
    btnSaveConfig: document.getElementById('btn-save-config'),
    presetGmail: document.getElementById('preset-gmail'),
    presetCustom: document.getElementById('preset-custom'),
    togglePassword: document.getElementById('toggle-password'),
    
    pdfFilename: document.getElementById('pdf-filename'),
    pdfFilesize: document.getElementById('pdf-filesize'),
    attachmentBadge: document.getElementById('attachment-badge'),
    btnAttachTrigger: document.getElementById('btn-attach-trigger'),
    btnRemoveAttachment: document.getElementById('btn-remove-attachment'),
    resumeInput: document.getElementById('resume-input'),
    attachmentIcon: document.getElementById('attachment-icon'),
    
    emailSubject: document.getElementById('email-subject'),
    emailBody: document.getElementById('email-body'),
    
    recipientsList: document.getElementById('recipients-list'),
    parsedCount: document.getElementById('parsed-count'),
    sendDelay: document.getElementById('send-delay'),
    delayValue: document.getElementById('delay-value'),
    
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnReset: document.getElementById('btn-reset'),
    
    campaignStatusBadge: document.getElementById('campaign-status-badge'),
    metricTotal: document.getElementById('metric-total'),
    metricSent: document.getElementById('metric-sent'),
    metricFailed: document.getElementById('metric-failed'),
    metricPending: document.getElementById('metric-pending'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressPercentage: document.getElementById('progress-percentage'),
    
    logsList: document.getElementById('logs-list'),
    btnClearLogs: document.getElementById('btn-clear-logs')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Icons
    lucide.createIcons();
    
    // 2. Load Email Template defaults (Empty by default now)
    elements.emailSubject.value = '';
    elements.emailBody.value = '';
    
    // 3. Load Saved SMTP Configuration
    loadConfig();
    
    // 4. Setup Event Listeners
    setupEventListeners();
    
    // 5. Perform initial email parse
    parseRecipients();
});

// Setup Event Listeners
function setupEventListeners() {
    // Preset buttons
    elements.presetGmail.addEventListener('click', () => applyPreset('gmail'));
    elements.presetCustom.addEventListener('click', () => applyPreset('custom'));
    
    // SMTP Security dropdown syncs port
    elements.smtpSecure.addEventListener('change', (e) => {
        if (e.target.value === 'ssl') {
            elements.smtpPort.value = 465;
        } else {
            elements.smtpPort.value = 587;
        }
    });
    
    // Password visibility toggle
    elements.togglePassword.addEventListener('click', () => {
        const type = elements.smtpPass.getAttribute('type') === 'password' ? 'text' : 'password';
        elements.smtpPass.setAttribute('type', type);
        const icon = elements.togglePassword.querySelector('i');
        if (type === 'text') {
            icon.setAttribute('data-lucide', 'eye-off');
        } else {
            icon.setAttribute('data-lucide', 'eye');
        }
        lucide.createIcons();
    });
    
    // Config Saving
    elements.btnSaveConfig.addEventListener('click', saveConfig);
    
    // File Upload Handlers
    elements.btnAttachTrigger.addEventListener('click', () => elements.resumeInput.click());
    elements.resumeInput.addEventListener('change', handleFileUpload);
    elements.btnRemoveAttachment.addEventListener('click', removeAttachment);
    
    // Recipients Change
    elements.recipientsList.addEventListener('input', parseRecipients);
    
    // Delay Slider
    elements.sendDelay.addEventListener('input', (e) => {
        state.delaySeconds = parseInt(e.target.value);
        elements.delayValue.textContent = `${state.delaySeconds}s`;
    });
    
    // Campaign Control Buttons
    elements.btnStart.addEventListener('click', startCampaign);
    elements.btnPause.addEventListener('click', pauseCampaign);
    elements.btnReset.addEventListener('click', resetCampaign);
    elements.btnClearLogs.addEventListener('click', clearLogs);
}

// SMTP presets handler
function applyPreset(presetType) {
    if (presetType === 'gmail') {
        elements.presetGmail.classList.add('active');
        elements.presetCustom.classList.remove('active');
        elements.smtpHost.value = 'smtp.gmail.com';
        elements.smtpPort.value = 465;
        elements.smtpSecure.value = 'ssl';
        elements.smtpHost.disabled = true;
        elements.smtpPort.disabled = true;
        elements.smtpSecure.disabled = true;
    } else {
        elements.presetCustom.classList.add('active');
        elements.presetGmail.classList.remove('active');
        elements.smtpHost.disabled = false;
        elements.smtpPort.disabled = false;
        elements.smtpSecure.disabled = false;
    }
}

// Save SMTP Config in LocalStorage
function saveConfig() {
    state.smtpConfig = {
        host: elements.smtpHost.value.trim(),
        port: parseInt(elements.smtpPort.value),
        secure: elements.smtpSecure.value,
        user: elements.smtpUser.value.trim(),
        pass: elements.smtpPass.value.trim()
    };
    
    localStorage.setItem('auto_email_smtp', JSON.stringify(state.smtpConfig));
    showToast('Configuration Saved!', 'success');
}

// Load SMTP Config from LocalStorage
function loadConfig() {
    const saved = localStorage.getItem('auto_email_smtp');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            state.smtpConfig = config;
            
            elements.smtpHost.value = config.host || 'smtp.gmail.com';
            elements.smtpPort.value = config.port || 465;
            elements.smtpSecure.value = config.secure || 'ssl';
            elements.smtpUser.value = config.user || '';
            elements.smtpPass.value = config.pass || '';
            
            if (config.host === 'smtp.gmail.com') {
                applyPreset('gmail');
            } else {
                applyPreset('custom');
            }
        } catch (e) {
            console.error('Error loading config', e);
        }
    }
}

// Upload selected file to Express server backend
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // UI state: uploading...
    elements.pdfFilename.textContent = 'Uploading attachment...';
    elements.pdfFilesize.textContent = 'Please wait';
    elements.btnAttachTrigger.disabled = true;
    elements.attachmentIcon.className = 'spin';
    elements.attachmentIcon.setAttribute('data-lucide', 'loader-2');
    lucide.createIcons();
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload-attachment', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            state.attachment = {
                filename: data.filename,
                originalName: data.originalName,
                size: data.size
            };
            
            // UI state: Success Attached
            elements.pdfFilename.textContent = data.originalName;
            const kbSize = (data.size / 1024).toFixed(1);
            elements.pdfFilesize.textContent = `Attached (${kbSize} KB)`;
            elements.attachmentBadge.classList.add('success-attached');
            elements.attachmentIcon.className = '';
            elements.attachmentIcon.setAttribute('data-lucide', 'file-check-2');
            
            elements.btnAttachTrigger.style.display = 'none';
            elements.btnRemoveAttachment.style.display = 'inline-flex';
            
            showToast('Document uploaded successfully!', 'success');
        } else {
            throw new Error(data.error || 'Server rejected file upload.');
        }
    } catch (error) {
        console.error('File upload failed:', error);
        showToast(error.message || 'File upload failed.', 'error');
        resetAttachmentUI();
    } finally {
        elements.btnAttachTrigger.disabled = false;
        lucide.createIcons();
    }
}

// Remove current attachment
function removeAttachment() {
    state.attachment = null;
    elements.resumeInput.value = ''; // Clear file input
    resetAttachmentUI();
    showToast('Attachment removed.', 'success');
}

// Reset Attachment UI elements back to empty state
function resetAttachmentUI() {
    state.attachment = null;
    elements.pdfFilename.textContent = 'No Resume Attached';
    elements.pdfFilesize.textContent = 'Click Attach to upload';
    elements.attachmentBadge.classList.remove('success-attached');
    elements.attachmentIcon.className = '';
    elements.attachmentIcon.setAttribute('data-lucide', 'paperclip');
    
    elements.btnAttachTrigger.style.display = 'inline-flex';
    elements.btnRemoveAttachment.style.display = 'none';
    lucide.createIcons();
}

// Parse emails from textarea
function parseRecipients() {
    const text = elements.recipientsList.value;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = text.match(emailRegex) || [];
    
    // Remove duplicates
    state.recipients = [...new Set(foundEmails)];
    
    elements.parsedCount.textContent = `${state.recipients.length} valid email${state.recipients.length === 1 ? '' : 's'} parsed`;
    
    // Enable start button if emails exist and campaign not running
    if (state.recipients.length > 0 && state.campaignStatus !== 'running') {
        elements.btnStart.disabled = false;
    } else if (state.recipients.length === 0) {
        elements.btnStart.disabled = true;
    }
}

// Update Dashboard UI buttons & form inputs based on state
function updateControlsUI() {
    const isRunning = state.campaignStatus === 'running';
    const isPaused = state.campaignStatus === 'paused';
    const isDone = state.campaignStatus === 'done';
    
    elements.btnStart.disabled = isRunning || (state.recipients.length === 0);
    elements.btnPause.disabled = !isRunning;
    elements.btnReset.disabled = isRunning;
    
    // Disable input settings while campaign is active
    elements.smtpHost.disabled = isRunning || isPaused || (elements.presetGmail.classList.contains('active'));
    elements.smtpPort.disabled = isRunning || isPaused || (elements.presetGmail.classList.contains('active'));
    elements.smtpSecure.disabled = isRunning || isPaused || (elements.presetGmail.classList.contains('active'));
    elements.smtpUser.disabled = isRunning || isPaused;
    elements.smtpPass.disabled = isRunning || isPaused;
    elements.presetGmail.disabled = isRunning || isPaused;
    elements.presetCustom.disabled = isRunning || isPaused;
    elements.btnSaveConfig.disabled = isRunning || isPaused;
    
    elements.emailSubject.disabled = isRunning || isPaused;
    elements.emailBody.disabled = isRunning || isPaused;
    elements.recipientsList.disabled = isRunning || isPaused;
    elements.btnAttachTrigger.disabled = isRunning || isPaused;
    elements.btnRemoveAttachment.disabled = isRunning || isPaused;
    
    // Set Status Badge
    elements.campaignStatusBadge.className = 'status-indicator-badge';
    if (isRunning) {
        elements.campaignStatusBadge.classList.add('running');
        elements.campaignStatusBadge.textContent = 'Sending';
    } else if (isPaused) {
        elements.campaignStatusBadge.classList.add('paused');
        elements.campaignStatusBadge.textContent = 'Paused';
    } else if (isDone) {
        elements.campaignStatusBadge.classList.add('done');
        elements.campaignStatusBadge.textContent = 'Completed';
    } else {
        elements.campaignStatusBadge.classList.add('idly');
        elements.campaignStatusBadge.textContent = 'Idle';
    }
}

// Start Campaign Process
function startCampaign() {
    // Validations
    if (!elements.smtpUser.value.trim() || !elements.smtpPass.value.trim()) {
        showToast('Please enter your SMTP Sender Email and App Password first!', 'error');
        return;
    }
    
    if (!elements.emailSubject.value.trim()) {
        showToast('Please write a Subject line for the email.', 'error');
        return;
    }
    
    if (!elements.emailBody.value.trim()) {
        showToast('Please write the Email Body content.', 'error');
        return;
    }
    
    if (state.recipients.length === 0) {
        showToast('Please paste at least one recipient email address.', 'error');
        return;
    }
    
    // Check if attachment is missing and prompt confirmation
    if (!state.attachment) {
        const proceedWithoutAttachment = confirm(
            "There is no attached document.\n\nAre you sure you want to send this email campaign without a resume/attachment?\n\n- Click 'OK' to send without a resume.\n- Click 'Cancel' to stop and attach your document."
        );
        if (!proceedWithoutAttachment) {
            return;
        }
    }
    
    // Read fresh template values
    state.email.subject = elements.emailSubject.value.trim();
    state.email.body = elements.emailBody.value;
    
    // Save SMTP configurations implicitly
    saveConfig();
    
    // Check if resuming from paused state
    if (state.campaignStatus === 'paused') {
        state.campaignStatus = 'running';
        updateControlsUI();
        processNextEmail();
        return;
    }
    
    // New campaign initialization
    state.campaignStatus = 'running';
    state.currentIndex = 0;
    
    // Setup Campaign Queue
    state.queue = state.recipients.map(email => ({
        email: email,
        status: 'pending',
        error: null,
        timestamp: null
    }));
    
    // Reset Metrics
    state.metrics = {
        total: state.queue.length,
        sent: 0,
        failed: 0,
        pending: state.queue.length
    };
    
    // Clear logs list display
    elements.logsList.innerHTML = '';
    
    // Render initial queue elements into log list
    state.queue.forEach((item, index) => {
        renderLogItem(index);
    });
    
    updateMetricsUI();
    updateControlsUI();
    
    // Start sending
    processNextEmail();
}

// Pause Campaign Process
function pauseCampaign() {
    state.campaignStatus = 'paused';
    if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
    }
    updateControlsUI();
    
    // Add paused marker in logs
    addSystemLog('Campaign paused by user.', 'warning');
}

// Reset Campaign Process
function resetCampaign() {
    state.campaignStatus = 'idle';
    if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
    }
    state.currentIndex = 0;
    state.queue = [];
    state.metrics = {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
    };
    
    // Reset UI
    elements.logsList.innerHTML = `
        <div class="log-empty-state">
            <i data-lucide="clipboard-list"></i>
            <p>Logs will appear here once the campaign starts.</p>
        </div>
    `;
    lucide.createIcons();
    
    updateMetricsUI();
    updateControlsUI();
    parseRecipients(); // Recount emails
}

// Process sending one email
async function processNextEmail() {
    if (state.campaignStatus !== 'running') return;
    
    // Check if we reached the end of queue
    if (state.currentIndex >= state.queue.length) {
        state.campaignStatus = 'done';
        updateControlsUI();
        addSystemLog('Campaign finished successfully!', 'success');
        showToast('All emails processed!', 'success');
        return;
    }
    
    const item = state.queue[state.currentIndex];
    item.status = 'sending';
    item.timestamp = getTimestamp();
    renderLogItem(state.currentIndex);
    
    // Scroll active item into view inside log list
    const logItemEl = document.getElementById(`log-item-${state.currentIndex}`);
    if (logItemEl) {
        logItemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    try {
        const payload = {
            smtpHost: state.smtpConfig.host,
            smtpPort: state.smtpConfig.port,
            smtpUser: state.smtpConfig.user,
            smtpPass: state.smtpConfig.pass,
            to: item.email,
            subject: state.email.subject,
            body: state.email.body,
            attachmentFilename: state.attachment ? state.attachment.filename : null,
            attachmentOriginalName: state.attachment ? state.attachment.originalName : null
        };
        
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            item.status = 'success';
            state.metrics.sent++;
        } else {
            item.status = 'failed';
            item.error = data.error || 'Unknown error occurred';
            state.metrics.failed++;
        }
    } catch (e) {
        item.status = 'failed';
        item.error = e.message || 'Network connection failed';
        state.metrics.failed++;
    }
    
    state.metrics.pending--;
    renderLogItem(state.currentIndex);
    updateMetricsUI();
    
    // Increment index
    state.currentIndex++;
    
    // Schedule next dispatch if running
    if (state.campaignStatus === 'running') {
        state.timerId = setTimeout(processNextEmail, state.delaySeconds * 1000);
    }
}

// Update Campaign statistics indicators
function updateMetricsUI() {
    elements.metricTotal.textContent = state.metrics.total;
    elements.metricSent.textContent = state.metrics.sent;
    elements.metricFailed.textContent = state.metrics.failed;
    elements.metricPending.textContent = state.metrics.pending;
    
    // Progress calculation
    let percentage = 0;
    if (state.metrics.total > 0) {
        const processed = state.metrics.total - state.metrics.pending;
        percentage = Math.round((processed / state.metrics.total) * 100);
    }
    
    elements.progressBarFill.style.width = `${percentage}%`;
    elements.progressPercentage.textContent = `${percentage}%`;
}

// Render or Update a single Queue item row in UI Logs list
function renderLogItem(index) {
    const item = state.queue[index];
    if (!item) return;
    
    let logItemEl = document.getElementById(`log-item-${index}`);
    
    // Create new if it does not exist
    if (!logItemEl) {
        // If empty state placeholder is there, remove it
        const emptyState = elements.logsList.querySelector('.log-empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        logItemEl = document.createElement('div');
        logItemEl.id = `log-item-${index}`;
        elements.logsList.appendChild(logItemEl);
    }
    
    logItemEl.className = `log-item ${item.status}`;
    
    // Determine icon based on status
    let statusIcon = 'clock';
    let statusText = 'Pending';
    if (item.status === 'sending') {
        statusIcon = 'loader-2';
        statusText = 'Sending';
    } else if (item.status === 'success') {
        statusIcon = 'check-circle';
        statusText = 'Sent';
    } else if (item.status === 'failed') {
        statusIcon = 'x-circle';
        statusText = 'Failed';
    }
    
    const timeStr = item.timestamp ? item.timestamp : '--:--:--';
    const isLoaderSpin = item.status === 'sending' ? 'spin' : '';
    
    let htmlContent = `
        <div class="log-meta">
            <span class="log-time">${timeStr}</span>
            <span class="log-email">${item.email}</span>
        </div>
        <div class="log-status-badge">
            <i data-lucide="${statusIcon}" class="${isLoaderSpin}"></i>
            <span>${statusText}</span>
        </div>
    `;
    
    if (item.status === 'failed' && item.error) {
        htmlContent += `<div class="log-error-detail">Error: ${item.error}</div>`;
    }
    
    logItemEl.innerHTML = htmlContent;
    lucide.createIcons();
}

// Add a direct system notification to the logs (e.g. Campaign start, pause)
function addSystemLog(text, type = 'pending') {
    const logItemEl = document.createElement('div');
    logItemEl.className = `log-item ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'party-popper';
    if (type === 'warning') icon = 'alert-triangle';
    
    logItemEl.innerHTML = `
        <div class="log-meta">
            <span class="log-time">${getTimestamp()}</span>
            <strong style="color: var(--text-primary); font-size: 0.85rem;">[SYSTEM] ${text}</strong>
        </div>
        <div class="log-status-badge">
            <i data-lucide="${icon}"></i>
        </div>
    `;
    elements.logsList.appendChild(logItemEl);
    elements.logsList.scrollTop = elements.logsList.scrollHeight;
    lucide.createIcons();
}

// Clear UI logs list
function clearLogs() {
    if (state.campaignStatus === 'running') {
        showToast('Cannot clear logs while campaign is running.', 'error');
        return;
    }
    elements.logsList.innerHTML = `
        <div class="log-empty-state">
            <i data-lucide="clipboard-list"></i>
            <p>Logs cleared. Ready for next run.</p>
        </div>
    `;
    lucide.createIcons();
}

// Helper: Get formatted current time HH:MM:SS
function getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

// Helper: Custom Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.right = '2rem';
    toast.style.padding = '0.9rem 1.5rem';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    toast.style.zIndex = '9999';
    toast.style.transition = 'all 0.3s ease';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.5rem';
    
    let icon = 'check-circle';
    if (type === 'success') {
        toast.style.backgroundColor = '#10b981';
    } else {
        toast.style.backgroundColor = '#f43f5e';
        icon = 'alert-triangle';
    }
    
    toast.innerHTML = `<i data-lucide="${icon}"></i> ${message}`;
    document.body.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
