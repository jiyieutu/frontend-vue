import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { hydrateSession } from './lib/session'
import './styles.css'

hydrateSession()

createApp(App).use(router).mount('#app')
