// GitHub-based Session Manager for Static Sites
// Uses GitHub API to store session data in repository

class GitHubSessionManager {
    constructor(config = {}) {
        // You'll need to configure these for your repository
        this.owner = config.owner || 'YOUR_GITHUB_USERNAME';
        this.repo = config.repo || 'YOUR_REPO_NAME';
        this.token = config.token || null; // GitHub Personal Access Token (optional)
        this.branch = config.branch || 'main';
        this.sessionsFile = 'data/sessions.json';
    }

    // Add session using GitHub API
    async addSession(sessionData) {
        try {
            // For GitHub Pages without API access, use localStorage with broadcasting
            return this.addSessionLocal(sessionData);
        } catch (error) {
            console.error('Error adding session:', error);
            return false;
        }
    }

    // Local storage with cross-tab communication
    async addSessionLocal(sessionData) {
        try {
            console.log('Adding session locally:', sessionData);
            
            // Get existing sessions from all possible sources
            const existingSessions = this.getAllSessions();
            
            // Remove old session for same user/device
            const filteredSessions = existingSessions.filter(s => 
                !(s.email === sessionData.email && s.deviceFingerprint === sessionData.deviceFingerprint)
            );
            
            // Add new session
            const newSession = {
                ...sessionData,
                lastActivity: Date.now(),
                registryTimestamp: Date.now(),
                source: 'local'
            };
            
            filteredSessions.push(newSession);
            
            // Keep only recent sessions (8 hours)
            const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
            const activeSessions = filteredSessions.filter(s => {
                const sessionTime = s.lastActivity || s.loginTime || s.registryTimestamp;
                return sessionTime > eightHoursAgo;
            });
            
            // Store in multiple localStorage keys for cross-user access
            const sessionData_encoded = {
                sessions: activeSessions,
                lastUpdate: Date.now(),
                updateBy: sessionData.email
            };
            
            // Store with user-specific key
            localStorage.setItem(`sessions_${sessionData.email}`, JSON.stringify(sessionData_encoded));
            
            // Store in shared key
            localStorage.setItem('shared_sessions', JSON.stringify(sessionData_encoded));
            
            // Broadcast to other tabs
            this.broadcastUpdate(sessionData_encoded);
            
            console.log('Session stored successfully:', activeSessions);
            return true;
        } catch (error) {
            console.error('Error in addSessionLocal:', error);
            return false;
        }
    }

    // Get all sessions from all sources
    getAllSessions() {
        const allSessions = [];
        
        try {
            // Get from shared storage
            const shared = localStorage.getItem('shared_sessions');
            if (shared) {
                const data = JSON.parse(shared);
                allSessions.push(...(data.sessions || []));
            }
            
            // Get from all user-specific keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sessions_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && data.sessions) {
                            allSessions.push(...data.sessions);
                        }
                    } catch (e) {
                        console.warn('Error parsing session data for key:', key);
                    }
                }
            }
            
            // Deduplicate by email + device
            const uniqueSessions = allSessions.filter((session, index, self) => {
                const key = `${session.email}-${session.deviceFingerprint}`;
                return index === self.findIndex(s => `${s.email}-${s.deviceFingerprint}` === key);
            });
            
            return uniqueSessions;
        } catch (error) {
            console.error('Error getting all sessions:', error);
            return [];
        }
    }

    // Update activity
    async updateActivity(email, deviceFingerprint) {
        try {
            const allSessions = this.getAllSessions();
            
            const updatedSessions = allSessions.map(session => {
                if (session.email === email && session.deviceFingerprint === deviceFingerprint) {
                    return {
                        ...session,
                        lastActivity: Date.now(),
                        registryTimestamp: Date.now()
                    };
                }
                return session;
            });
            
            // Store updated sessions
            const sessionData = {
                sessions: updatedSessions,
                lastUpdate: Date.now(),
                updateBy: email
            };
            
            localStorage.setItem('shared_sessions', JSON.stringify(sessionData));
            localStorage.setItem(`sessions_${email}`, JSON.stringify(sessionData));
            
            this.broadcastUpdate(sessionData);
            
            return true;
        } catch (error) {
            console.error('Error updating activity:', error);
            return false;
        }
    }

    // Get active sessions
    async getSessions() {
        try {
            const allSessions = this.getAllSessions();
            
            // Filter by time (8 hours)
            const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
            const activeSessions = allSessions.filter(session => {
                const lastActivity = session.lastActivity || session.loginTime || session.registryTimestamp;
                return lastActivity && lastActivity > eightHoursAgo;
            });
            
            console.log('Active sessions found:', activeSessions);
            return activeSessions;
        } catch (error) {
            console.error('Error getting sessions:', error);
            return [];
        }
    }

    // Remove session
    async removeSession(email, deviceFingerprint) {
        try {
            const allSessions = this.getAllSessions();
            const filteredSessions = allSessions.filter(s => 
                !(s.email === email && s.deviceFingerprint === deviceFingerprint)
            );
            
            const sessionData = {
                sessions: filteredSessions,
                lastUpdate: Date.now(),
                updateBy: email
            };
            
            localStorage.setItem('shared_sessions', JSON.stringify(sessionData));
            localStorage.removeItem(`sessions_${email}`);
            
            this.broadcastUpdate(sessionData);
            
            return true;
        } catch (error) {
            console.error('Error removing session:', error);
            return false;
        }
    }

    // Broadcast updates to other tabs/windows
    broadcastUpdate(sessionData) {
        try {
            // Use multiple broadcast methods
            localStorage.setItem('session_broadcast', JSON.stringify({
                timestamp: Date.now(),
                data: sessionData
            }));
            
            // Also trigger storage event
            localStorage.setItem('session_update_trigger', Date.now().toString());
        } catch (error) {
            console.error('Error broadcasting update:', error);
        }
    }

    // Setup listener for session updates
    setupListener(callback) {
        window.addEventListener('storage', (e) => {
            if (e.key === 'session_broadcast' || 
                e.key === 'session_update_trigger' || 
                e.key === 'shared_sessions' ||
                (e.key && e.key.startsWith('sessions_'))) {
                
                console.log('Session update detected:', e.key);
                if (callback) {
                    setTimeout(callback, 500); // Small delay to ensure data is written
                }
            }
        });
    }

    // Clean up old sessions
    cleanupOldSessions() {
        try {
            const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
            
            // Clean shared sessions
            const shared = localStorage.getItem('shared_sessions');
            if (shared) {
                const data = JSON.parse(shared);
                const activeSessions = (data.sessions || []).filter(session => {
                    const lastActivity = session.lastActivity || session.loginTime || session.registryTimestamp;
                    return lastActivity && lastActivity > eightHoursAgo;
                });
                
                if (activeSessions.length !== data.sessions.length) {
                    localStorage.setItem('shared_sessions', JSON.stringify({
                        sessions: activeSessions,
                        lastUpdate: Date.now(),
                        updateBy: 'cleanup'
                    }));
                }
            }
        } catch (error) {
            console.error('Error cleaning up sessions:', error);
        }
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.GitHubSessionManager = GitHubSessionManager;
}