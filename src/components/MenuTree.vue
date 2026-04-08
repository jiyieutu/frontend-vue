<script>
export default {
  name: 'MenuTree',
  props: {
    currentLegacyPath: {
      type: String,
      default: '',
    },
    currentPath: {
      type: String,
      default: '',
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
    isActive(node) {
      if (node.routePath === '/legacy' && this.currentPath === '/legacy') {
        return node.legacyPath === this.currentLegacyPath
      }

      return Boolean(node.routePath) && node.routePath === this.currentPath
    },
    onClick(node) {
      if (this.hasChildren(node)) {
        node.expanded = !node.expanded
        return
      }

      this.$emit('navigate', node)
    },
  },
}
</script>

<template>
  <ul class="menu-tree">
    <li
      v-for="node in nodes"
      :key="`${node.id}:${node.legacyPath || node.routePath || node.title}`"
      class="menu-tree__item"
    >
      <button
        type="button"
        class="menu-link"
        :class="{ 'menu-link--active': isActive(node) }"
        @click="onClick(node)"
      >
        <span class="menu-link__label">{{ node.title }}</span>
      </button>

      <MenuTree
        v-if="hasChildren(node) && node.expanded"
        :nodes="node.children"
        :current-path="currentPath"
        :current-legacy-path="currentLegacyPath"
        @navigate="$emit('navigate', $event)"
      />
    </li>
  </ul>
</template>
