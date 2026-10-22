<script setup>
import { inject } from 'vue'

const pointActions = inject('point-actions')
pointActions.add = true
pointActions.batchAdd = true
</script>
