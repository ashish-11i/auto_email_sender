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
    attachment: null,      // Stores { filename, content, contentType, size }
    recipients: [],        // Raw parsed emails (from paste tab)
    csvData: [],           // Parsed CSV email strings
    activeTab: 'paste',    // 'paste' or 'csv'
    campaignStatus: 'idle',// 'idle', 'running', 'paused', 'done'
    delaySeconds: 5,
    queue: [],             // Campaign queue items: { email, status, error, timestamp }
    currentIndex: 0,
    metrics: {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        rate: '100%',
        eta: '--:--'
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
    
    // Gmail Safety Limit elements
    safetyCount: document.getElementById('safety-count'),
    safetyBarFill: document.getElementById('safety-bar-fill'),
    safetyStatus: document.getElementById('safety-status'),
    
    // Resume Attachment elements
    pdfFilename: document.getElementById('pdf-filename'),
    pdfFilesize: document.getElementById('pdf-filesize'),
    attachmentBadge: document.getElementById('attachment-badge'),
    btnAttachTrigger: document.getElementById('btn-attach-trigger'),
    btnRemoveAttachment: document.getElementById('btn-remove-attachment'),
    resumeInput: document.getElementById('resume-input'),
    attachmentIcon: document.getElementById('attachment-icon'),
    
    // Editor elements
    emailSubject: document.getElementById('email-subject'),
    emailBody: document.getElementById('email-body'),
    
    // Final Preview Modal elements
    previewModal: document.getElementById('preview-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalConfirm: document.getElementById('btn-modal-confirm'),
    modalPreviewSubject: document.getElementById('modal-preview-subject'),
    modalPreviewAttachment: document.getElementById('modal-preview-attachment'),
    modalPreviewCount: document.getElementById('modal-preview-count'),
    modalPreviewRecipients: document.getElementById('modal-preview-recipients'),
    modalPreviewContent: document.getElementById('modal-preview-content'),
    
    // Recipients tabs
    tabPaste: document.getElementById('tab-paste'),
    tabCsv: document.getElementById('tab-csv'),
    contentPaste: document.getElementById('content-paste'),
    contentCsv: document.getElementById('content-csv'),
    
    // Recipients inputs
    recipientsList: document.getElementById('recipients-list'),
    parsedCount: document.getElementById('parsed-count'),
    sendDelay: document.getElementById('send-delay'),
    delayValue: document.getElementById('delay-value'),
    
    // CSV dropzone elements
    csvDropzone: document.getElementById('csv-dropzone'),
    csvInput: document.getElementById('csv-input'),
    btnCsvTrigger: document.getElementById('btn-csv-trigger'),
    csvLoadedBadge: document.getElementById('csv-loaded-badge'),
    csvFilename: document.getElementById('csv-filename'),
    csvRowcount: document.getElementById('csv-rowcount'),
    btnClearCsv: document.getElementById('btn-clear-csv'),
    
    // Campaign Control Buttons
    btnStart: document.getElementById('btn-start'),
    btnPreview: document.getElementById('btn-preview'),
    btnPause: document.getElementById('btn-pause'),
    btnReset: document.getElementById('btn-reset'),
    
    // Campaign Metrics UI
    campaignStatusBadge: document.getElementById('campaign-status-badge'),
    metricTotal: document.getElementById('metric-total'),
    metricSent: document.getElementById('metric-sent'),
    metricFailed: document.getElementById('metric-failed'),
    metricRate: document.getElementById('metric-rate'),
    metricPending: document.getElementById('metric-pending'),
    metricEta: document.getElementById('metric-eta'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressPercentage: document.getElementById('progress-percentage'),
    
    logsList: document.getElementById('logs-list'),
    btnClearLogs: document.getElementById('btn-clear-logs')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Icons
    lucide.createIcons();
    
    // 2. Load Saved SMTP Configuration
    loadConfig();
    
    // 3. Setup Event Listeners
    setupEventListeners();
    
    // 4. Perform initial email parse
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
    
    // Advanced Settings Toggle
    document.getElementById('btn-toggle-advanced').addEventListener('click', () => {
        document.getElementById('advanced-settings-wrapper').classList.toggle('expanded');
    });
    
    // File Upload Handlers (Resume)
    elements.btnAttachTrigger.addEventListener('click', () => elements.resumeInput.click());
    elements.resumeInput.addEventListener('change', handleFileUpload);
    elements.btnRemoveAttachment.addEventListener('click', removeAttachment);
    
    // Tabs toggle handlers
    elements.tabPaste.addEventListener('click', () => switchTab('paste'));
    elements.tabCsv.addEventListener('click', () => switchTab('csv'));
    
    // Recipients Raw Change
    elements.recipientsList.addEventListener('input', parseRecipients);
    
    // CSV file upload zone events
    elements.btnCsvTrigger.addEventListener('click', () => elements.csvInput.click());
    elements.csvInput.addEventListener('change', (e) => handleCSVUpload(e.target.files[0]));
    elements.btnClearCsv.addEventListener('click', clearCSV);
    
    // CSV Drag & Drop handlers
    elements.csvDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.csvDropzone.classList.add('dragover');
    });
    elements.csvDropzone.addEventListener('dragleave', () => {
        elements.csvDropzone.classList.remove('dragover');
    });
    elements.csvDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.csvDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleCSVUpload(e.dataTransfer.files[0]);
        }
    });
    
    // Delay Slider
    elements.sendDelay.addEventListener('input', (e) => {
        state.delaySeconds = parseInt(e.target.value);
        elements.delayValue.textContent = `${state.delaySeconds}s`;
        updateETA();
    });
    
    // Modal Overlay Cancel / Confirm
    elements.btnCloseModal.addEventListener('click', hidePreviewModal);
    elements.btnModalCancel.addEventListener('click', hidePreviewModal);
    elements.btnModalConfirm.addEventListener('click', confirmStartCampaign);
    
    // Campaign Control Buttons
    elements.btnStart.addEventListener('click', handleSendTrigger);
    elements.btnPreview.addEventListener('click', handlePreviewTrigger);
    elements.btnPause.addEventListener('click', pauseCampaign);
    elements.btnReset.addEventListener('click', resetCampaign);
    elements.btnClearLogs.addEventListener('click', clearLogs);
}

// Switch between paste list and CSV upload methods
function switchTab(tabType) {
    if (state.campaignStatus === 'running' || state.campaignStatus === 'paused') return;
    
    state.activeTab = tabType;
    
    if (tabType === 'paste') {
        elements.tabPaste.classList.add('active');
        elements.tabCsv.classList.remove('active');
        elements.contentPaste.classList.remove('hidden');
        elements.contentCsv.classList.add('hidden');
        parseRecipients();
    } else {
        elements.tabCsv.classList.add('active');
        elements.tabPaste.classList.remove('active');
        elements.contentCsv.classList.remove('hidden');
        elements.contentPaste.classList.add('hidden');
        updateCSVCountUI();
    }
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
        
        // Collapse advanced panel since Gmail settings are automatic
        document.getElementById('advanced-settings-wrapper').classList.remove('expanded');
    } else {
        elements.presetCustom.classList.add('active');
        elements.presetGmail.classList.remove('active');
        elements.smtpHost.disabled = false;
        elements.smtpPort.disabled = false;
        elements.smtpSecure.disabled = false;
        
        // Expand advanced panel to let user fill custom details
        document.getElementById('advanced-settings-wrapper').classList.add('expanded');
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
    
    localStorage.setItem('resumereach_smtp', JSON.stringify(state.smtpConfig));
    showToast('Configuration Saved!', 'success');
}

// Load SMTP Config from LocalStorage
function loadConfig() {
    const saved = localStorage.getItem('resumereach_smtp');
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

// Process selected file locally and convert to Base64 (Serverless friendly)
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // UI state: converting...
    elements.pdfFilename.textContent = 'Processing file...';
    elements.pdfFilesize.textContent = 'Please wait';
    elements.btnAttachTrigger.disabled = true;
    elements.attachmentIcon.className = 'spin';
    elements.attachmentIcon.setAttribute('data-lucide', 'loader-2');
    lucide.createIcons();
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const base64Data = e.target.result.split(',')[1];
            state.attachment = {
                filename: file.name,
                content: base64Data,
                contentType: file.type,
                size: file.size
            };
            
            // UI state: Success Attached
            elements.pdfFilename.textContent = file.name;
            const kbSize = (file.size / 1024).toFixed(1);
            elements.pdfFilesize.textContent = `✓ Ready to send (${kbSize} KB)`;
            elements.attachmentBadge.classList.add('success-attached');
            elements.attachmentIcon.className = '';
            elements.attachmentIcon.setAttribute('data-lucide', 'file-check-2');
            
            elements.btnAttachTrigger.style.display = 'none';
            elements.btnRemoveAttachment.style.display = 'inline-flex';
            
            showToast('Document attached successfully!', 'success');
        } catch (err) {
            console.error('File conversion failed:', err);
            showToast('Failed to process document format.', 'error');
            resetAttachmentUI();
        } finally {
            elements.btnAttachTrigger.disabled = false;
            lucide.createIcons();
        }
    };
    
    reader.onerror = function() {
        showToast('Error reading local file.', 'error');
        resetAttachmentUI();
        elements.btnAttachTrigger.disabled = false;
        lucide.createIcons();
    };
    
    reader.readAsDataURL(file);
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
    elements.pdfFilename.textContent = '📄 Resume Attachment';
    elements.pdfFilesize.textContent = 'Upload your resume (PDF, DOCX)';
    elements.attachmentBadge.classList.remove('success-attached');
    elements.attachmentIcon.className = '';
    elements.attachmentIcon.setAttribute('data-lucide', 'paperclip');
    
    elements.btnAttachTrigger.style.display = 'inline-flex';
    elements.btnRemoveAttachment.style.display = 'none';
    lucide.createIcons();
}

// Process selected CSV File
function handleCSVUpload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Please upload a valid CSV file format.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const rows = parseCSVContent(text);
            
            if (rows.length === 0) {
                throw new Error("No records found in CSV file.");
            }
            
            state.csvData = rows;
            
            // Hide upload zone and show loaded badge
            elements.csvDropzone.style.display = 'none';
            elements.csvLoadedBadge.style.display = 'flex';
            elements.csvFilename.textContent = file.name;
            elements.csvRowcount.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'} loaded`;
            
            showToast('CSV file loaded successfully!', 'success');
            updateCSVCountUI();
        } catch (err) {
            console.error('CSV Parse Error:', err);
            showToast(err.message || 'Failed to parse CSV.', 'error');
            clearCSV();
        }
    };
    reader.readAsText(file);
}

// Clear currently uploaded CSV
function clearCSV() {
    state.csvData = [];
    elements.csvInput.value = '';
    
    elements.csvDropzone.style.display = 'flex';
    elements.csvLoadedBadge.style.display = 'none';
    
    updateCSVCountUI();
}

// Tokenize CSV to extract emails only
function parseCSVContent(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
        throw new Error("CSV file must contain a header row and at least one data row.");
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    
    // Find index of required Email column
    const emailIndex = headers.findIndex(h => h.includes('email') || h.includes('to'));
    
    if (emailIndex === -1) {
        throw new Error("CSV header must contain an 'Email' or 'To' column.");
    }
    
    const parsedEmails = [];
    for (let i = 1; i < lines.length; i++) {
        const rowValues = parseCSVLine(lines[i]);
        if (rowValues.length === 0) continue;
        
        // Skip rows that are too short or have empty emails
        if (rowValues.length <= emailIndex || !rowValues[emailIndex].trim()) continue;
        
        parsedEmails.push(rowValues[emailIndex].trim());
    }
    
    return parsedEmails;
}

// Robust single line CSV parser (handles commas inside quotes)
function parseCSVLine(line) {
    let arr = [];
    let quote = false;
    let val = '';
    for (let i = 0; i < line.length; i++) {
        let c = line[i];
        if (c === '"') {
            quote = !quote; // Toggle quote state
        } else if (c === ',' && !quote) {
            arr.push(val.replace(/^"|"$/g, '').trim()); // Push value, trim outer quotes
            val = '';
        } else {
            val += c;
        }
    }
    arr.push(val.replace(/^"|"$/g, '').trim());
    return arr;
}

// Update the parsed recipient UI counter
function updateCSVCountUI() {
    if (state.activeTab === 'csv') {
        const count = state.csvData.length;
        elements.parsedCount.textContent = `${count} CSV recipient${count === 1 ? '' : 's'} parsed`;
        elements.btnStart.disabled = (count === 0 || state.campaignStatus === 'running');
        elements.btnPreview.disabled = (count === 0 || state.campaignStatus === 'running');
        updateGmailMeter(count);
    }
}

// Parse emails from textarea (Paste tab)
function parseRecipients() {
    if (state.activeTab !== 'paste') return;
    
    const text = elements.recipientsList.value;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = text.match(emailRegex) || [];
    
    // Remove duplicates
    state.recipients = [...new Set(foundEmails)];
    
    elements.parsedCount.textContent = `${state.recipients.length} valid email${state.recipients.length === 1 ? '' : 's'} parsed`;
    
    // Enable start and preview buttons if emails exist and campaign not running
    if (state.recipients.length > 0 && state.campaignStatus !== 'running') {
        elements.btnStart.disabled = false;
        elements.btnPreview.disabled = false;
    } else {
        elements.btnStart.disabled = true;
        elements.btnPreview.disabled = true;
    }
    
    updateGmailMeter(state.recipients.length);
}

// Update Gmail safety sending limit widget
function updateGmailMeter(count) {
    elements.safetyCount.textContent = `${count} / 100`;
    
    const percent = Math.min((count / 100) * 100, 100);
    elements.safetyBarFill.style.width = `${percent}%`;
    
    // Clear classes
    elements.safetyBarFill.className = 'safety-bar-fill';
    elements.safetyStatus.className = 'safety-status';
    
    if (count <= 50) {
        elements.safetyBarFill.classList.add('success');
        elements.safetyStatus.classList.add('success');
        elements.safetyStatus.textContent = 'Safe Sending Volume';
    } else if (count <= 100) {
        elements.safetyBarFill.classList.add('warning');
        elements.safetyStatus.classList.add('warning');
        elements.safetyStatus.textContent = 'Moderate Daily Volume';
    } else {
        elements.safetyBarFill.classList.add('danger');
        elements.safetyStatus.classList.add('danger');
        elements.safetyStatus.textContent = 'Spam Risk: Limit < 100/day';
    }
}

// Update Dashboard UI buttons & form inputs based on state
function updateControlsUI() {
    const isRunning = state.campaignStatus === 'running';
    const isPaused = state.campaignStatus === 'paused';
    const isDone = state.campaignStatus === 'done';
    
    const hasRecipients = state.activeTab === 'paste' ? (state.recipients.length > 0) : (state.csvData.length > 0);
    
    elements.btnStart.disabled = isRunning || !hasRecipients;
    elements.btnPreview.disabled = isRunning || isPaused || !hasRecipients;
    elements.btnPause.disabled = !isRunning;
    elements.btnReset.disabled = isRunning;
    
    // Disable inputs while campaign is active
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
    
    elements.tabPaste.disabled = isRunning || isPaused;
    elements.tabCsv.disabled = isRunning || isPaused;
    elements.btnCsvTrigger.disabled = isRunning || isPaused;
    elements.btnClearCsv.disabled = isRunning || isPaused;
    
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

// Triggered when "Send Email" button is clicked
function handleSendTrigger() {
    // Validations
    if (!elements.smtpUser.value.trim() || !elements.smtpPass.value.trim()) {
        showToast('Please enter your SMTP credentials first!', 'error');
        return;
    }
    
    if (!elements.emailSubject.value.trim()) {
        showToast('Please write a Subject line.', 'error');
        return;
    }
    
    if (!elements.emailBody.value.trim()) {
        showToast('Please write the Email Body.', 'error');
        return;
    }
    
    const count = state.activeTab === 'paste' ? state.recipients.length : state.csvData.length;
    if (count === 0) {
        showToast('Please provide at least one recipient email.', 'error');
        return;
    }
    
    // Resume validation check
    if (!state.attachment) {
        const proceedWithoutAttachment = confirm(
            "📄 There is no attached document (Resume).\n\nAre you sure you want to send this campaign without an attachment?\n\n- Click 'OK' to proceed without attachment.\n- Click 'Cancel' to stop and upload a resume."
        );
        if (!proceedWithoutAttachment) {
            return;
        }
    }
    
    // If resuming paused campaign, bypass modal preview
    if (state.campaignStatus === 'paused') {
        state.campaignStatus = 'running';
        updateControlsUI();
        processNextEmail();
        return;
    }
    
    // Open Final Preview Modal
    openPreviewModal();
}

// Triggered when "Preview" button is clicked
function handlePreviewTrigger() {
    // Basic validations
    if (!elements.emailSubject.value.trim()) {
        showToast('Please write a Subject line.', 'error');
        return;
    }
    
    if (!elements.emailBody.value.trim()) {
        showToast('Please write the Email Body.', 'error');
        return;
    }
    
    const count = state.activeTab === 'paste' ? state.recipients.length : state.csvData.length;
    if (count === 0) {
        showToast('Please provide at least one recipient email.', 'error');
        return;
    }
    
    // Open Preview Modal directly without check
    openPreviewModal();
}

// Helper to fill and display the Preview Modal
function openPreviewModal() {
    const count = state.activeTab === 'paste' ? state.recipients.length : state.csvData.length;
    const emailsList = state.activeTab === 'paste' ? state.recipients : state.csvData;
    
    elements.modalPreviewSubject.textContent = elements.emailSubject.value.trim();
    elements.modalPreviewAttachment.textContent = state.attachment ? 
        `📎 ${state.attachment.filename} (${(state.attachment.size/1024).toFixed(1)} KB)` : 
        '⚠️ No Attachment (Sending without Resume)';
    elements.modalPreviewAttachment.style.color = state.attachment ? 'var(--color-success)' : 'var(--color-warning)';
    
    elements.modalPreviewCount.textContent = `${count} recipient${count === 1 ? '' : 's'}`;
    elements.modalPreviewRecipients.textContent = emailsList.join(', ');
    elements.modalPreviewContent.textContent = elements.emailBody.value;
    
    // Render Modal Backdrop
    elements.previewModal.style.display = 'flex';
}

// Hide Final Preview Modal
function hidePreviewModal() {
    elements.previewModal.style.display = 'none';
}

// Confirm click inside Preview Modal
function confirmStartCampaign() {
    // Validate SMTP configurations before executing (in case started from Preview button directly)
    if (!elements.smtpUser.value.trim() || !elements.smtpPass.value.trim()) {
        showToast('Please enter your SMTP credentials first!', 'error');
        hidePreviewModal();
        return;
    }
    
    // Resume check (if bypassed or started from Preview button, double check before sending)
    if (!state.attachment) {
        const proceedWithoutAttachment = confirm(
            "📄 There is no attached document (Resume).\n\nAre you sure you want to send this campaign without an attachment?\n\n- Click 'OK' to proceed without attachment.\n- Click 'Cancel' to stop and upload a resume."
        );
        if (!proceedWithoutAttachment) {
            hidePreviewModal();
            return;
        }
    }
    
    hidePreviewModal();
    
    // Save SMTP configurations
    saveConfig();
    
    // Begin Campaign sending setup
    startCampaignExecution();
}

// Start Campaign execution loops
function startCampaignExecution() {
    state.campaignStatus = 'running';
    state.currentIndex = 0;
    
    // Build campaign queue (simply map emails)
    if (state.activeTab === 'paste') {
        state.queue = state.recipients.map(email => ({
            email: email,
            status: 'pending',
            error: null,
            timestamp: null
        }));
    } else {
        state.queue = state.csvData.map(email => ({
            email: email,
            status: 'pending',
            error: null,
            timestamp: null
        }));
    }
    
    // Reset metrics
    state.metrics = {
        total: state.queue.length,
        sent: 0,
        failed: 0,
        pending: state.queue.length,
        rate: '100%',
        eta: '--:--'
    };
    
    elements.logsList.innerHTML = '';
    
    // Render initial queue log elements
    state.queue.forEach((item, index) => {
        renderLogItem(index);
    });
    
    updateMetricsUI();
    updateControlsUI();
    
    // Start sending loop
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
        pending: 0,
        rate: '100%',
        eta: '--:--'
    };
    
    elements.logsList.innerHTML = `
        <div class="log-empty-state">
            <i data-lucide="clipboard-list"></i>
            <p>Logs will appear here once the campaign starts.</p>
        </div>
    `;
    lucide.createIcons();
    
    updateMetricsUI();
    updateControlsUI();
    
    if (state.activeTab === 'paste') {
        parseRecipients();
    } else {
        updateCSVCountUI();
    }
}

// Process sending single email in the queue
async function processNextEmail() {
    if (state.campaignStatus !== 'running') return;
    
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
    
    if (elements.logsList.querySelector('.log-empty-state')) {
        elements.logsList.querySelector('.log-empty-state').remove();
    }
    
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
            subject: elements.emailSubject.value.trim(),
            body: elements.emailBody.value,
            attachment: state.attachment ? {
                filename: state.attachment.filename,
                content: state.attachment.content,
                contentType: state.attachment.contentType
            } : null
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
            item.error = data.error || 'Unknown SMTP error';
            state.metrics.failed++;
        }
    } catch (e) {
        item.status = 'failed';
        item.error = e.message || 'Network dispatch failed';
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

// Update Campaign statistics metrics and progress indicators
function updateMetricsUI() {
    elements.metricTotal.textContent = state.metrics.total;
    elements.metricSent.textContent = state.metrics.sent;
    elements.metricFailed.textContent = state.metrics.failed;
    elements.metricPending.textContent = state.metrics.pending;
    
    // Calculate Success Rate
    const processed = state.metrics.sent + state.metrics.failed;
    const ratePercent = processed > 0 ? Math.round((state.metrics.sent / processed) * 100) : 100;
    elements.metricRate.textContent = `${ratePercent}%`;
    
    // Calculate ETA
    updateETA();
    
    // Progress calculation
    let percentage = 0;
    if (state.metrics.total > 0) {
        percentage = Math.round((processed / state.metrics.total) * 100);
    }
    
    elements.progressBarFill.style.width = `${percentage}%`;
    elements.progressPercentage.textContent = `${percentage}%`;
}

// Calculate campaign ETA (Estimated Time Left)
function updateETA() {
    const totalRemaining = state.metrics.pending;
    if (totalRemaining <= 0 || state.campaignStatus === 'done' || state.campaignStatus === 'idle') {
        elements.metricEta.textContent = '--:--';
        return;
    }
    
    const totalSeconds = totalRemaining * state.delaySeconds;
    if (totalSeconds >= 60) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        elements.metricEta.textContent = `${mins}m ${secs}s`;
    } else {
        elements.metricEta.textContent = `${totalSeconds}s`;
    }
}

// Render or Update a single Queue item row in UI Logs list
function renderLogItem(index) {
    const item = state.queue[index];
    if (!item) return;
    
    let logItemEl = document.getElementById(`log-item-${index}`);
    
    if (!logItemEl) {
        logItemEl = document.createElement('div');
        logItemEl.id = `log-item-${index}`;
        elements.logsList.appendChild(logItemEl);
    }
    
    logItemEl.className = `log-item ${item.status}`;
    
    let statusSymbol = '•';
    let statusText = 'Pending';
    let labelArrow = '→';
    
    if (item.status === 'sending') {
        statusSymbol = '<i data-lucide="loader-2" class="spin" style="width:0.85rem; height:0.85rem;"></i>';
        statusText = 'Sending';
    } else if (item.status === 'success') {
        statusSymbol = '<span style="color: var(--color-success); font-weight: bold;">✓</span>';
        statusText = 'Sent';
    } else if (item.status === 'failed') {
        statusSymbol = '<span style="color: var(--color-failure); font-weight: bold;">✗</span>';
        statusText = 'Failed';
    }
    
    const timeStr = item.timestamp ? item.timestamp : '--:--:--';
    
    let htmlContent = `
        <div class="log-meta">
            <span class="log-time">${timeStr}</span>
            <span class="log-email" style="display:inline-flex; align-items:center; gap: 0.5rem;">
                ${statusSymbol} ${statusText} ${labelArrow} ${item.email}
            </span>
        </div>
        <div class="log-status-badge">
            <span class="log-time" style="font-size:0.75rem;">${index + 1}/${state.queue.length}</span>
        </div>
    `;
    
    if (item.status === 'failed' && item.error) {
        htmlContent += `<div class="log-error-detail">Reason: ${item.error}</div>`;
    }
    
    logItemEl.innerHTML = htmlContent;
    lucide.createIcons();
}

// Add a system announcement to the logs
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
