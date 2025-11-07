// Firebase-Enabled Broadcast Session Tracker - FIXED VERSION
// Real-time cross-browser session tracking using Firebase Realtime Database

class BroadcastSessionTracker {
    constructor() {
        this.broadcastInterval = 10000; // 10 seconds
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes (CONSISTENT)
        this.currentSession = null;
        this.isBroadcasting = false;
        this.firebaseEnabled = false;
        this.db = null;
        
        console.log('🔧 BroadcastSessionTracker constructor called');
        
        // DON'T initialize Firebase here - let it initialize naturally
        // We'll check if it's ready when we need it
    }

    // Initialize Firebase connection (called when needed)
    async ensureFirebaseReady() {
        if (this.firebaseEnabled) {
            return true; // Already initialized
        }

        try {
            // Wait for firebaseConfig to be available
            if (typeof firebaseConfig === 'undefined') {
                console.warn('⚠️ Firebase: Config not found, using localStorage');
                return false;
            }

            // Wait up to 5 seconds for Firebase to initialize
            let attempts = 0;
            while (!firebaseConfig.isReady() && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            if (firebaseConfig.isReady()) {
                this.db = firebaseConfig.getDatabase();
                this.firebaseEnabled = true;
                console.log('✅ Firebase: Ready for session tracking');
                return true;
            } else {
                console.warn('⚠️ Firebase: Not ready after 5 seconds, using localStorage');
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Firebase: Initialization failed:', error);
            return false;
        }
    }

    // Start session tracking - FIXED VERSION
    async startSession(userData) {
        console.log('🚀 startSession called with:', userData.email);

        // ✅ FIX 1: Validate input data
        if (!userData || !userData.email) {
            console.error('❌ Cannot start session: Invalid user data');
            return null;
        }

        // ✅ FIX 2: Prevent duplicate sessions
        if (this.currentSession && this.currentSession.email === userData.email) {
            console.log('⚠️ Session already exists for:', userData.email);
            return this.currentSession.id;
        }

        // ✅ FIX 3: Stop any existing session first (synchronously)
        if (this.currentSession) {
            console.log('🔄 Stopping existing session before starting new one');
            await this.stopSession(); // Use async version to ensure cleanup
        }

        // ✅ FIX 4: Ensure Firebase is ready BEFORE creating session
        await this.ensureFirebaseReady();

        // Create session object
        this.currentSession = {
            id: this.generateSessionId(),
            email: userData.email,
            name: userData.name,
            role: userData.role,
            deviceFingerprint: userData.deviceFingerprint || 'unknown',
            deviceName: userData.deviceName || 'Unknown Device',
            location: userData.location || 'Unknown',
            loginTime: Date.now(),
            lastSeen: Date.now(),
            userAgent: navigator.userAgent.substring(0, 100),
            browser: this.getBrowserInfo()
        };

        console.log('✅ Session object created:', {
            id: this.currentSession.id,
            email: this.currentSession.email,
            firebaseEnabled: this.firebaseEnabled
        });
        
        // Start broadcasting immediately
        this.startBroadcasting();
        
        return this.currentSession.id;
    }

    // Generate unique session ID
    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Get browser information
    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    // Start broadcasting this session
    startBroadcasting() {
        if (this.isBroadcasting) {
            console.log('⚠️ Already broadcasting, skipping');
            return;
        }
        
        this.isBroadcasting = true;
        console.log('📡 Starting broadcast loop');
        
        const broadcast = async () => {
            if (!this.currentSession) {
                console.log('⏹️ No session, stopping broadcast');
                this.isBroadcasting = false;
                return;
            }

            // Update last seen timestamp
            this.currentSession.lastSeen = Date.now();

            // ✅ FIX 5: Validate session before broadcasting
            const integrity = this.verifySessionIntegrity();
            if (!integrity.valid) {
                console.error('❌ Session integrity check failed:', integrity.missingFields.join(', '));
                console.error('❌ Stopping broadcast due to corrupted session');
                this.isBroadcasting = false;
                return;
            }

            if (this.firebaseEnabled && this.db) {
                // Firebase mode: Store in cloud database
                try {
                    const sessionRef = this.db.ref(`sessions/${this.currentSession.id}`);
                    await sessionRef.set(this.currentSession);
                    console.log('📡 Firebase: Broadcasted', this.currentSession.email);
                } catch (error) {
                    console.error('❌ Firebase: Broadcast failed:', error);
                    this.broadcastToLocalStorage();
                }
            } else {
                // Fallback mode: Use localStorage
                this.broadcastToLocalStorage();
            }

            // Schedule next broadcast
            setTimeout(broadcast, this.broadcastInterval);
        };

        // Start broadcasting
        broadcast();
    }

    // ✅ NEW: Validate session integrity
    validateSession() {
        if (!this.currentSession) return false;

        const requiredFields = ['id', 'email', 'name', 'role'];
        for (const field of requiredFields) {
            if (!this.currentSession[field]) {
                console.error(`❌ Session validation failed: Missing ${field}`);
                return false;
            }
        }

        return true;
    }

    // ✅ NEW: Detailed session integrity verification (for debugging)
    verifySessionIntegrity() {
        const result = {
            valid: false,
            missingFields: [],
            fieldTypes: {},
            sessionKeys: [],
            rawSession: 'null'
        };

        if (!this.currentSession) {
            result.rawSession = 'Session is null or undefined';
            return result;
        }

        // Get session info
        result.sessionKeys = Object.keys(this.currentSession);
        result.rawSession = JSON.stringify(this.currentSession, null, 2);

        // Check required fields
        const requiredFields = ['id', 'email', 'name', 'role', 'deviceFingerprint', 'loginTime', 'lastSeen'];
        
        requiredFields.forEach(field => {
            if (this.currentSession[field] === undefined || this.currentSession[field] === null || this.currentSession[field] === '') {
                result.missingFields.push(field);
            } else {
                result.fieldTypes[field] = typeof this.currentSession[field];
            }
        });

        // Session is valid if no missing fields
        result.valid = result.missingFields.length === 0;

        return result;
    }

    // Fallback: Broadcast to localStorage
    broadcastToLocalStorage() {
        try {
            const sessionKey = `session_${this.currentSession.email.replace(/[^a-zA-Z0-9]/g, '_')}_${this.currentSession.deviceFingerprint}`;
            localStorage.setItem(sessionKey, JSON.stringify(this.currentSession));
            
            this.updateLocalStorageSessionList();
            
            console.log('💾 LocalStorage: Broadcasted');
        } catch (error) {
            console.error('❌ LocalStorage: Broadcast failed:', error);
        }
    }

    // Update localStorage session list
    updateLocalStorageSessionList() {
        try {
            const sessionKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('session_')) {
                    sessionKeys.push(key);
                }
            }

            const allSessions = [];
            sessionKeys.forEach(key => {
                try {
                    const session = JSON.parse(localStorage.getItem(key));
                    if (session && session.lastSeen) {
                        if (Date.now() - session.lastSeen < this.sessionTimeout) {
                            allSessions.push(session);
                        } else {
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) {
                    console.warn('Error parsing session:', key);
                }
            });

            localStorage.setItem('globalSessionList', JSON.stringify({
                sessions: allSessions,
                lastUpdate: Date.now()
            }));
        } catch (error) {
            console.error('Error updating localStorage session list:', error);
        }
    }

    // Stop session tracking - FIXED VERSION
    async stopSession() {
        console.log('🛑 stopSession called');

        if (!this.currentSession) {
            console.warn('⚠️ No current session to stop');
            return;
        }

        // ✅ FIX 6: Validate before cleanup
        const integrity = this.verifySessionIntegrity();
        if (!integrity.valid) {
            console.warn('⚠️ Session integrity check failed:', integrity.missingFields.join(', '));
            console.warn('⚠️ Forcing cleanup of corrupted session');
            // Force cleanup even if invalid
            this.currentSession = null;
            this.isBroadcasting = false;
            return;
        }

        const sessionId = this.currentSession.id;
        const sessionEmail = this.currentSession.email;
        const deviceFingerprint = this.currentSession.deviceFingerprint;

        console.log(`🛑 Stopping session: ${sessionEmail} (${sessionId})`);

        // Stop broadcasting first
        this.isBroadcasting = false;

        // Firebase cleanup
        if (this.firebaseEnabled && this.db && sessionId) {
            try {
                const sessionRef = this.db.ref(`sessions/${sessionId}`);
                await sessionRef.remove();
                console.log('✅ Firebase: Session removed');
            } catch (error) {
                console.error('❌ Firebase: Removal failed:', error);
            }
        }

        // localStorage cleanup
        try {
            if (sessionEmail && deviceFingerprint) {
                const sessionKey = `session_${sessionEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${deviceFingerprint}`;
                localStorage.removeItem(sessionKey);
                console.log('✅ LocalStorage: Cleaned up');
            }
        } catch (error) {
            console.error('❌ LocalStorage: Cleanup failed:', error);
        }

        // Clear current session
        this.currentSession = null;
        console.log('✅ Session stopped successfully');
    }

    // Get all active sessions (for admin dashboard)
    async getAllActiveSessions() {
        // Ensure Firebase is ready
        await this.ensureFirebaseReady();

        if (this.firebaseEnabled && this.db) {
            // Firebase mode: Get from cloud database
            try {
                const sessionsRef = this.db.ref('sessions');
                const snapshot = await sessionsRef.once('value');
                const sessionsData = snapshot.val() || {};
                
                const sessions = Object.values(sessionsData).filter(session => {
                    return session && session.lastSeen && 
                           (Date.now() - session.lastSeen < this.sessionTimeout);
                });

                console.log(`📊 Firebase: Retrieved ${sessions.length} active sessions`);
                return sessions;
            } catch (error) {
                console.warn('⚠️ Firebase: Failed to get sessions:', error);
                return this.getLocalStorageSessions();
            }
        } else {
            // Fallback mode: Use localStorage
            return this.getLocalStorageSessions();
        }
    }

    // Get sessions from localStorage (fallback)
    getLocalStorageSessions() {
        try {
            const globalList = localStorage.getItem('globalSessionList');
            if (globalList) {
                const data = JSON.parse(globalList);
                const sessions = (data.sessions || []).filter(session => {
                    return session && session.lastSeen && 
                           (Date.now() - session.lastSeen < this.sessionTimeout);
                });
                console.log(`💾 LocalStorage: Retrieved ${sessions.length} sessions`);
                return sessions;
            }
            return [];
        } catch (error) {
            console.error('Error getting localStorage sessions:', error);
            return [];
        }
    }

    // Update activity (keep session alive)
    updateActivity() {
        if (this.currentSession) {
            // ✅ Proactive integrity check before updating activity
            const integrity = this.verifySessionIntegrity();
            if (!integrity.valid) {
                console.warn('⚠️ Session corrupted during activity update:', integrity.missingFields.join(', '));
                console.warn('⚠️ Stopping corrupted session');
                this.stopSession();
                return;
            }
            
            this.currentSession.lastSeen = Date.now();
        }
    }

    // Get debug information
    getDebugInfo() {
        return {
            firebaseEnabled: this.firebaseEnabled,
            isBroadcasting: this.isBroadcasting,
            hasCurrentSession: !!this.currentSession,
            currentSession: this.currentSession ? {
                id: this.currentSession.id,
                email: this.currentSession.email,
                role: this.currentSession.role,
                age: this.currentSession.loginTime ? Math.floor((Date.now() - this.currentSession.loginTime) / 1000) + 's' : 'unknown'
            } : null,
            mode: this.firebaseEnabled ? 'Firebase (Cross-Browser)' : 'LocalStorage (Same Browser Only)'
        };
    }

    // Clean up expired sessions (maintenance)
    async cleanupExpiredSessions() {
        if (this.firebaseEnabled && this.db) {
            try {
                const sessionsRef = this.db.ref('sessions');
                const snapshot = await sessionsRef.once('value');
                const sessionsData = snapshot.val() || {};
                
                const now = Date.now();
                const expiredSessions = [];
                
                Object.entries(sessionsData).forEach(([sessionId, session]) => {
                    if (!session.lastSeen || (now - session.lastSeen > this.sessionTimeout)) {
                        expiredSessions.push(sessionId);
                    }
                });

                // Remove expired sessions
                for (const sessionId of expiredSessions) {
                    await this.db.ref(`sessions/${sessionId}`).remove();
                }

                if (expiredSessions.length > 0) {
                    console.log(`🧹 Firebase: Cleaned up ${expiredSessions.length} expired sessions`);
                }
            } catch (error) {
                console.warn('Firebase cleanup failed:', error);
            }
        }
    }
}

// Make globally available and setup auto-cleanup
if (typeof window !== 'undefined') {
    window.BroadcastSessionTracker = BroadcastSessionTracker;
    
    // Global cleanup interval
    setInterval(() => {
        if (window.sessionTracker && typeof window.sessionTracker.cleanupExpiredSessions === 'function') {
            window.sessionTracker.cleanupExpiredSessions();
        }
    }, 2 * 60 * 1000); // 2 minutes
}