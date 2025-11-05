// Broadcast Session Tracker - Simple cross-browser session detection
// Uses multiple localStorage keys and broadcasting to detect active users

class BroadcastSessionTracker {
    constructor() {
        this.broadcastInterval = 10000; // 10 seconds
        this.sessionTimeout = 5 * 60 * 1000; // 5 minutes (shorter for testing)
        this.currentSession = null;
        this.isBroadcasting = false;
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
            userAgent: navigator.userAgent.substring(0, 100)
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

    // Start broadcasting this session
    startBroadcasting() {
        if (this.isBroadcasting) return;
        
        this.isBroadcasting = true;
        
        const broadcast = () => {
            if (!this.currentSession) {
                this.isBroadcasting = false;
                return;
            }

            // Update last seen
            this.currentSession.lastSeen = Date.now();
            
            // Broadcast to multiple keys for redundancy
            const sessionKey = `broadcast_${this.currentSession.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const timestampKey = `timestamp_${this.currentSession.id}`;
            
            try {
                // Store session data
                localStorage.setItem(sessionKey, JSON.stringify(this.currentSession));
                localStorage.setItem(timestampKey, this.currentSession.lastSeen.toString());
                
                // Update master session list
                this.updateMasterSessionList();
                
                // Trigger broadcast event
                localStorage.setItem('sessionBroadcast', JSON.stringify({
                    action: 'update',
                    sessionId: this.currentSession.id,
                    email: this.currentSession.email,
                    timestamp: Date.now()
                }));
                
                console.log('📡 Broadcasting session:', this.currentSession.email);
                
            } catch (error) {
                console.error('Error broadcasting session:', error);
            }
            
            // Schedule next broadcast
            setTimeout(broadcast, this.broadcastInterval);
        };
        
        // Start broadcasting immediately
        broadcast();
    }

    // Update master session list
    updateMasterSessionList() {
        try {
            const allSessions = this.scanAllSessions();
            
            const masterList = {
                sessions: allSessions,
                lastUpdate: Date.now(),
                totalSessions: allSessions.length
            };
            
            localStorage.setItem('masterSessionList', JSON.stringify(masterList));
            
            console.log(`📊 Master list updated: ${allSessions.length} active sessions`);
            
        } catch (error) {
            console.error('Error updating master session list:', error);
        }
    }

    // Scan for all active sessions
    scanAllSessions() {
        const sessions = [];
        const now = Date.now();
        
        try {
            // Scan all localStorage keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                if (key && key.startsWith('broadcast_')) {
                    try {
                        const sessionData = localStorage.getItem(key);
                        if (sessionData) {
                            const session = JSON.parse(sessionData);
                            
                            // Check if session is still active
                            if (session.lastSeen && (now - session.lastSeen) < this.sessionTimeout) {
                                sessions.push(session);
                            } else {
                                // Remove expired session
                                localStorage.removeItem(key);
                                console.log('🗑️ Removed expired session:', session.email);
                            }
                        }
                    } catch (e) {
                        console.warn('Error parsing session data for key:', key);
                        localStorage.removeItem(key); // Remove corrupted data
                    }
                }
            }
            
            // Remove duplicates (same email)
            const uniqueSessions = sessions.filter((session, index, self) => 
                index === self.findIndex(s => s.email === session.email)
            );
            
            return uniqueSessions;
            
        } catch (error) {
            console.error('Error scanning sessions:', error);
            return [];
        }
    }

    // Get all active sessions (for admin dashboard)
    getAllActiveSessions() {
        try {
            // First try to get from master list
            const masterList = localStorage.getItem('masterSessionList');
            if (masterList) {
                const data = JSON.parse(masterList);
                if (data.sessions && Array.isArray(data.sessions)) {
                    console.log('📋 Retrieved from master list:', data.sessions.length, 'sessions');
                    return data.sessions;
                }
            }
            
            // Fallback: scan directly
            const sessions = this.scanAllSessions();
            console.log('🔍 Scanned directly:', sessions.length, 'sessions');
            return sessions;
            
        } catch (error) {
            console.error('Error getting active sessions:', error);
            return [];
        }
    }

    // Stop session (for logout)
    stopSession() {
        if (!this.currentSession) return;
        
        try {
            const sessionKey = `broadcast_${this.currentSession.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const timestampKey = `timestamp_${this.currentSession.id}`;
            
            // Remove session data
            localStorage.removeItem(sessionKey);
            localStorage.removeItem(timestampKey);
            
            // Broadcast logout
            localStorage.setItem('sessionBroadcast', JSON.stringify({
                action: 'logout',
                sessionId: this.currentSession.id,
                email: this.currentSession.email,
                timestamp: Date.now()
            }));
            
            console.log('🛑 Session stopped for:', this.currentSession.email);
            
            // Update master list
            this.updateMasterSessionList();
            
            this.currentSession = null;
            this.isBroadcasting = false;
            
        } catch (error) {
            console.error('Error stopping session:', error);
        }
    }

    // Setup listener for session updates (for admin dashboard)
    setupListener(callback) {
        // Listen for localStorage changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'sessionBroadcast' || 
                e.key === 'masterSessionList' ||
                (e.key && e.key.startsWith('broadcast_'))) {
                
                console.log('📻 Session update detected:', e.key);
                
                if (callback) {
                    setTimeout(callback, 1000);
                }
            }
        });

        // Also poll periodically
        setInterval(() => {
            if (callback) {
                console.log('🔄 Periodic session check');
                callback();
            }
        }, 15000); // Every 15 seconds
    }

    // Force refresh of session data
    forceRefresh() {
        console.log('🔄 Force refreshing session data...');
        
        // Clean up expired sessions
        this.cleanupExpiredSessions();
        
        // Update master list
        this.updateMasterSessionList();
        
        // Get fresh session count
        const sessions = this.getAllActiveSessions();
        console.log('✅ Force refresh complete:', sessions.length, 'active sessions');
        
        return sessions;
    }

    // Clean up expired sessions
    cleanupExpiredSessions() {
        const now = Date.now();
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key && (key.startsWith('broadcast_') || key.startsWith('timestamp_'))) {
                try {
                    if (key.startsWith('broadcast_')) {
                        const sessionData = localStorage.getItem(key);
                        if (sessionData) {
                            const session = JSON.parse(sessionData);
                            if (!session.lastSeen || (now - session.lastSeen) > this.sessionTimeout) {
                                keysToRemove.push(key);
                            }
                        }
                    } else if (key.startsWith('timestamp_')) {
                        const timestamp = parseInt(localStorage.getItem(key));
                        if (!timestamp || (now - timestamp) > this.sessionTimeout) {
                            keysToRemove.push(key);
                        }
                    }
                } catch (e) {
                    keysToRemove.push(key);
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('🗑️ Cleaned up expired key:', key);
        });
        
        return keysToRemove.length;
    }

    // Get debug information
    getDebugInfo() {
        const sessions = this.getAllActiveSessions();
        const masterList = localStorage.getItem('masterSessionList');
        
        return {
            activeSessions: sessions,
            sessionCount: sessions.length,
            masterList: masterList ? JSON.parse(masterList) : null,
            currentSession: this.currentSession,
            isBroadcasting: this.isBroadcasting,
            localStorageKeys: this.getSessionKeys()
        };
    }

    // Get all session-related localStorage keys
    getSessionKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('broadcast_') || 
                       key.startsWith('timestamp_') || 
                       key === 'masterSessionList' ||
                       key === 'sessionBroadcast')) {
                keys.push(key);
            }
        }
        return keys;
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.BroadcastSessionTracker = BroadcastSessionTracker;
}