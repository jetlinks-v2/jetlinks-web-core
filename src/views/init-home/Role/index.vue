<template>
    <div class="init-home-role">
        <div class="built_in_group">
            <div>{{ $t('Role.index.263636-0') }}</div>
            <div class="group">
                <div v-for="(item, index) in group" class="group_item" @mouseover="() => showButton(item)"
                    @mouseleave="() => hiddenButton(item)">
                    <div class="group_name" :class="{ group_selected: item.selected }"
                        :type="item.selected ? 'primary' : 'default'">
                        <j-ellipsis style="max-width: 90%;">
                          <span>{{ item.name }}</span>
                        </j-ellipsis>
                      <AIcon type="CloseOutlined" class="closeIcon" v-if="item.closeIcon"
                             @click="group.splice(index, 1)"></AIcon>
                    </div>
                    <div v-if="item.show">
                        <a-button block @click="() => selectGroup(item)">{{ item.selected ? $t('Role.index.263636-1') : $t('Role.index.263636-2') }}</a-button>
                        <a-button block @click="() => showEditGroup(item, index)">{{ $t('Role.index.263636-3') }}</a-button>
                    </div>
                </div>
                <a-button type="text" @click="showAddGroup" :disabled="group.length >= 10">{{ $t('Role.index.263636-4') }}</a-button>
            </div>
        </div>
        <a-checkbox-group @change="getCheckValue">
            <div class="init-home-role-content">
                <div class="role-item role-item-1" :style="keys.includes('device')
                        ? 'background-color: #f5f5f5;'
                        : ''
                    ">
                    <div class="role-item-title">
                        <a-checkbox :value="ROLEKEYS.device"></a-checkbox>
                        <div class="role-title">{{ $t('Role.index.263636-5') }}</div>
                    </div>
                    <div class="role-item-content"></div>
                    <div class="role-item-footer">
                        {{ $t('Role.index.263636-6') }}
                    </div>
                </div>
                <div class="role-item role-item-2" :style="keys.includes('link')
                        ? 'background-color: #f5f5f5;'
                        : ''
                    ">
                    <div class="role-item-title">
                        <a-checkbox :value="ROLEKEYS.link"></a-checkbox>
                        <div class="role-title">{{ $t('Role.index.263636-7') }}</div>
                    </div>
                    <div class="role-item-content"></div>
                    <div class="role-item-footer">
                        {{ $t('Role.index.263636-8') }}
                    </div>
                </div>
                <div class="role-item role-item-3" :style="keys.includes('complex')
                        ? 'background-color: #f5f5f5;'
                        : ''
                    ">
                    <div class="role-item-title">
                        <a-checkbox :value="ROLEKEYS.complex"></a-checkbox>
                        <div class="role-title">{{ $t('Role.index.263636-9') }}</div>
                    </div>
                    <div class="role-item-content"></div>
                    <div class="role-item-footer">
                        {{ $t('Role.index.263636-10') }}
                    </div>
                </div>
            </div>
        </a-checkbox-group>
    </div>
    <a-modal destroy-on-close :open="showAdd" :title="$t('Role.index.263636-11')" @cancel="showAdd = false" @ok="addGroup">
        <a-form layout="vertical" ref="formRef" :model="formData">
            <a-form-item name="name" :label="$t('Role.index.263636-12')" :rules="[
                {
                    required: true,
                    message: $t('Role.index.263636-13'),
                },
                {
                    max: 64,
                    message: $t('Role.index.263636-14'),
                },
            ]">
                <a-input v-model:value="formData.name" :placeholder="$t('Role.index.263636-13')"></a-input>
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts">
import { ROLEKEYS } from '../data/RoleData'
import { useInitializationRoles } from './useInitializationRoles'
const { keys, group, showAdd, formData, formRef, getCheckValue, showButton, hiddenButton, selectGroup, showAddGroup, showEditGroup, addGroup, submitRole, submitRoleGroup } = useInitializationRoles()
defineExpose({ submitRole, submitRoleGroup })
</script>
<style lang="less" scoped>
.init-home-role {
    .built_in_group {
        margin-bottom: 0.625rem;
        position: relative;

        .group {
            display: flex;
            position: absolute;
            z-index: 999;

            .group_item {
                width: 6.25rem;
                margin-right: var(--space-5);

                .button {
                    display: block;
                }

                .group_name {
                    border: 0.0125rem solid rgb(217, 217, 217);
                    text-align: center;
                    height: 2rem;
                    line-height: 2rem;
                    border-radius: 0.125rem;
                    padding: 0 0.625rem;
                    position: relative;

                    .closeIcon {
                        font-size: var(--fs-12);
                        position: absolute;
                        top: 0.625rem;
                        right: 0.25rem;
                    }
                }

                .group_selected {
                    background-color: rgb(190, 232, 251);
                }
            }
        }
    }

    .init-home-role-content {
        display: flex;
        grid-gap: 1.5rem;
        gap: var(--space-6);
        margin-top: var(--space-10);
    }

    .role-item-1 {
        background-image: url('@jetlinks-web-core/assets/init-home/role1.png');
    }

    .role-item-2 {
        background-image: url('@jetlinks-web-core/assets/init-home/role2.png');
    }

    .role-item-3 {
        background-image: url('@jetlinks-web-core/assets/init-home/role3.png');
    }

    .role-item {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        margin-bottom: 1.875rem;
        padding: var(--space-6);
        background-repeat: no-repeat;
        background-position: 50%;
        background-size: 23.125rem;
        border: 1px solid #f5f5f5;

        .role-item-title {
            display: flex;

            .role-title {
                flex: 1 1 auto;
                font-weight: 700;
                font-size: var(--fs-16);
                text-align: center;
            }
        }

        .role-item-content {
            width: 15.625rem;
            height: 16.25rem;
            margin-top: var(--space-6);
        }

        .role-item-footer {
            position: absolute;
            bottom: -1.875rem;
            left: 0;
            width: 100%;
            color: #999;
            font-size: var(--fs-12);
            text-align: center;
        }
    }
}</style>
