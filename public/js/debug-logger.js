// Debug Logger Terminal Module
class DebugLogger {
    constructor() {
        this.isVisible = false; // Start hidden by default
        this.maxLogs = 500; // Prevent memory overflow
        this.logCount = 0;

        // Ensure DOM is ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        try {
            this.bindEvents();
            this.log('info', 'DebugLogger initialized', { timestamp: new Date().toISOString() });

            // Intercept fetch for API monitoring
            this.interceptFetch();

            // Monitor errors
            this.interceptErrors();
        } catch (error) {
            console.error('Failed to initialize DebugLogger:', error);
        }
    }

    bindEvents() {
        try {
            // Toggle logger visibility
            const toggleBtn = document.getElementById('toggle-logger');
            const header = document.querySelector('.debug-header');

            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggle();
                });
            }

            if (header) {
                header.addEventListener('click', () => {
                    this.toggle();
                });
            }

            // Clear logs
            const clearBtn = document.getElementById('clear-logs');
            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.clear();
                });
            }
        } catch (error) {
            console.error('Error binding debug logger events:', error);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + ` to toggle
            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                this.toggle();
            }
            // Ctrl/Cmd + Shift + C to clear
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.clear();
            }
        });
    }

    toggle() {
        const logger = document.getElementById('debug-logger');
        const toggleBtn = document.getElementById('toggle-logger');

        if (logger && toggleBtn) {
            this.isVisible = !this.isVisible;

            if (this.isVisible) {
                logger.classList.remove('hidden');
                toggleBtn.textContent = 'Hide';
                this.log('debug', 'Debug console shown');
            } else {
                logger.classList.add('hidden');
                toggleBtn.textContent = 'Show';
                this.log('debug', 'Debug console hidden');
            }
        }
    }

    clear() {
        const content = document.getElementById('debug-content');
        if (content) {
            content.innerHTML = `
                <div class="debug-welcome">
                    <div class="debug-line">
                        <span class="debug-timestamp">[${this.getTimestamp()}]</span>
                        <span class="debug-level info">INFO</span>
                        <span class="debug-message">Debug console cleared</span>
                    </div>
                </div>
            `;
            this.logCount = 1;
        }
    }

    log(level, message, data = null) {
        const content = document.getElementById('debug-content');
        if (!content) return;

        // Prevent memory overflow
        if (this.logCount >= this.maxLogs) {
            this.clear();
        }

        const logLine = document.createElement('div');
        logLine.className = `debug-line ${level === 'error' ? 'api-error' : ''}`;

        const timestamp = this.getTimestamp();

        let logHTML = `
            <span class="debug-timestamp">[${timestamp}]</span>
            <span class="debug-level ${level}">${level.toUpperCase()}</span>
            <span class="debug-message">${this.escapeHtml(message)}</span>
        `;

        if (data) {
            logHTML += `<div class="debug-data">${this.formatData(data)}</div>`;
        }

        logLine.innerHTML = logHTML;
        content.appendChild(logLine);

        // Auto-scroll to bottom
        content.scrollTop = content.scrollHeight;

        this.logCount++;

        // Also log to browser console for development
        if (level === 'error') {
            console.error(`[CMDB] ${message}`, data);
        } else if (level === 'warning') {
            console.warn(`[CMDB] ${message}`, data);
        } else {
            console.log(`[CMDB] ${message}`, data);
        }
    }

    logAPI(method, url, status, timing, data = null) {
        const isError = status >= 400;
        const level = isError ? 'error' : 'success';
        const statusClass = isError ? 'debug-status-error' : 'debug-status-ok';

        const message = `${method} <span class="debug-url">${url}</span> - <span class="${statusClass}">${status}</span> <span class="debug-timing">(${timing}ms)</span>`;

        const logLine = document.createElement('div');
        logLine.className = `debug-line ${isError ? 'api-error' : 'api-response'}`;

        let logHTML = `
            <span class="debug-timestamp">[${this.getTimestamp()}]</span>
            <span class="debug-level ${level}">${level.toUpperCase()}</span>
            <span class="debug-message">${message}</span>
        `;

        if (data && (isError || this.shouldLogResponseData(url))) {
            logHTML += `<div class="debug-data">${this.formatData(data)}</div>`;
        }

        logLine.innerHTML = logHTML;

        const content = document.getElementById('debug-content');
        if (content) {
            content.appendChild(logLine);
            content.scrollTop = content.scrollHeight;
            this.logCount++;
        }
    }

    shouldLogResponseData(url) {
        // Log response data for specific endpoints we're debugging
        return url.includes('/impact-analysis/') ||
               url.includes('/graph-advantage-examples') ||
               url.includes('/query-comparison/');
    }

    interceptFetch() {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const startTime = Date.now();
            const [url, options = {}] = args;
            const method = options.method || 'GET';

            this.log('info', `API Call: ${method} ${url}`, {
                method,
                url: url.toString(),
                headers: options.headers
            });

            try {
                const response = await originalFetch(...args);
                const timing = Date.now() - startTime;

                // Clone response to read data without consuming it
                const responseClone = response.clone();
                let responseData = null;

                try {
                    // Try to read as JSON first
                    responseData = await responseClone.json();
                } catch (e) {
                    // If JSON parsing fails, try reading as text
                    // Need to clone again since the first clone was consumed by json() attempt
                    try {
                        const textClone = response.clone();
                        responseData = await textClone.text();
                    } catch (textError) {
                        // If both fail, just log the response status
                        responseData = { status: response.status, statusText: response.statusText };
                    }
                }

                this.logAPI(method, url, response.status, timing, responseData);

                return response;
            } catch (error) {
                const timing = Date.now() - startTime;
                this.logAPI(method, url, 0, timing, { error: error.message });
                throw error;
            }
        };
    }

    interceptErrors() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.log('error', `JavaScript Error: ${event.message}`, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.log('error', `Unhandled Promise Rejection: ${event.reason}`, {
                reason: event.reason,
                promise: event.promise
            });
        });
    }

    getTimestamp() {
        const now = new Date();
        return now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0');
    }

    formatData(data) {
        if (data === null || data === undefined) {
            return 'null';
        }

        if (typeof data === 'string') {
            return data;
        }

        try {
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return data.toString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods for application components to use
    info(message, data = null) {
        this.log('info', message, data);
    }

    success(message, data = null) {
        this.log('success', message, data);
    }

    warning(message, data = null) {
        this.log('warning', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    // Helper to track function execution
    trackFunction(funcName, func, ...args) {
        this.debug(`Executing function: ${funcName}`, { args });
        const startTime = Date.now();

        try {
            const result = func(...args);

            if (result instanceof Promise) {
                return result
                    .then(res => {
                        const timing = Date.now() - startTime;
                        this.success(`Function ${funcName} completed (${timing}ms)`, { result: res });
                        return res;
                    })
                    .catch(err => {
                        const timing = Date.now() - startTime;
                        this.error(`Function ${funcName} failed (${timing}ms)`, { error: err.message });
                        throw err;
                    });
            } else {
                const timing = Date.now() - startTime;
                this.success(`Function ${funcName} completed (${timing}ms)`, { result });
                return result;
            }
        } catch (error) {
            const timing = Date.now() - startTime;
            this.error(`Function ${funcName} failed (${timing}ms)`, { error: error.message });
            throw error;
        }
    }
}

// Initialize global debug logger
try {
    window.debugLogger = new DebugLogger();

    // Expose convenient global functions
    window.logDebug = (message, data) => window.debugLogger?.debug(message, data);
    window.logInfo = (message, data) => window.debugLogger?.info(message, data);
    window.logSuccess = (message, data) => window.debugLogger?.success(message, data);
    window.logWarning = (message, data) => window.debugLogger?.warning(message, data);
    window.logError = (message, data) => window.debugLogger?.error(message, data);
} catch (error) {
    console.error('Failed to initialize global debug logger:', error);
    // Provide fallback functions
    window.logDebug = window.logInfo = window.logSuccess = window.logWarning = window.logError = () => {};
}

// Global error handler for uncaught JavaScript errors
window.addEventListener('error', (event) => {
    console.error('Global JavaScript error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});