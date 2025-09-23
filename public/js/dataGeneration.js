class DataGenerationManager {
    constructor() {
        this.selectedScale = null;
        this.currentJob = null;
        this.socket = null;
        this.refreshInterval = null;

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.loadScaleOptions();
        this.refreshQueueStats();
        this.loadJobHistory();

        // Setup periodic refresh
        this.refreshInterval = setInterval(() => {
            this.refreshQueueStats();
            this.loadJobHistory();
        }, 5000);
    }

    setupWebSocket() {
        // Initialize Socket.IO connection
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            if (window.logInfo) {
                window.logInfo('DataGen', 'WebSocket connected - ready for job progress updates');
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
            if (window.logWarning) {
                window.logWarning('DataGen', 'WebSocket disconnected - job progress updates unavailable');
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            if (window.logError) {
                window.logError('DataGen', `WebSocket connection failed: ${error.message}`);
            }
        });

        // Listen for job progress updates
        this.socket.on('job-progress', (data) => {
            console.log('Job progress update received:', data);
            if (window.logDebug) {
                window.logDebug('DataGen', `Progress update: ${data.percentage}% - ${data.stage}`);
            }
            if (this.currentJob && data.jobId === this.currentJob.jobId) {
                this.updateJobProgress(data);
            }
        });

        // Listen for job creation/completion events
        this.socket.on('job-created', (job) => {
            console.log('Job created:', job);
            if (window.logSuccess) {
                window.logSuccess('DataGen', `Job started: ${job.data?.scale || 'Unknown scale'}`);
            }
            this.currentJob = job;
            this.showJobProgress();
            this.refreshQueueStats();
        });

        this.socket.on('job-completed', (result) => {
            console.log('Job completed:', result);
            if (window.logSuccess) {
                window.logSuccess('DataGen', `Job completed successfully: ${result.jobId}`);
            }
            if (this.currentJob && result.jobId === this.currentJob.id) {
                this.hideJobProgress();
                this.currentJob = null;
            }
            this.refreshQueueStats();
        });

        this.socket.on('job-failed', (result) => {
            console.log('Job failed:', result);
            if (window.logError) {
                window.logError('DataGen', `Job failed: ${result.error || 'Unknown error'}`);
            }
            if (this.currentJob && result.jobId === this.currentJob.id) {
                this.hideJobProgress();
                this.currentJob = null;
            }
            this.refreshQueueStats();
        });

        this.socket.on('job-cancelled', (result) => {
            console.log('Job cancelled:', result);
            if (window.logWarning) {
                window.logWarning('DataGen', `Job cancelled: ${result.jobId}`);
            }
            if (this.currentJob && result.jobId === this.currentJob.id) {
                this.hideJobProgress();
                this.currentJob = null;
            }
            this.refreshQueueStats();
        });
    }

    setupEventListeners() {
        // Scale selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('scale-option')) {
                this.selectScale(e.target);
            }
        });

        // Start generation button
        document.getElementById('start-generation').addEventListener('click', () => {
            this.startDataGeneration();
        });

        // Cancel job button
        document.getElementById('cancel-current-job').addEventListener('click', () => {
            this.cancelCurrentJob();
        });
    }

    async loadScaleOptions() {
        try {
            const response = await fetch('/api/queue/scales');
            const scales = await response.json();

            const container = document.getElementById('scale-options');
            container.innerHTML = '';

            scales.forEach(scale => {
                const scaleElement = document.createElement('div');
                scaleElement.className = 'scale-option';
                scaleElement.dataset.scale = scale.id;

                scaleElement.innerHTML = `
                    <h4>${scale.name}</h4>
                    <p>${scale.description}</p>
                    <div class="scale-meta">
                        <span>CIs: ${scale.totalCIs.toLocaleString()}</span>
                        <span>Duration: ${scale.estimatedDuration}</span>
                        <span>Complexity: ${scale.complexity}</span>
                    </div>
                `;

                container.appendChild(scaleElement);
            });
        } catch (error) {
            console.error('Failed to load scale options:', error);
            this.showError('Failed to load scale options');
        }
    }

    selectScale(scaleElement) {
        // Remove previous selection
        document.querySelectorAll('.scale-option').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new scale
        scaleElement.classList.add('selected');
        this.selectedScale = scaleElement.dataset.scale;

        // Enable start button
        document.getElementById('start-generation').disabled = false;
    }

    async startDataGeneration() {
        if (!this.selectedScale) {
            this.showError('Please select a data scale first');
            return;
        }

        try {
            // Get clearExisting option from checkbox
            const clearExisting = document.getElementById('clear-existing-data').checked;

            const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scale: this.selectedScale,
                    customConfig: {
                        clearExisting: clearExisting
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to start job: ${response.statusText}`);
            }

            const job = await response.json();
            this.currentJob = job;

            // Subscribe to job progress updates
            this.socket.emit('subscribe-job-progress', job.jobId);

            this.showJobProgress();
            this.refreshQueueStats();

            // Show success message
            this.showSuccess('Data generation job started successfully');

        } catch (error) {
            console.error('Failed to start data generation:', error);
            this.showError('Failed to start data generation: ' + error.message);
        }
    }

    async cancelCurrentJob() {
        if (!this.currentJob) return;

        try {
            const response = await fetch(`/api/jobs/${this.currentJob.jobId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to cancel job: ${response.statusText}`);
            }

            this.socket.emit('unsubscribe-job-progress', this.currentJob.jobId);
            this.hideJobProgress();
            this.currentJob = null;
            this.refreshQueueStats();

            this.showSuccess('Job cancelled successfully');

        } catch (error) {
            console.error('Failed to cancel job:', error);
            this.showError('Failed to cancel job: ' + error.message);
        }
    }

    async refreshQueueStats() {
        try {
            const response = await fetch('/api/queue/stats');
            const stats = await response.json();

            document.getElementById('active-jobs').textContent = stats.active || 0;
            document.getElementById('queued-jobs').textContent = stats.waiting || 0;
            document.getElementById('completed-jobs').textContent = stats.completed || 0;
            document.getElementById('failed-jobs').textContent = stats.failed || 0;

            // Check if there's an active job we should display
            if (stats.active > 0 && !this.currentJob) {
                this.checkForActiveJob();
            }

        } catch (error) {
            console.error('Failed to refresh queue stats:', error);
        }
    }

    async checkForActiveJob() {
        try {
            const response = await fetch('/api/jobs');
            const jobs = await response.json();

            if (jobs.active && jobs.active.length > 0) {
                const activeJob = jobs.active[0];
                this.currentJob = activeJob;
                this.showJobProgress();

                if (window.logInfo) {
                    window.logInfo('DataGen', `Found active job: ${activeJob.data?.config?.name || 'Unknown'}`);
                }
            }
        } catch (error) {
            console.error('Failed to check for active job:', error);
        }
    }

    async loadJobHistory() {
        try {
            const response = await fetch('/api/jobs');
            const jobs = await response.json();

            const container = document.getElementById('job-history');
            container.innerHTML = '';

            const allJobs = [
                ...jobs.active.map(job => ({ ...job, status: 'active' })),
                ...jobs.waiting.map(job => ({ ...job, status: 'waiting' })),
                ...jobs.completed.slice(0, 5).map(job => ({ ...job, status: 'completed' })),
                ...jobs.failed.slice(0, 3).map(job => ({ ...job, status: 'failed' }))
            ];

            if (allJobs.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No job history available</p></div>';
                return;
            }

            allJobs.forEach(job => {
                const jobElement = document.createElement('div');
                jobElement.className = 'job-item';

                const timeText = this.formatJobTime(job);

                jobElement.innerHTML = `
                    <div class="job-item-info">
                        <h4>${job.data.config.name || 'Data Generation Job'}</h4>
                        <div class="job-item-meta">
                            Scale: ${job.data.scale} | CIs: ${job.data.config.totalCIs?.toLocaleString() || 'N/A'}
                        </div>
                    </div>
                    <div class="job-item-status">
                        <span class="status-badge ${job.status}">${job.status.toUpperCase()}</span>
                        <div class="job-item-time">${timeText}</div>
                    </div>
                `;

                container.appendChild(jobElement);
            });

        } catch (error) {
            console.error('Failed to load job history:', error);
        }
    }

    showJobProgress() {
        document.getElementById('job-progress-container').style.display = 'block';
        document.getElementById('no-job-message').style.display = 'none';
        document.getElementById('start-generation').disabled = true;
        document.getElementById('cancel-current-job').style.display = 'block';

        if (this.currentJob) {
            const jobData = this.currentJob.data || this.currentJob;
            const config = jobData.config || {};

            document.getElementById('current-job-title').textContent =
                config.name || 'Data Generation Job';
            document.getElementById('job-scale').textContent = jobData.scale || 'Unknown';
            document.getElementById('job-status').textContent = 'STARTING';
            document.getElementById('job-status').className = 'status-badge waiting';
            document.getElementById('estimated-duration').textContent =
                config.estimatedDuration || 'Unknown';
            document.getElementById('job-started').textContent =
                new Date(this.currentJob.createdAt || this.currentJob.timestamp || Date.now()).toLocaleTimeString();
            document.getElementById('total-cis').textContent =
                config.totalCIs?.toLocaleString() || 'Unknown';

            // Reset progress indicators
            document.getElementById('progress-fill').style.width = '0%';
            document.getElementById('progress-percentage').textContent = '0%';
            document.getElementById('progress-stage').textContent = 'Initializing';
            document.getElementById('progress-message').textContent = 'Starting data generation...';

            if (window.logInfo) {
                window.logInfo('DataGen', `Job progress display initialized for ${config.name || 'job'}`);
            }
        }
    }

    hideJobProgress() {
        document.getElementById('job-progress-container').style.display = 'none';
        document.getElementById('no-job-message').style.display = 'block';
        document.getElementById('start-generation').disabled = false;
        document.getElementById('cancel-current-job').style.display = 'none';

        // Reset progress
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('progress-percentage').textContent = '0%';
        document.getElementById('progress-stage').textContent = 'Idle';
        document.getElementById('progress-message').textContent = 'Waiting for job...';
    }

    updateJobProgress(progressData) {
        // Update progress bar
        document.getElementById('progress-fill').style.width = `${progressData.percentage}%`;
        document.getElementById('progress-percentage').textContent = `${progressData.percentage}%`;
        document.getElementById('progress-stage').textContent = progressData.stage.replace('-', ' ');
        document.getElementById('progress-message').textContent = progressData.message;

        // Update job status
        const statusElement = document.getElementById('job-status');
        if (progressData.stage === 'completed') {
            statusElement.textContent = 'COMPLETED';
            statusElement.className = 'status-badge completed';
            this.hideJobProgress();
            this.currentJob = null;
            this.showSuccess('Data generation completed successfully!');
        } else if (progressData.stage === 'error') {
            statusElement.textContent = 'FAILED';
            statusElement.className = 'status-badge failed';
            this.showError(`Job failed: ${progressData.message}`);
        } else {
            statusElement.textContent = 'ACTIVE';
            statusElement.className = 'status-badge active';
        }
    }

    formatJobTime(job) {
        if (job.completedAt) {
            return `Completed: ${new Date(job.completedAt).toLocaleTimeString()}`;
        } else if (job.startedAt) {
            return `Started: ${new Date(job.startedAt).toLocaleTimeString()}`;
        } else if (job.createdAt || job.timestamp) {
            return `Created: ${new Date(job.createdAt || job.timestamp).toLocaleTimeString()}`;
        }
        return 'Unknown';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create or update notification element
        let notification = document.getElementById('data-gen-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'data-gen-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 1000;
                max-width: 400px;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.className = `notification-${type}`;

        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        }

        // Show notification
        notification.style.opacity = '1';

        // Hide after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 5000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Make DataGenerationManager globally available
window.DataGenerationManager = DataGenerationManager;