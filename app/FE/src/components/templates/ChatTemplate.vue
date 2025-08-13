<template>
  <section class="container">
    <slot />
  </section>
</template>

<script setup lang="ts">
// Presentation-only template. Page injects organisms into default slot.
</script>

<style scoped>
.container { display: contents; }
</style>