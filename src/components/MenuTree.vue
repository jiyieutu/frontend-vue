<script>
export default {
  name: 'MenuTree',
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
    currentLegacyPath: {
      type: String,
      default: '',
    },
    currentPath: {
      type: String,
      default: '',
    },
    currentQuery: {
      type: Object,
      default: () => ({}),
    },
    depth: {
      type: Number,
      default: 0,
    },
    nodes: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['navigate'],
  methods: {
    hasChildren(node) {
      return Array.isArray(node.children) && node.children.length > 0
    },
    firstNavigableChild(node) {
      if (!node) {
        return null
      }

      if (node.routePath || node.legacyPath) {
        return node
      }

      for (const child of node.children || []) {
        const target = this.firstNavigableChild(child)
        if (target) {
          return target
        }
      }

      return null
    },
    isActive(node) {
      if (node.routePath === '/legacy' && this.currentPath === '/legacy') {
        return node.legacyPath === this.currentLegacyPath
      }

      if (Boolean(node.routePath) && node.routePath === this.currentPath && this.queryMatches(node)) {
        return true
      }

      return (node.children || []).some((child) => this.isActive(child))
    },
    queryMatches(node) {
      const query = node.routeQuery || {}
      const keys = Object.keys(query)
      if (!keys.length) {
        return true
      }

      return keys.every((key) => {
        const expected = String(query[key] || '')
        const actual = String(this.currentQuery[key] || '')
        return actual === expected || (key === 'tab' && expected === 'files' && !actual)
      })
    },
    menuBadge(node) {
      if (node.iconGlyph) {
        return node.iconGlyph
      }

      const text = typeof node.title === 'string' ? node.title.replace(/\s+/g, '') : ''
      if (!text) {
        return '•'
      }

      const first = text[0]
      if (/[A-Za-z0-9]/.test(first)) {
        return text.slice(0, 2).toUpperCase()
      }

      return first
    },
    onClick(node) {
      const target = this.firstNavigableChild(node)

      if (this.collapsed) {
        if (target) {
          this.$emit('navigate', target)
        }
        return
      }

      if (this.hasChildren(node)) {
        node.expanded = !node.expanded
        return
      }

      if (target) {
        this.$emit('navigate', target)
      }
    },
  },
}
</script>

<template>
  <ul class="menu-tree" :class="{ 'menu-tree--collapsed': collapsed && depth === 0 }">
    <li
      v-for="node in nodes"
      :key="`${node.id}:${node.legacyPath || node.routePath || node.title}`"
      class="menu-tree__item"
    >
      <button
        type="button"
        class="menu-link"
        :class="{ 'menu-link--active': isActive(node), 'menu-link--collapsed': collapsed && depth === 0 }"
        :data-label="collapsed && depth === 0 ? node.title : null"
        :title="collapsed && depth === 0 ? node.title : ''"
        @click="onClick(node)"
      >
        <span v-if="collapsed && depth === 0" class="menu-link__badge">{{ menuBadge(node) }}</span>
        <template v-else>
          <span v-if="node.iconGlyph" class="menu-link__icon" :class="{ 'menu-link__icon--backup': node.id?.includes('backup-center') }">{{ node.iconGlyph }}</span>
          <span class="menu-link__label">{{ node.title }}</span>
        </template>
      </button>

      <MenuTree
        v-if="!collapsed && hasChildren(node) && node.expanded"
        :collapsed="collapsed"
        :depth="depth + 1"
        :nodes="node.children"
        :current-path="currentPath"
        :current-legacy-path="currentLegacyPath"
        :current-query="currentQuery"
        @navigate="$emit('navigate', $event)"
      />
    </li>
  </ul>
</template>
