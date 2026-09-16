<template>
  <a-space wrap>
    <a-button @click="mode = 'mixed'">Mixed</a-button>
    <a-button @click="mode = 'inline'">All inline</a-button>
    <a-button @click="mode = 'more'">All folded</a-button>
    <a-button @click="mode = 'empty'">Clear</a-button>
    <a-button @click="showCopy = !showCopy">Toggle copy</a-button>
    <a-button @click="reverse = !reverse">Reverse</a-button>
    <a-button @click="extra = !extra">Extra controls</a-button>
    <a-button @click="switchLocale">Locale</a-button>
  </a-space>
  <p data-testid="counts">clicks:{{ clicks }} rows:{{ rowClicks }} confirmed:{{ confirmations }}</p>
  <a-table
    :columns="columns"
    :data-source="rows"
    :pagination="false"
    :scroll="{ x: 1600, y: 180 }"
    :custom-row="() => ({ onClick: rowClick, onDblclick: rowClick, onKeydown: rowClick })"
    style="width: 720px; margin-top: 16px"
  >
    <template #bodyCell="{ column }">
      <template v-if="column.key === 'actions'">
        <TableActions>
          <template v-if="mode !== 'empty'">
            <TableActions.Item :common="common(true)" v-slot="{ placement }">
              <j-permission-button type="link" @click="click">edit-{{ placement }}</j-permission-button>
            </TableActions.Item>
            <TableActionsItem :common="common(true)">
              <j-permission-button type="link" danger :popConfirm="{ title: 'Delete item?', onConfirm: confirm }">delete</j-permission-button>
            </TableActionsItem>
            <TableActionsItem :common="common(false)" :closeOnClick="false">
              <a-flex align="center" justify="space-between" gap="large" style="width: 100%">
                <span>Enabled</span>
                <a-switch v-model:checked="enabled" aria-label="Enabled" />
              </a-flex>
            </TableActionsItem>
            <template v-for="action in actions" :key="action">
              <TableActionsItem v-if="action !== 'copy' || showCopy" :common="common(false)" v-slot="{ placement }">
                <a-button type="text" @click.stop="click">{{ action }}-{{ placement }}</a-button>
              </TableActionsItem>
            </template>
            <template v-if="extra">
              <TableActionsItem><a-button type="text" disabled @click="click">disabled</a-button></TableActionsItem>
              <TableActionsItem><a-button type="text" loading @click="click">loading</a-button></TableActionsItem>
              <TableActionsItem><j-permission-button type="link" :hasPermission="false" @click="click">no permission</j-permission-button></TableActionsItem>
              <TableActionsItem :closeOnClick="false" v-slot="{ close }">
                <j-permission-button
                  type="link"
                  :popConfirm="{ title: 'Confirm and close?', onConfirm: () => { confirm(); close() } }"
                >confirm manually</j-permission-button>
              </TableActionsItem>
              <TableActionsItem>
                <j-permission-button type="link" :popConfirm="{ title: 'Confirm after close?', onConfirm: confirm }">confirm automatically</j-permission-button>
              </TableActionsItem>
              <TableActionsItem :closeOnClick="false" v-slot="{ close }">
                <a-popconfirm title="Inline confirmation?" @confirm="confirm(); close()">
                  <a-button type="text">inline confirmation</a-button>
                </a-popconfirm>
              </TableActionsItem>
              <TableActionsItem><a-button type="text" @click.prevent="click">prevent close</a-button></TableActionsItem>
              <TableActionsItem :closeOnClick="false" v-slot="{ close }"><a-button type="text" @click="close">close manually</a-button></TableActionsItem>
            </template>
          </template>
        </TableActions>
      </template>
    </template>
  </a-table>
  <a-button style="margin-top: 20px">After table</a-button>
</template>

<script setup lang="ts">
import TableActions, { TableActionsItem } from '../../src/components/TableActions'
import { PermissionButton as JPermissionButton } from '@jetlinks-web/components'
import { useHarness } from './useHarness'

const { mode, showCopy, reverse, extra, enabled, clicks, rowClicks, confirmations, actions, common, click, rowClick, confirm, switchLocale } = useHarness()
const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name', width: 1200 },
  { title: 'Actions', key: 'actions', fixed: 'right' as const, width: 360 },
]
const rows = [{ key: 'first', name: 'Test item' }]
</script>
