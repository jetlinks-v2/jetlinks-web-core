<template>
  <div class="scene-center-detail">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <a @click="onClick" class="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            返回广场
          </a>
          <a @click="onClick" class="logo">
            <div class="logo-icon">JL</div>
            <span class="logo-text">JetLinks</span>
          </a>
        </div>

        <div class="header-actions">
          <!--          <button-->
          <!--              class="btn-login"-->
          <!--              v-show="!isLoggedIn"-->
          <!--              @click="showLoginModal"-->
          <!--          >-->
          <!--            登录-->
          <!--          </button>-->

          <div class="user-menu">
            <div class="user-avatar">旱</div>
            <span class="user-name">旱獭科技</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main -->
    <div class="main-layout">
      <div class="content-main">
        <!-- Scene Header -->
        <div class="scene-header">
          <div class="scene-cover">
            <img
                src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&h=600&fit=crop"
                alt="交通违章识别"
            />
            <div class="scene-cover-content">
              <div class="scene-badges">
                <span class="scene-badge hot">热门</span>
                <span class="scene-badge industry">智慧交通</span>
              </div>
              <h1 class="scene-title">交通违章停车智能识别</h1>
              <p class="scene-subtitle">
                基于机器视觉 + 多模态AI复判的高精度违章检测方案
              </p>
            </div>
          </div>

          <div class="scene-info">
            <div class="scene-meta-row">
              <span class="scene-meta-item"><strong>328</strong> 次部署</span>
              <span class="scene-meta-item"><strong>4.9</strong> 评分</span>
              <span class="scene-meta-item">更新于 2025-01-15</span>
            </div>

            <div class="scene-tags">
              <span class="scene-tag vision">机器视觉</span>
              <span class="scene-tag ai">多模态AI</span>
              <span class="scene-tag video">视频中台</span>
              <span class="scene-tag edge">边缘计算</span>
            </div>
          </div>
        </div>

        <!-- 场景概述 -->
        <div class="content-section">
          <h2 class="section-title">场景概述</h2>
          <p class="section-text">
            交通违章停车智能识别场景是基于 JetLinks 物联网平台核心能力构建的智慧交通解决方案。
          </p>
          <p class="section-text">
            通过边缘计算与多模态 AI 复判，将识别准确率提升至 99.2% 以上。
          </p>
        </div>

        <!-- 核心功能 -->
        <div class="content-section">
          <h2 class="section-title">核心功能</h2>
          <div class="features-grid">
            <div class="feature-card" v-for="(f,i) in features" :key="i">
              <div class="feature-icon">{{ f.icon }}</div>
              <h3 class="feature-title">{{ f.title }}</h3>
              <p class="feature-desc">{{ f.desc }}</p>
            </div>
          </div>
        </div>

        <!-- 应用价值 -->
        <div class="content-section">
          <h2 class="section-title">应用价值</h2>
          <div class="values-grid">
            <div class="value-card" v-for="(v,i) in values" :key="i">
              <div class="value-number" v-html="v.value"></div>
              <div class="value-label">{{ v.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <div class="create-card">
          <div class="create-card-header">
            <h3 class="create-card-title">创建场景实例</h3>
            <p class="create-card-desc">
              基于此场景模板快速创建您的专属实例
            </p>
          </div>
          <div class="preset-info">
            <div class="preset-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              已预置能力组件
            </div>
            <div class="preset-list">
              <div class="preset-item">违停检测CV算法模型 (YOLOv8-parking)</div>
              <div class="preset-item">车牌识别模型 (LPR-v3)</div>
              <div class="preset-item">多模态复判智能体 (GPT-4V)</div>
              <div class="preset-item">证据链生成规则模板</div>
              <div class="preset-item">告警推送通知模板</div>
            </div>
          </div>
          <button
              class="btn-create"
              :class="{ 'is-creating': isCreating }"
              :disabled="isCreating"
              @click="handleCreateScene"
          >
            {{ isCreating ? '创建中' : '开始创建场景' }}
          </button>

          <button class="btn-demo">
            观看演示视频
          </button>
        </div>
        <div class="related-section">
          <h3 class="related-title">相关场景推荐</h3>
          <div class="related-list">
            <a href="#" class="related-item">
              <img src="https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=200&h=150&fit=crop" class="related-thumb">
              <div>
                <div class="related-name">交通信号自适应控制</div>
                <div class="related-meta">智慧交通 · 45次部署</div>
              </div>
            </a>
            <a href="#" class="related-item">
              <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=150&fit=crop" class="related-thumb">
              <div>
                <div class="related-name">智慧路灯管控系统</div>
                <div class="related-meta">智慧城市 · 156次部署</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-text">
          © 2025 旱獭信息技术有限公司 · JetLinks 物联网平台
        </div>
      </div>
    </footer>

    <!-- Login Modal -->
    <CreationBanner v-if="loginModalVisible" @close="loginModalVisible = false"/>
  </div>
</template>

<script setup>
import {ref, onMounted, watch} from "vue";
import CreationBanner from './CreationBanner.vue'

const isLoggedIn = ref(false);
const loginModalVisible = ref(false);
const pendingCreateScene = ref(false);
const isCreating = ref(false);

const features = [
  {icon: "🎯", title: "智能违章检测", desc: "基于深度学习算法自动识别违停行为。"},
  {icon: "🧠", title: "多模态AI复判", desc: "理解复杂场景语义，有效降低误报。"},
  {icon: "📹", title: "证据链生成", desc: "自动生成视频与图片证据链。"},
  {icon: "⚡", title: "边缘实时处理", desc: "毫秒级响应，支持断网续传。"},
  {icon: "📊", title: "数据可视化", desc: "实时统计与大屏展示。"},
  {icon: "🔗", title: "系统对接", desc: "标准 API 对接交管系统。"}
];

const values = [
  {value: "99.2<span class='value-unit'>%</span>", label: "识别准确率"},
  {value: "80<span class='value-unit'>%</span>", label: "人工成本降低"},
  {value: "&lt;3<span class='value-unit'>秒</span>", label: "平均响应时间"}
];

onMounted(() => {
  isLoggedIn.value = localStorage.getItem("isLoggedIn") === "true";
});

const router = useRouter();
const onClick = () => {
  router.push("/scene/center");
}

function showLoginModal() {
  loginModalVisible.value = true;
}

function hideLoginModal() {
  loginModalVisible.value = false;
}

function handleLogin() {
  isLoggedIn.value = true;
  localStorage.setItem("isLoggedIn", "true");
  hideLoginModal();

  if (pendingCreateScene.value) {
    pendingCreateScene.value = false;
    window.location.href =
        "create-wizard.html?template=traffic-parking-violation";
  }
}

function handleCreateScene() {
  // if (!isLoggedIn.value) {
  //   pendingCreateScene.value = true;
  //   showLoginModal();
  // } else {
  //   window.location.href =
  //       "create-wizard.html?template=traffic-parking-violation";
  // }
  isCreating.value = true;
  loginModalVisible.value = true;
}

// 监听弹窗关闭,恢复按钮状态
watch(loginModalVisible, (newVal) => {
  if (!newVal) {
    isCreating.value = false;
  }
});
</script>

<style lang="less">
// Less 变量定义
@primary: var(--jet-theme-primary);
@primary-dark: var(--jet-theme-primary-active);
@primary-light: var(--jet-theme-primary-hover);
@primary-bg: var(--jet-theme-primary-soft);
@secondary: var(--jet-theme-primary-hover);
@accent: var(--jet-theme-primary-active);
@success: var(--jet-theme-success);
@warning: var(--jet-theme-warning);
@error: var(--jet-theme-error);
@dark: var(--code-dark-bg);
@dark-secondary: color-mix(in srgb, var(--code-dark-bg) 88%, var(--jet-theme-primary-active));
@gray-100: var(--jet-theme-bg-layout);
@gray-200: var(--jet-theme-border-secondary);
@gray-300: var(--jet-theme-border);
@gray-400: var(--jet-theme-text-disabled);
@gray-500: var(--jet-theme-text-secondary);
@gray-600: var(--jet-theme-text-secondary);
@text-primary: var(--jet-theme-text-title);
@text-secondary: var(--jet-theme-text-secondary);
@card-bg: var(--jet-theme-bg-container);
@border-color: var(--jet-theme-border-secondary);
@radius-sm: 0.375rem;
@radius-md: 0.625rem;
@radius-lg: 1rem;
@radius-xl: 1.5rem;

.scene-center-detail {
  .header {
    background: @card-bg;
    border-bottom: 1px solid @border-color;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-inner {
    max-width: 90rem;
    margin: 0 auto;
    padding: 0 2rem;
    height: 4rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: var(--space-2) var(--space-3);
    border-radius: @radius-sm;
    color: @text-secondary;
    text-decoration: none;
    font-size: var(--fs-14);
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: @gray-100;
    color: @text-primary;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
    color: @text-primary;
  }

  .logo-icon {
    width: 2.25rem;
    height: 2.25rem;
    background: linear-gradient(135deg, @primary, @secondary);
    border-radius: @radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-ink);
    font-weight: 700;
    font-size: var(--fs-14);
  }

  .logo-text {
    font-weight: 600;
    font-size: var(--fs-18);
  }

  .user-menu {
    display: none;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
  }

  .user-menu.show {
    display: flex;
  }

  .user-avatar {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: linear-gradient(135deg, @primary, @accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-ink);
    font-size: var(--fs-14);
    font-weight: 500;
  }

  .user-name {
    font-size: var(--fs-14);
  }

  .main-layout {
    max-width: 90rem;
    margin: 0 auto;
    padding: var(--space-8);
    display: grid;
    grid-template-columns: 1fr 25rem;
    gap: var(--space-8);
  }

  .scene-header {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    overflow: hidden;
  }

  .scene-cover {
    height: 18.75rem;
    position: relative;
    overflow: hidden;
  }

  .scene-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .scene-cover::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(to top, color-mix(in srgb, var(--code-dark-bg) 80%, transparent), transparent);
  }

  .scene-cover-content {
    position: absolute;
    bottom: 1.75rem;
    left: 1.75rem;
    right: 1.75rem;
    z-index: 2;
  }

  .scene-badges {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .scene-badge {
    padding: 0.3125rem 0.75rem;
    border-radius: var(--r-1);
    font-size: var(--fs-12);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03125rem;
  }

  .scene-badge.hot {
    background: linear-gradient(135deg, var(--jet-theme-error), color-mix(in srgb, var(--jet-theme-warning) 72%, var(--jet-theme-error)));
    color: var(--accent-ink);
  }

  .scene-badge.industry {
    background: color-mix(in srgb, var(--jet-theme-bg-container) 95%, transparent);
    color: @text-primary;
  }

  .scene-title {
    font-size: var(--fs-32);
    font-weight: 700;
    color: var(--accent-ink);
    margin-bottom: 0.625rem;
  }

  .scene-subtitle {
    font-size: var(--fs-15);
    color: color-mix(in srgb, var(--accent-ink) 80%, transparent);
  }

  .scene-info {
    padding: var(--space-6) var(--space-7);
  }

  .scene-meta-row {
    display: flex;
    align-items: center;
    gap: var(--space-7);
    margin-bottom: var(--space-5);
  }

  .scene-meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--fs-14);
    color: @text-secondary;
  }

  .scene-meta-item svg {
    width: 1rem;
    height: 1rem;
  }

  .scene-meta-item strong {
    color: @text-primary;
    font-weight: 600;
  }

  .scene-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .scene-tag {
    padding: 0.375rem 0.875rem;
    border-radius: var(--r-2);
    font-size: var(--fs-12);
    font-weight: 500;
    background: @gray-100;
    color: @gray-600;
    border: 1px solid @border-color;
  }

  .scene-tag.vision {
    background: var(--err-bg);
    color: var(--jet-theme-error);
    border-color: color-mix(in srgb, var(--jet-theme-error) 28%, var(--jet-theme-bg-container));
  }

  .scene-tag.ai {
    background: var(--jet-theme-primary-soft);
    color: var(--jet-theme-primary-active);
    border-color: color-mix(in srgb, var(--jet-theme-primary) 28%, var(--jet-theme-bg-container));
  }

  .scene-tag.video {
    background: var(--warn-bg);
    color: var(--jet-theme-warning);
    border-color: color-mix(in srgb, var(--jet-theme-warning) 32%, var(--jet-theme-bg-container));
  }

  .scene-tag.edge {
    background: var(--ok-bg);
    color: var(--jet-theme-success);
    border-color: color-mix(in srgb, var(--jet-theme-success) 32%, var(--jet-theme-bg-container));
  }

  .content-section {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    padding: var(--space-7);
    margin-top: var(--space-6);
  }

  .section-title {
    font-size: var(--fs-18);
    font-weight: 600;
    margin-bottom: var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .section-title::before {
    content: '';
    width: 0.25rem;
    height: 1.125rem;
    background: linear-gradient(180deg, @primary, @secondary);
    border-radius: 0.125rem;
  }

  .section-text {
    font-size: var(--fs-14);
    color: @text-secondary;
    line-height: 1.9;
  }

  .section-text + .section-text {
    margin-top: var(--space-3);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin-top: var(--space-2);
  }

  .feature-card {
    padding: var(--space-5);
    background: @gray-100;
    border-radius: @radius-md;
    border: 1px solid @border-color;
    transition: all 0.2s;
  }

  .feature-card:hover {
    background: @primary-bg;
    border-color: @primary-light;
  }

  .feature-icon {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: @radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-22);
    margin-bottom: 0.875rem;
    background: var(--bg);
    box-shadow: var(--shadow-1);
  }

  .feature-title {
    font-size: var(--fs-15);
    font-weight: 600;
    margin-bottom: 0.375rem;
  }

  .feature-desc {
    font-size: var(--fs-13);
    color: @text-secondary;
    line-height: 1.6;
  }

  .values-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .value-card {
    text-align: center;
    padding: 1.5rem 1rem;
    background: linear-gradient(135deg, @primary-bg, var(--jet-theme-bg-container));
    border-radius: @radius-md;
    border: 1px solid @primary-light;
  }

  .value-number {
    font-size: var(--fs-36);
    font-weight: 700;
    color: @primary; line-height: 1;
  }

  .value-unit {
    font-size: var(--fs-16);
    color: @primary;
  }

  .value-label {
    font-size: var(--fs-13);
    color: @text-secondary;
    margin-top: var(--space-2);
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .create-card {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    padding: var(--space-7);
    position: sticky;
    top: 6rem;
  }

  .create-card-header {
    margin-bottom: var(--space-6);
  }

  .create-card-title {
    font-size: var(--fs-20);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .create-card-desc {
    font-size: var(--fs-14);
    color: @text-secondary;
    line-height: 1.7;
  }

  .preset-info {
    background: @primary-bg;
    border: 1px solid @primary-light;
    border-radius: @radius-md;
    padding: 1.125rem;
    margin-bottom: var(--space-6);
  }

  .preset-title {
    font-size: var(--fs-13);
    font-weight: 600;
    color: @primary-dark;
    margin-bottom: 0.875rem;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .preset-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--fs-13);
    color: @text-secondary;
    line-height: 1.5;
  }

  .preset-item::before {
    content: '✓';
    color: @success;
    font-weight: 700;
  }

  .btn-create {
    width: 100%;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, @primary, @primary-dark);
    color: var(--accent-ink);
    border: none;
    border-radius: @radius-md;
    font-size: var(--fs-16);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .btn-create:hover {
    transform: translateY(-0.125rem);
    box-shadow: 0 0.5rem 1.25rem color-mix(in srgb, var(--jet-theme-primary) 35%, transparent);
  }

  .btn-create:disabled,
  .btn-create.is-creating {
    background: @gray-300;
    color: @gray-500;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-create:disabled:hover,
  .btn-create.is-creating:hover {
    transform: none;
    box-shadow: none;
  }

  .btn-demo {
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: @card-bg;
    color: @text-primary;
    border: 1px solid @border-color;
    border-radius: @radius-md;
    font-size: var(--fs-14);
    font-weight: 500;
    cursor: pointer;
    margin-top: var(--space-3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .btn-demo:hover {
    background: @gray-100;
  }

  .related-section {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    padding: var(--space-6);
  }

  .related-title {
    font-size: var(--fs-16);
    font-weight: 600;
    margin-bottom: var(--space-4);
  }

  .related-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .related-item {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-3);
    background: @gray-100;
    border-radius: @radius-md;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
  }

  .related-item:hover {
    background: @primary-bg;
  }

  .related-thumb {
    width: 4.5rem;
    height: 3.375rem;
    border-radius: var(--r-2);
    object-fit: cover;
  }

  .related-name {
    font-size: var(--fs-14);
    font-weight: 500;
    margin-bottom: var(--space-1);
  }

  .related-meta {
    font-size: var(--fs-12);
    color: @text-secondary;
  }

  .footer {
    background: @dark;
    color: color-mix(in srgb, var(--accent-ink) 70%, transparent);
    padding: 2.5rem 2rem;
    margin-top: 3.75rem;
  }

  .footer-inner {
    max-width: 90rem;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-text {
    font-size: var(--fs-13);
  }

  .footer-links {
    display: flex;
    gap: var(--space-6);
  }

  .footer-link {
    font-size: var(--fs-13);
    color: color-mix(in srgb, var(--accent-ink) 70%, transparent);
    text-decoration: none;
  }

  .footer-link:hover {
    color: var(--accent-ink);
  }

  .modal-overlay.active .modal {
    transform: scale(1);
  }

  .modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2rem;
    height: 2rem;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--r-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: @gray-400;
    z-index: 10;
  }

  .modal-close:hover {
    background: @gray-100;
    color: @text-primary;
  }

  .modal-header {
    padding: 1.75rem 1.5rem 0;
    text-align: center;
  }

  .modal-logo {
    width: 3.25rem;
    height: 3.25rem;
    background: linear-gradient(135deg, @primary, @secondary);
    border-radius: @radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-ink);
    font-weight: 700;
    font-size: var(--fs-20);
    margin: 0 auto 1rem;
  }

  .modal-title {
    font-size: var(--fs-22);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .modal-subtitle {
    font-size: var(--fs-14);
    color: @text-secondary;
  }

  .modal-body {
    padding: var(--space-6);
  }

  .form-group {
    margin-bottom: var(--space-4);
  }

  .form-label {
    display: block;
    font-size: var(--fs-13);
    font-weight: 500;
    margin-bottom: var(--space-2);
  }

  .form-input {
    width: 100%;
    padding: 0.75rem 0.875rem;
    border: 1px solid @border-color;
    border-radius: @radius-sm;
    font-size: var(--fs-14);
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: @primary;
    box-shadow: 0 0 0 0.1875rem @primary-bg;
  }

  .form-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-5);
  }

  .form-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-13);
    color: @text-secondary;
    cursor: pointer;
  }

  .form-checkbox input {
    width: 1rem;
    height: 1rem;
    accent-color: @primary;
  }

  .form-link {
    font-size: var(--fs-13);
    color: @primary;
    text-decoration: none;
  }

  .btn-submit {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, @primary, @primary-dark);
    color: var(--accent-ink);
    border: none;
    border-radius: @radius-md;
    font-size: var(--fs-15);
    font-weight: 600;
    cursor: pointer;
  }

  .modal-footer {
    padding: 1rem 1.5rem 1.5rem;
    text-align: center;
    font-size: var(--fs-13);
    color: @text-secondary;
  }

  .modal-footer a {
    color: @primary;
    text-decoration: none;
    font-weight: 500;
  }

  @media (max-width: 64rem) {
    .main-layout {
      grid-template-columns: 1fr;
    }

    .create-card {
      position: static;
    }
  }

  @media (max-width: 48rem) {
    .main-layout {
      padding: var(--space-4);
    }

    .scene-title {
      font-size: var(--fs-24);
    }

    .features-grid, .values-grid {
      grid-template-columns: 1fr;
    }
  }
}</style>
