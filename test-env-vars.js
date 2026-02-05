console.log("Environment variables:");
console.log("ELECTRON_RUN_AS_NODE:", process.env.ELECTRON_RUN_AS_NODE);
console.log("ELECTRON_NO_ATTACH_CONSOLE:", process.env.ELECTRON_NO_ATTACH_CONSOLE);
console.log("ELECTRON_ENABLE_LOGGING:", process.env.ELECTRON_ENABLE_LOGGING);

if (process.env.ELECTRON_RUN_AS_NODE) {
  console.log("\n⚠ ELECTRON_RUN_AS_NODE is set! This makes Electron run as plain Node.js");
}

setTimeout(() => process.exit(0), 500);
