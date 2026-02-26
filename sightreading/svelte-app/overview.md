# **Sight-Reading App (Svelte Refactor)**

This directory contains the Svelte/Vite source code for the Sight-Reading application.

## **Directory Structure**

* package.json: Lists the npm dependencies (Svelte, Vite, etc.) and run scripts.  
* vite.config.js: Instructs Vite how to build the app. It's configured to bundle everything into a single file and output it to the parent directory (../index.html).  
* index.html: The Vite template entry point. It contains your meta tags, imports the ONNX script, and points to src/main.js.  
* src/main.js: The simple boilerplate that boots up the Svelte app.  
* src/logic.js: **The Brain.** This file contains all the global state (Stores), the music generation math, the note pools, and the microphone/ONNX audio worklet logic. Search here for anything related to how the game *works*.  
* src/App.svelte: **The Body.** This contains the main layout, the SVG staff, the Stats overlay, and the Log overlay. By using Svelte, the SVG staff is now *declarative*, meaning we don't manually draw lines with JS anymore; the HTML just reacts to the state in logic.js.  
* src/Settings.svelte: **The Settings Panel.** Separated purely because settings panels are huge and clutter up the main view. It binds directly to the settings state.

## **How to Build**

1. Open your terminal in this sightreading/svelte-app/ directory.  
2. Run npm install (you only need to do this once).  
3. Run npm run dev if you want a live-reloading local server to test changes.  
4. Run npm run build when you are ready to publish. This will compile everything and overwrite the index.html in the parent sightreading/ folder.