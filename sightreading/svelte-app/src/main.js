import App from './App.svelte';

// This simply initializes the Svelte application and attaches it to the DOM.
const app = new App({
  target: document.getElementById('app')
});

export default app;
