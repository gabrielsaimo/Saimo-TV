
import fetch from 'node-fetch';

const targetUrl = 'http://camelo.vip:80/series/bru777322/Online99999/14065.mp4';

const scenarios = [
    {
        name: 'No Headers',
        headers: {}
    },
    {
        name: 'User-Agent Only',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        }
    },
    {
        name: 'With Referer/Origin (Clean)',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': 'http://camelo.vip/',
            'Origin': 'http://camelo.vip'
        }
    },
    {
        name: 'With Referer/Origin (With Port)',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': 'http://camelo.vip:80/',
            'Origin': 'http://camelo.vip:80'
        }
    },
    {
        name: 'VLC User-Agent',
        headers: {
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18'
        }
    }
];

async function runTests() {
    console.log(`Testing URL: ${targetUrl}\n`);

    for (const scenario of scenarios) {
        console.log(`--- Testing Scenario: ${scenario.name} ---`);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: scenario.headers,
                signal: controller.signal
            });
            clearTimeout(timeout);

            console.log(`Status: ${res.status} ${res.statusText}`);
            if (res.status === 200 || res.status === 206) {
                console.log('✅ SUCCESS');
            } else {
                console.log('❌ FAILED');
            }
        } catch (e) {
            console.log('❌ ERROR:', e.message);
        }
        console.log('');
    }
}

runTests();
