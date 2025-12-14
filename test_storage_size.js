// Check what's in sessionStorage for dashboard
const keys = Object.keys(sessionStorage).filter(k => k.startsWith('dashboard_'));

console.log('Dashboard keys in sessionStorage:');
keys.forEach(key => {
    const value = sessionStorage.getItem(key);
    const sizeKB = (value?.length || 0) / 1024;
    console.log(`${key}: ${sizeKB.toFixed(2)} KB`);
});

const totalSize = keys.reduce((sum, key) => {
    return sum + (sessionStorage.getItem(key)?.length || 0);
}, 0);

console.log(`\nTotal size: ${(totalSize / 1024).toFixed(2)} KB`);
console.log(`Storage limit: ~5-10 MB`);

// Check acessos specifically
const acessosData = sessionStorage.getItem('dashboard_acessos');
if (acessosData) {
    try {
        const parsed = JSON.parse(acessosData);
        console.log(`\nAcessos: ${parsed.length} records, ${(acessosData.length / 1024).toFixed(2)} KB`);
    } catch (e) {
        console.log('Error parsing acessos:', e.message);
    }
} else {
    console.log('\nNo acessos in sessionStorage');
}
