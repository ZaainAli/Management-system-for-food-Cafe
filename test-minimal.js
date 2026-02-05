console.log('Starting electron test...');
console.log('process.versions:', process.versions);
console.log('typeof require:', typeof require);

const electron = require('electron');
console.log('electron value:', electron);
console.log('typeof electron:', typeof electron);

if (electron && typeof electron === 'object') {
  const { app } = electron;
  console.log('app from electron object:', app);
} else {
  console.log('electron is not an object, it is:', typeof electron);
}
