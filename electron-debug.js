console.log("=== Electron Module Debug ===");
const electronModule = require("electron");
console.log("Type:", typeof electronModule);
console.log("Value:", electronModule);
console.log("Constructor:", electronModule ? electronModule.constructor : null);

if (electronModule && typeof electronModule === "object") {
  console.log("Keys:", Object.keys(electronModule).slice(0, 20));
  console.log("Has app?:", !!electronModule.app);

  if (electronModule.app) {
    const { app } = electronModule;
    app.whenReady().then(() => {
      console.log("✓ SUCCESS - Electron working!");
      app.quit();
    });
  } else {
    console.log("✗ FAILED - No app property");
    process.exit(1);
  }
} else {
  console.log("✗ FAILED - electron is:", electronModule);
  console.log("This means electron module resolution is broken");
  process.exit(1);
}
