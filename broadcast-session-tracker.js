// Firebase-Enabled Broadcast Session Tracker
// Real-time cross-browser session tracking using Firebase Realtime Database

class BroadcastSessionTracker {
    constructor() {
        this.broadcastInterval = 10000; // 10 seconds
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
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
        // ✅ PREVENT DUPLICATE SESSIONS
        if (this.currentSession && this.currentSession.email === userData.email) {
            console.log('⚠️ Session already exists for:', userData.email, '- skipping duplicate creation');
            return this.currentSession.id;
        }

        // ✅ STOP ANY EXISTING SESSION FIRST
        if (this.currentSession) {
            console.log('🔄 Stopping existing session before starting new one');
            // Use sync version for immediate cleanup when starting new session
            this.stopSessionSync();
        }

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

        // ✅ DEBUG: Verify session creation
        console.log('🚀 Starting session broadcast for:', this.currentSession.email, 'with ID:', this.currentSession.id);
        console.log('📋 Session object created:', JSON.stringify(this.currentSession, null, 2));
        console.log('🔍 Input userData:', JSON.stringify(userData, null, 2));
        
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
                    console.log('📡 Firebase: Session broadcasted to cloud for', this.currentSession.email);
                } catch (error) {
                    console.error('❌ Firebase: Broadcast failed:', error);
                    console.warn('⚠️ Falling back to localStorage');
                    this.broadcastToLocalStorage();
                }
            } else {
                // Fallback mode: Use localStorage
                console.log('💾 Using localStorage fallback (Firebase not enabled)');
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

    // Stop session tracking (async version for logout)
    async stopSession() {
        if (!this.currentSession) {
            // Show alert for debugging
            alert('⚠️ STOP SESSION FAILED:\n\nNo current session found!\nThis means the session was never started or already stopped.');
            return;
        }

        // ✅ FIX: Validate session properties before using them
        const sessionId = this.currentSession.id || 'MISSING_ID';
        const sessionEmail = this.currentSession.email || 'MISSING_EMAIL';
        const deviceFingerprint = this.currentSession.deviceFingerprint || 'MISSING_DEVICE';

        const sessionInfo = `🛑 STOPPING SESSION:\n\nEmail: ${sessionEmail}\nID: ${sessionId}\nFirebase: ${this.firebaseEnabled}`;
        
        // ✅ FIX: Only proceed with Firebase cleanup if we have a valid session ID
        if (this.firebaseEnabled && this.db && sessionId !== 'MISSING_ID') {
            // Firebase mode: Remove from cloud database
            try {
                const sessionRef = this.db.ref(`sessions/${sessionId}`);
                await sessionRef.remove();
                
                alert(sessionInfo + '\n\n✅ SUCCESS: Session removed from Firebase!');
            } catch (error) {
                alert(sessionInfo + '\n\n❌ ERROR: Firebase removal failed:\n' + error.message);
            }
        } else if (this.firebaseEnabled && sessionId === 'MISSING_ID') {
            alert(sessionInfo + '\n\n❌ ERROR: Cannot remove from Firebase - Session ID is missing!');
        } else {
            alert(sessionInfo + '\n\n⚠️ WARNING: Firebase not enabled - using localStorage only');
        }

        // Also remove from localStorage (with safety checks)
        try {
            if (sessionEmail !== 'MISSING_EMAIL' && deviceFingerprint !== 'MISSING_DEVICE') {
                const sessionKey = `session_${sessionEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${deviceFingerprint}`;
                localStorage.removeItem(sessionKey);
                alert('✅ LocalStorage cleanup completed');
            } else {
                alert('⚠️ WARNING: Cannot clean localStorage - missing email or device fingerprint');
            }
        } catch (error) {
            alert('❌ LocalStorage cleanup failed: ' + error.message);
        }

        this.currentSession = null;
        this.isBroadcasting = false;
    }

    // Stop session tracking (sync version for immediate cleanup)
    stopSessionSync() {
        if (!this.currentSession) return;

        console.log('🛑 Immediate session stop for:', this.currentSession.email, 'ID:', this.currentSession.id);

        if (this.firebaseEnabled && this.db) {
            // Firebase mode: Remove from cloud database (fire and forget)
            try {
                const sessionRef = this.db.ref(`sessions/${this.currentSession.id}`);
                sessionRef.remove(); // No await - immediate cleanup
                console.log('📡 Firebase: Session removal initiated');
            } catch (error) {
                console.warn('⚠️ Firebase: Session removal failed:', error);
            }
        }

        // Also remove from localStorage
        try {
            const sessionKey = `session_${this.currentSession.email.replace(/[^a-zA-Z0-9]/g, '_')}_${this.currentSession.deviceFingerprint}`;
            localStorage.removeItem(sessionKey);
            console.log('💾 LocalStorage: Session cleaned up');
        } catch (error) {
            console.warn('LocalStorage cleanup failed:', error);
        }

        this.currentSession = null;
        this.isBroadcasting = false;
        console.log('✅ Immediate session cleanup completed');
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

    // ✅ NEW: Verify session integrity
    verifySessionIntegrity() {
        if (!this.currentSession) {
            return {
                valid: false,
                error: 'No current session exists'
            };
        }

        const requiredFields = ['id', 'email', 'role', 'name'];
        const missingFields = [];
        const fieldTypes = {};

        requiredFields.forEach(field => {
            fieldTypes[field] = typeof this.currentSession[field];
            if (!this.currentSession[field]) {
                missingFields.push(field);
            }
        });

        return {
            valid: missingFields.length === 0,
            missingFields: missingFields,
            fieldTypes: fieldTypes,
            sessionKeys: Object.keys(this.currentSession),
            rawSession: JSON.stringify(this.currentSession, null, 2)
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