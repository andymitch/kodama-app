<script lang="ts">
  import Dashboard from './pages/Dashboard.svelte';
  import Settings from './pages/Settings.svelte';

  let hash = $state(window.location.hash || '#/');

  function onHashChange() {
    hash = window.location.hash || '#/';
  }

  $effect(() => {
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  let page = $derived(hash === '#/settings' ? 'settings' : 'dashboard');
</script>

<div class="flex min-h-screen flex-col">
  <header class="border-b border-border bg-card px-6 py-3">
    <nav class="mx-auto flex max-w-6xl items-center justify-between">
      <a href="#/" class="text-xl font-semibold text-primary">Kodama</a>
      <div class="flex gap-6">
        <a href="#/" class="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Dashboard
        </a>
        <a href="#/settings" class="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Settings
        </a>
      </div>
    </nav>
  </header>

  <main class="mx-auto w-full max-w-6xl flex-1 p-6">
    {#if page === 'settings'}
      <Settings />
    {:else}
      <Dashboard />
    {/if}
  </main>
</div>
