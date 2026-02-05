console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);

// Try to clear the cache and require again
const electronPath = require.resolve('electron');
console.log('electron path from require.resolve:', electronPath);
delete require.cache[electronPath];

// Try requiring with absolute path
try {
  const { app } = require('electron');
  console.log('app after delete cache:', app);
} catch (e) {
  console.error('Error:', e.message);
}

// Check if there's an electron binding
if (process.electronBinding) {
  console.log('electron binding exists');
}

// Try using process.mainModule
console.log('Main module:', process.mainModule);
