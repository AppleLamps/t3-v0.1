// Security Testing Script
// =======================
// Tests rate limiting and cookie-based authentication

const testRateLimiting = async () => {
    console.log('🧪 Testing Rate Limiting...');

    const testEndpoint = '/api/auth';
    const testData = {
        action: 'login',
        email: 'test@example.com',
        password: 'wrongpassword'
    };

    // Test 1: Normal request should work
    console.log('\n1. Testing normal request...');
    try {
        const response = await fetch(testEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(testData)
        });

        console.log(`   Status: ${response.status}`);
        console.log(`   Rate Limit Headers:`, {
            limit: response.headers.get('X-RateLimit-Limit'),
            remaining: response.headers.get('X-RateLimit-Remaining'),
            reset: response.headers.get('X-RateLimit-Reset')
        });
    } catch (error) {
        console.log('   Error:', error.message);
    }

    // Test 2: Rapid requests to trigger rate limiting
    console.log('\n2. Testing rapid requests (should trigger rate limiting)...');
    for (let i = 0; i < 7; i++) {
        try {
            const response = await fetch(testEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(testData)
            });

            console.log(`   Request ${i + 1}: Status ${response.status}`);

            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                console.log(`   ✅ Rate limiting activated! Retry after: ${retryAfter} seconds`);
                break;
            }
        } catch (error) {
            console.log(`   Request ${i + 1} Error:`, error.message);
        }
    }
};

const testCookieAuthentication = async () => {
    console.log('\n🧪 Testing Cookie Authentication...');

    // Test signup (this will set cookies)
    console.log('\n1. Testing signup (should set cookies)...');
    try {
        const signupResponse = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'signup',
                email: 'testuser@example.com',
                password: 'testpass123',
                name: 'Test User'
            })
        });

        console.log(`   Signup Status: ${signupResponse.status}`);
        console.log('   Set-Cookie Headers:', signupResponse.headers.get('set-cookie'));

        if (signupResponse.ok) {
            const userData = await signupResponse.json();
            console.log('   User created:', userData.email);
        }
    } catch (error) {
        console.log('   Signup Error:', error.message);
    }

    // Test verification with cookies
    console.log('\n2. Testing token verification with cookies...');
    try {
        const verifyResponse = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'verify'
            })
        });

        console.log(`   Verify Status: ${verifyResponse.status}`);

        if (verifyResponse.ok) {
            const userData = await verifyResponse.json();
            console.log('   Verified user:', userData.user?.email);
        } else {
            console.log('   Verification failed - cookies may not be set');
        }
    } catch (error) {
        console.log('   Verify Error:', error.message);
    }

    // Test logout (should clear cookies)
    console.log('\n3. Testing logout (should clear cookies)...');
    try {
        const logoutResponse = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'logout'
            })
        });

        console.log(`   Logout Status: ${logoutResponse.status}`);
        console.log('   Cleared cookies:', logoutResponse.headers.get('set-cookie'));
    } catch (error) {
        console.log('   Logout Error:', error.message);
    }
};

// Run tests
const runSecurityTests = async () => {
    console.log('🔐 Running Security Tests\n');
    console.log('='.repeat(50));

    await testRateLimiting();
    await testCookieAuthentication();

    console.log('\n' + '='.repeat(50));
    console.log('✅ Security tests completed!');
};

// Check if this is being run in Node.js environment
if (typeof window === 'undefined') {
    // Node.js environment
    const fetch = require('node-fetch');
    runSecurityTests().catch(console.error);
} else {
    // Browser environment
    window.runSecurityTests = runSecurityTests;
    console.log('Security test functions loaded. Run runSecurityTests() in browser console.');
}

export { runSecurityTests, testRateLimiting, testCookieAuthentication };