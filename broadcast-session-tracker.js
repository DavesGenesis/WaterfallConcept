// Firebase-Enabled Broadcast Session Tracker
// Real-time cross-browser session tracking using Firebase Realtime Database

class BroadcastSessionTracker {
    constructor() {
        this.broadcastInterval = 10000; // 10 seconds
        this.sessionTimeout = 5 * 60 * 1000; // 5 minutes
        this.currentSession = null;
        this.isBroadcasting = false;
        this.firebaseEnabled = false;
        this.db = null;
        
        // Initialize Firebase connection
        this.initializeFirebase();
    }

    // Initialize Firebase connection
    async initializeFirebase() {
        try {
            // Wait for Firebase config to be ready
            if (typeof firebaseConfig !== 'undefined') {
                await firebaseConfig.initialize();
                if (firebaseConfig.isReady()) {
                    this.db = firebaseConfig.getDatabase();
                    this.firebaseEnabled = true;
                    console.log('📡 Firebase: Session tracker connected to cloud database');
                } else {
                    console.warn('⚠️ Firebase: Not ready, using localStorage fallback');
                }
            } else {
                console.warn('⚠️ Firebase: Config not found, using localStorage fallback');
            }
        } catch (error) {
            console.warn('⚠️ Firebase: Connection failed, using localStorage fallback:', error);
        }
    }

    // Start session tracking
    startSession(userData) {
        this.currentSession = {
            id: this.generateSessionId(),
            email: userData.email,
            name: userData.name,
            role: userData.role,
            deviceFingerprint: userData.deviceFingerprint || 'unknown',
            location: userData.location || 'Unknown',
            loginTime: Date.now(),
            lastSeen: Date.now(),
            userAgent: navigator.userAgent.substring(0, 100),
            browser: this.getBrowserInfo(),
            ip: 'Hidden for privacy'
        };

        console.log('🚀 Starting session broadcast for:', this.currentSession.email);
        
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

//Start broadcasting this session
    startBroadcasting() {
        if (this.isBroadcasting) return;
        
        this.isBroadcasting = true;
        
        const broadcast = async () => {
            if (!this.currentSession) {
                this.isBroadcasting = false;
                return;
            }

            // Update last seen timestamp
            this.currentSession.lastSeen = Date.now();

            if (this.firebaseEnabled && this.db) {
                // Firebase mode: Store in cloud database
                try {
                    const sessionRef = this.db.ref(`sessions/${this.currentSession.id}`);
                    await sessionRef.set(this.currentSession);
                    console.log('📡 Firebase: Session broadcasted to cloud');
                } catch (error) {
                    console.warn('⚠️ Firebase: Broadcast failed, falling back to localStorage:', error);
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

    // Fallback: Broadcast to localStorage
    broadcastToLocalStorage() {
        try {
            // Store individual session
            const sessionKey = `session_${this.currentSession.email.replace(/[^a-zA-Z0-9]/g, '_')}_${this.currentSession.deviceFingerprint}`;
            localStorage.setItem(sessionKey, JSON.stringify(this.currentSession));
            
            // Update global session list
            this.updateLocalStorageSessionList();
            
            console.log('💾 LocalStorage: Session broadcasted locally');
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
   // Stop session tracking
    stopSession() {
        if (!this.currentSession) return;

        console.log('🛑 Stopping session broadcast for:', this.currentSession.email);

        if (this.firebaseEnabled && this.db) {
            // Firebase mode: Remove from cloud database
            try {
                const sessionRef = this.db.ref(`sessions/${this.currentSession.id}`);
                sessionRef.remove();
                console.log('📡 Firebase: Session removed from cloud');
            } catch (error) {
                console.warn('⚠️ Firebase: Session removal failed:', error);
            }
        }

        // Also remove from localStorage
        try {
            const sessionKey = `session_${this.currentSession.email.replace(/[^a-zA-Z0-9]/g, '_')}_${this.currentSession.deviceFingerprint}`;
            localStorage.removeItem(sessionKey);
        } catch (error) {
            console.warn('LocalStorage cleanup failed:', error);
        }

        this.currentSession = null;
        this.isBroadcasting = false;
    }

    // Get all active sessions (for admin dashboard)
    async getAllActiveSessions() {
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

                console.log(`📊 Firebase: Retrieved ${sessions.length} active sessions from cloud`);
                return sessions;
            } catch (error) {
                console.warn('⚠️ Firebase: Failed to get sessions, using localStorage:', error);
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
                console.log(`💾 LocalStorage: Retrieved ${sessions.length} active sessions locally`);
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
            this.currentSession.lastSeen = Date.now();
        }
    }

    // Get debug information
    getDebugInfo() {
        return {
            firebaseEnabled: this.firebaseEnabled,
            isBroadcasting: this.isBroadcasting,
            currentSession: this.currentSession ? {
                id: this.currentSession.id,
                email: this.currentSession.email,
                role: this.currentSession.role
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

// Auto-cleanup expired sessions every 2 minutes
if (typeof window !== 'undefined') {
    window.BroadcastSessionTracker = BroadcastSessionTracker;
    
    // Global cleanup interval
    setInterval(() => {
        if (window.sessionTracker && typeof window.sessionTracker.cleanupExpiredSessions === 'function') {
            window.sessionTracker.cleanupExpiredSessions();
        }
    }, 2 * 60 * 1000); // 2 minutes
}