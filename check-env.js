console.log("Process info:");
console.log("- process.type:", process.type);
console.log("- process.versions.electron:", process.versions.electron);
console.log("- process.versions.chrome:", process.versions.chrome);
console.log("- process.execPath:", process.execPath);
console.log("- __dirname:", __dirname);
console.log("- process.resourcesPath:", process.resourcesPath);

// Check if we're actually in Electron
if (process.versions.electron) {
  console.log("\n✓ Running inside Electron");

  // Try to access Electron's internals
  try {
    const binding = process.electronBinding;
    console.log("- electronBinding exists:", !!binding);
  } catch (e) {
    console.log("- electronBinding error:", e.message);
  }

  // Check module paths
  console.log("\n- Module paths:", require.main.paths.slice(0, 5));

  // Try to manually load electron
  console.log("\n- Manually checking require('electron'):", typeof require('electron'));
} else {
  console.log("\n✗ NOT running inside Electron");
}

setTimeout(() => process.exit(0), 1000);
