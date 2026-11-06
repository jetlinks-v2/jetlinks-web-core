import { computed } from 'vue';
import { useMenuStore } from '@jetlinks-web-core/store/menu';

/** 导航按当前菜单准入；配置修改权限由目标页的保存操作控制。 */
export function useAMapConfigNavigation() {
    const menu = useMenuStore();
    const canOpenConfig = computed(() => menu.hasMenu('system/Basis'));
    function openConfig() {
        if (canOpenConfig.value) void menu.jumpPage('system/Basis');
    }
    return { canOpenConfig, openConfig };
}
