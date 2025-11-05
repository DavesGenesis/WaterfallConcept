// Advanced Configuration for Waterfall Concept Tool
// Enhanced security features to prevent credential sharing

const WaterfallConfig = {
    // Enhanced Authentication settings
    auth: {
        // Session timeout in milliseconds (8 hours - shorter for security)
        sessionTimeout: 8 * 60 * 60 * 1000,
        
        // Maximum concurrent sessions per user (1 = no sharing)
        maxConcurrentSessions: 1,
        
        // Device binding - user can only login from registered devices
        deviceBinding: true,
        
        // Maximum devices per user
        maxDevicesPerUser: 2,
        
        // Require device registration approval
        requireDeviceApproval: false,
        
        // Session monitoring interval (30 seconds)
        sessionMonitoringInterval: 30000,
        
        // Inactivity timeout (30 minutes)
        inactivityTimeout: 30 * 60 * 1000,
        
        // Geographic restrictions
        geoRestrictions: {
            enabled: false,
            allowedCountries: ['ID', 'SG', 'MY'], // Indonesia, Singapore, Malaysia
            blockVPN: true
        }
    },

    // Authorized users with enhanced security
    users: {
        'daves@genesisadv.id': {
            password: 'Genesis@5758',
            role: 'admin',
            name: 'Administrator',
            permissions: ['view', 'export', 'manage_users'],
            maxDevices: 3,
            allowedCountries: ['ID', 'SG'],
            sessionTimeout: 12 * 60 * 60 * 1000 // 12 hours for admin
        },
        'manager@company.com': {
            password: 'Manager2024!Safe',
            role: 'manager', 
            name: 'Manager',
            permissions: ['view', 'export'],
            maxDevices: 2,
            allowedCountries: ['ID'],
            sessionTimeout: 8 * 60 * 60 * 1000 // 8 hours
        },
        'ferry1112@gmail.com': {
            password: 'Ferry@Gmail2025',
            role: 'user',
            name: 'User One',
            permissions: ['view'],
            maxDevices: 1, // Only 1 device allowed
            allowedCountries: ['ID'],
            sessionTimeout: 1 * 60 * 60 * 1000 // 4 hours
        },
        'user2@company.com': {
            password: 'Legacy2024!Secure',
            role: 'user',
            name: 'User Two', 
            permissions: ['view'],
            maxDevices: 1,
            allowedCountries: ['ID'],
            sessionTimeout: 1 * 60 * 60 * 1000
        }
    },

    // Security policies to prevent sharing
    security: {
        // Device fingerprinting
        deviceFingerprinting: {
            enabled: true,
            includeCanvas: true,
            includeWebGL: true,
            includeAudio: true,
            includeFonts: false // Can be slow
        },
        
        // Session security
        sessionSecurity: {
            // Encrypt session data
            encryptSessions: true,
            
            // Bind session to IP address (strict)
            bindToIP: false, // Can cause issues with dynamic IPs
            
            // Bind session to user agent
            bindToUserAgent: true,
            
            // Monitor for concurrent sessions
            detectConcurrentSessions: true,
            
            // Auto-logout on suspicious activity
            autoLogoutOnSuspicion: true
        },
        
        // Activity monitoring
        activityMonitoring: {
            // Track user interactions
            trackInteractions: true,
            
            // Monitor for unusual patterns
            detectUnusualPatterns: true,
            
            // Log all security events
            logSecurityEvents: true,
            
            // Alert on suspicious activity
            alertOnSuspiciousActivity: true
        },
        
        // Anti-sharing measures
        antiSharing: {
            // Maximum login attempts per hour per IP
            maxAttemptsPerHour: 5,
            
            // Block rapid successive logins
            blockRapidLogins: true,
            
            // Minimum time between logins (minutes)
            minTimeBetweenLogins: 5,
            
            // Detect password sharing patterns
            detectPasswordSharing: true,
            
            // Require periodic password confirmation
            requirePeriodicConfirmation: false
        },
        
        // Device management
        deviceManagement: {
            // Automatically register new devices
            autoRegisterDevices: true,
            
            // Require admin approval for new devices
            requireApproval: false,
            
            // Device expiration (days)
            deviceExpirationDays: 90,
            
            // Notify on new device login
            notifyNewDevice: true
        }
    },

    // Notification settings
    notifications: {
        // Email notifications (requires server-side implementation)
        email: {
            enabled: false,
            smtp: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: 'your-email@gmail.com',
                    pass: 'your-app-password'
                }
            }
        },
        
        // Browser notifications
        browser: {
            enabled: true,
            requestPermission: true
        }
    },

    // Logging and monitoring
    logging: {
        // Log levels: 'error', 'warn', 'info', 'debug'
        level: 'info',
        
        // Store logs locally (limited storage)
        storeLocally: true,
        
        // Maximum log entries to keep
        maxLogEntries: 1000,
        
        // Send logs to server (requires server-side)
        sendToServer: false,
        
        // Server endpoint for logs
        serverEndpoint: '/api/logs'
    },

    // Application settings
    app: {
        title: 'Legacy Multiplier: Waterfall Concept',
        version: '5b(P)',
        company: 'by Daves',
        supportEmail: 'Daves@genesisadv.id',
        
        // Feature flags
        features: {
            exportData: true,
            advancedCalculations: true,
            userManagement: false, // Disable for security
            sessionHistory: true,
            deviceManagement: true
        }
    }
};

// Security utilities
const SecurityUtils = {
    // Generate secure random string
    generateSecureToken: (length = 32) => {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    // Hash string using SHA-256
    hashString: async (str) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },
    
    // Encrypt data (simple XOR - for demo purposes)
    encrypt: (data, key) => {
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result);
    },
    
    // Decrypt data
    decrypt: (encryptedData, key) => {
        const data = atob(encryptedData);
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    },
    
    // Log security event
    logSecurityEvent: (event, details) => {
        if (!WaterfallConfig.logging.storeLocally) return;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: event,
            details: details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        const logs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
        logs.push(logEntry);
        
        // Keep only recent logs
        if (logs.length > WaterfallConfig.logging.maxLogEntries) {
            logs.splice(0, logs.length - WaterfallConfig.logging.maxLogEntries);
        }
        
        localStorage.setItem('securityLogs', JSON.stringify(logs));
        
        // Console log for debugging
        console.log(`Security Event: ${event}`, details);
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WaterfallConfig, SecurityUtils };

}


