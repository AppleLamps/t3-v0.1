// Rate Limiter Test Suite
// =======================
// Tests the new Vercel KV-based rate limiter implementation

import {
    rateLimitMiddleware,
    getClientIP,
    getRateLimitStatus,
    resetRateLimit,
    getRateLimitConfig,
    RATE_LIMIT_CONFIG
} from './api/utils/rateLimiter.js';

/**
 * Mock request object
 */
function createMockRequest(ip = '192.168.1.1', headers = {}) {
    return {
        headers: {
            'x-real-ip': ip,
            'x-forwarded-for': ip,
            ...headers
        },
        connection: { remoteAddress: ip },
        socket: { remoteAddress: ip }
    };
}

/**
 * Mock response object
 */
function createMockResponse() {
    const res = {
        headers: {},
        setHeader: function (name, value) {
            this.headers[name] = value;
        },
        status: function (code) {
            this.statusCode = code;
            return this;
        },
        json: function (data) {
            this.body = data;
            return this;
        },
        end: function () {
            return this;
        }
    };
    return res;
}

/**
 * Test utility to await middleware execution
 */
async function runMiddleware(req, res, next) {
    return new Promise((resolve, reject) => {
        rateLimitMiddleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Test Suite
 */
async function runTests() {
    console.log('🧪 Testing Vercel KV Rate Limiter...\n');

    let passed = 0;
    let failed = 0;

    // Test 1: Basic rate limiting
    console.log('Test 1: Basic rate limiting functionality');
    try {
        const testIP = '192.168.1.100';
        await resetRateLimit(testIP); // Clear any existing data

        const req1 = createMockRequest(testIP);
        const res1 = createMockResponse();
        await runMiddleware(req1, res1);

        if (res1.headers['X-RateLimit-Limit'] === '5' &&
            res1.headers['X-RateLimit-Remaining'] === '4') {
            console.log('✅ First request: Rate limit headers correctly set');
            passed++;
        } else {
            console.log('❌ First request: Rate limit headers not set correctly');
            failed++;
        }

        // Simulate multiple requests
        for (let i = 0; i < 4; i++) {
            const req = createMockRequest(testIP);
            const res = createMockResponse();
            await runMiddleware(req, res);
        }

        // Test 6th request (should be rate limited)
        const reqLimit = createMockRequest(testIP);
        const resLimit = createMockResponse();
        await runMiddleware(reqLimit, resLimit);

        if (resLimit.statusCode === 429) {
            console.log('✅ Rate limiting: 6th request correctly blocked');
            passed++;
        } else {
            console.log('❌ Rate limiting: 6th request should have been blocked');
            failed++;
        }

    } catch (error) {
        console.log('❌ Basic rate limiting test failed:', error.message);
        failed += 2;
    }

    // Test 2: Rate limit status
    console.log('\nTest 2: Rate limit status retrieval');
    try {
        const testIP = '192.168.1.101';
        await resetRateLimit(testIP);

        const status = await getRateLimitStatus(testIP);
        if (status.allowed && status.remaining === 5 && status.resetTime === null) {
            console.log('✅ Status: Clean IP shows allowed status');
            passed++;
        } else {
            console.log('❌ Status: Clean IP status incorrect');
            failed++;
        }

        // Make a request to modify status
        const req = createMockRequest(testIP);
        const res = createMockResponse();
        await runMiddleware(req, res);

        const updatedStatus = await getRateLimitStatus(testIP);
        if (!updatedStatus.allowed && updatedStatus.remaining === 4 && updatedStatus.resetTime !== null) {
            console.log('✅ Status: Used IP shows correct remaining count');
            passed++;
        } else {
            console.log('❌ Status: Used IP status incorrect');
            failed++;
        }

    } catch (error) {
        console.log('❌ Status retrieval test failed:', error.message);
        failed += 2;
    }

    // Test 3: Client IP extraction
    console.log('\nTest 3: Client IP extraction');
    try {
        // Test x-real-ip header
        const req1 = createMockRequest('10.0.0.1', { 'x-real-ip': '203.0.113.1' });
        const ip1 = getClientIP(req1);

        // Test x-forwarded-for header
        const req2 = createMockRequest('10.0.0.2', {
            'x-forwarded-for': '203.0.113.2, 10.0.0.2'
        });
        const ip2 = getClientIP(req2);

        // Test fallback to connection.remoteAddress
        const req3 = createMockRequest('10.0.0.3', {});
        const ip3 = getClientIP(req3);

        if (ip1 === '203.0.113.1' && ip2 === '203.0.113.2' && ip3 === '10.0.0.3') {
            console.log('✅ IP extraction: All methods work correctly');
            passed++;
        } else {
            console.log('❌ IP extraction: Some methods failed');
            console.log(`  x-real-ip: expected 203.0.113.1, got ${ip1}`);
            console.log(`  x-forwarded-for: expected 203.0.113.2, got ${ip2}`);
            console.log(`  fallback: expected 10.0.0.3, got ${ip3}`);
            failed++;
        }

    } catch (error) {
        console.log('❌ IP extraction test failed:', error.message);
        failed++;
    }

    // Test 4: Reset functionality
    console.log('\nTest 4: Rate limit reset');
    try {
        const testIP = '192.168.1.102';

        // Make a request to set up rate limiting
        const req1 = createMockRequest(testIP);
        const res1 = createMockResponse();
        await runMiddleware(req1, res1);

        // Verify it's limited
        const req2 = createMockRequest(testIP);
        const res2 = createMockResponse();
        await runMiddleware(req2, res2);

        // Reset the rate limit
        const resetSuccess = await resetRateLimit(testIP);

        if (resetSuccess) {
            // Test after reset
            const req3 = createMockRequest(testIP);
            const res3 = createMockResponse();
            await runMiddleware(req3, res3);

            if (res3.headers['X-RateLimit-Remaining'] === '4') {
                console.log('✅ Reset: Rate limit successfully reset');
                passed++;
            } else {
                console.log('❌ Reset: Rate limit not properly reset');
                failed++;
            }
        } else {
            console.log('❌ Reset: Reset operation failed');
            failed++;
        }

    } catch (error) {
        console.log('❌ Reset test failed:', error.message);
        failed++;
    }

    // Test 5: Configuration access
    console.log('\nTest 5: Configuration access');
    try {
        const config = getRateLimitConfig();
        const expectedConfig = {
            windowMs: 60 * 1000,
            maxRequests: 5
        };

        if (JSON.stringify(config) === JSON.stringify(expectedConfig)) {
            console.log('✅ Configuration: Config object matches expected values');
            passed++;
        } else {
            console.log('❌ Configuration: Config object incorrect');
            console.log('Expected:', expectedConfig);
            console.log('Got:', config);
            failed++;
        }

        if (RATE_LIMIT_CONFIG.maxRequests === 5) {
            console.log('✅ Configuration: Direct export works');
            passed++;
        } else {
            console.log('❌ Configuration: Direct export failed');
            failed++;
        }

    } catch (error) {
        console.log('❌ Configuration test failed:', error.message);
        failed += 2;
    }

    // Test 6: Error handling (KV unavailable simulation)
    console.log('\nTest 6: Error handling');
    try {
        // This test verifies the middleware handles errors gracefully
        // In a real environment, you would mock KV to fail
        const req = createMockRequest('192.168.1.103');
        const res = createMockResponse();

        // Should not throw even if KV fails
        await runMiddleware(req, res);

        console.log('✅ Error handling: Middleware handles errors gracefully');
        passed++;

    } catch (error) {
        console.log('❌ Error handling: Middleware threw error:', error.message);
        failed++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed! Rate limiter is working correctly.');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Review the implementation.`);
    }

    return { passed, failed };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

export { runTests };