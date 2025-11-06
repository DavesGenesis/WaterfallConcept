// Firebase Configuration for Waterfall Concept Tool
// This enables real-time cross-browser session tracking

class FirebaseConfig {
    constructor() {
        this.initialized = false;
        this.db = null;
        this.app = null;
    }

    // Initialize Firebase with your project credentials
    async initialize() {
        if (this.initialized) return true;

        try {
            // Firebase project credentials from Firebase Console
            // Project: waterfall-concept-tool
            const firebaseConfig = {
                apiKey: "AIzaSyCMqm2Z8KqzLoIeJDw4Kc50l7y5Wxrail4",
                authDomain: "waterfall-concept-tool.firebaseapp.com",
                databaseURL: "https://waterfall-concept-tool-default-rtdb.firebaseio.com",
                projectId: "waterfall-concept-tool",
                storageBucket: "waterfall-concept-tool.firebasestorage.app",
                messagingSenderId: "43414908623",
                appId: "1:43414908623:web:6dbc7d9999cf64db0791ba"
            };

            // Check if Firebase is already initialized
            if (firebase.apps.length === 0) {
                this.app = firebase.initializeApp(firebaseConfig);
            } else {
                this.app = firebase.apps[0];
            }

            // Get database reference
            this.db = firebase.database();
            
            this.initialized = true;
            console.log('✅ Firebase initialized successfully');
            
            // Test connection
            await this.testConnection();
            
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            console.warn('⚠️ Falling back to localStorage mode');
            return false;
        }
    }

    // Test Firebase connection
    async testConnection() {
        try {
            const testRef = this.db.ref('_health_check');
            await testRef.set({
                status: 'connected',
                timestamp: Date.now()
            });
            console.log('✅ Firebase connection test passed');
        } catch (error) {
            console.warn('⚠️ Firebase connection test failed:', error);
        }
    }

    // Get database reference
    getDatabase() {
        return this.db;
    }

    // Check if Firebase is ready
    isReady() {
        return this.initialized && this.db !== null;
    }
}

// Singleton instance
const firebaseConfig = new FirebaseConfig();

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.FirebaseConfig = FirebaseConfig;
    window.firebaseConfig = firebaseConfig;
    
    // Initialize after page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            firebaseConfig.initialize();
        });
    } else {
        firebaseConfig.initialize();
    }
}