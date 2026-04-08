<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { appTitle } from './lib/config'

const route = useRoute()
const router = useRouter()

function syncDocumentTitle() {
  const pageTitle = typeof route.meta.title === 'string' ? route.meta.title : ''
  document.title = pageTitle ? `${pageTitle} | ${appTitle}` : appTitle
}

function handleAuthExpired() {
  if (route.name !== 'login') {
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    })
  }
}

watch(() => route.fullPath, syncDocumentTitle, { immediate: true })

onMounted(() => window.addEventListener('auth:expired', handleAuthExpired))
onBeforeUnmount(() => window.removeEventListener('auth:expired', handleAuthExpired))
</script>

<template>
  <RouterView />
</template>
