<template>
  <div class="scene-center">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <a href="#" class="logo">
          <div class="logo-icon">JL</div>
          <span class="logo-text">JetLinks</span>
          <span class="logo-divider"></span>
          <span class="logo-subtitle">场景商城</span>
        </a>

        <nav class="header-nav">
          <a href="#" class="nav-link active">场景商城</a>
          <a href="#" class="nav-link">我的场景</a>
          <a href="#" class="nav-link">解决方案</a>
          <a href="#" class="nav-link">开发文档</a>
        </nav>

        <div class="header-actions">
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input type="text" placeholder="搜索场景、能力、行业..."/>
          </div>
          <div class="user-avatar">旱</div>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="main-content">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-content">
          <div class="hero-badge">SaaS 场景化服务</div>
          <h1>开箱即用的物联网场景解决方案</h1>
          <p>
            基于 JetLinks 物联网平台核心能力，提供覆盖智慧交通、智慧城市、工业制造等多行业的标准化场景模板。选择场景，配置数据源，即刻启用。
          </p>
          <div class="hero-stats">
            <div class="hero-stat">
              <div class="hero-stat-value">36+</div>
              <div class="hero-stat-label">场景模板</div>
            </div>
            <div class="hero-stat">
              <div class="hero-stat-value">8</div>
              <div class="hero-stat-label">行业覆盖</div>
            </div>
            <div class="hero-stat">
              <div class="hero-stat-value">1,280+</div>
              <div class="hero-stat-label">部署实例</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Capability -->
      <section class="capability-section">
        <div class="capability-title">核心能力</div>
        <div class="capability-grid">
          <div class="capability-item" v-for="item in capabilities" :key="item.name">
            <div class="capability-icon" :class="item.type">{{ item.icon }}</div>
            <div class="capability-info">
              <div class="capability-name">{{ item.name }}</div>
              <div class="capability-count">{{ item.count }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Filter -->
      <section class="filter-section">
        <div class="filter-tabs">
          <button
              v-for="(tab, index) in tabs"
              :key="tab.name"
              class="filter-tab"
              :class="{ active: activeTab === index }"
              @click="activeTab = index"
          >
            {{ tab.name }}
            <span class="count">{{ tab.count }}</span>
          </button>
        </div>
      </section>

      <!-- Scene Grid（静态 HTML，完全保持原样） -->
      <section class="scene-grid">
        <a @click="onClick(n)" class="scene-card" v-for="n in 9" :key="n">
          <div class="scene-card-cover">
            <img src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=400&fit=crop"/>
            <span class="scene-card-badge hot">热门</span>
            <span class="scene-card-industry">示例行业</span>
          </div>
          <div class="scene-card-content">
            <h3 class="scene-card-title">示例场景 {{ n }}</h3>
            <p class="scene-card-desc">这是一个示例场景描述，用于保持页面结构和样式完全一致。</p>
            <div class="scene-card-tags">
              <span class="scene-tag iot">物联网</span>
              <span class="scene-tag ai">AI</span>
            </div>
            <div class="scene-card-footer">
              <div class="scene-card-meta">
                <span class="scene-meta-item">👍 100</span>
                <span class="scene-meta-item">⭐ 4.9</span>
              </div>
              <button class="scene-card-action">立即创建</button>
            </div>
          </div>
        </a>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-text">© 2025 旱獭信息技术有限公司 · JetLinks 物联网平台</div>
        <div class="footer-links">
          <a href="#" class="footer-link">产品文档</a>
          <a href="#" class="footer-link">API参考</a>
          <a href="#" class="footer-link">联系我们</a>
          <a href="#" class="footer-link">隐私政策</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
const activeTab = ref(0)
const tabs = [
  {name: "全部场景", count: 36},
  {name: "智慧交通", count: 6},
  {name: "智慧城市", count: 8},
  {name: "智慧工业", count: 7},
  {name: "智慧化工", count: 5},
  {name: "智慧社区", count: 4},
  {name: "智慧消防", count: 6}
]
const capabilities = [
  {name: "物联网平台", count: "28 个场景", icon: "🌐", type: "iot"},
  {name: "可视化平台", count: "24 个场景", icon: "📊", type: "visual"},
  {name: "视频中台", count: "18 个场景", icon: "🎥", type: "video"},
  {name: "边缘计算", count: "15 个场景", icon: "⚡", type: "edge"},
  {name: "机器视觉", count: "12 个场景", icon: "🤖", type: "ai"},
  {name: "AI 智能体", count: "10 个场景", icon: "🧠", type: "agent"}
]
const router = useRouter();
const onClick = () => {
  router.push("/scene/center/detail");
}
</script>

<style scoped lang="less">
// Less 变量定义
@primary: #1890ff;
@primary-dark: #0d6efd;
@primary-light: #69c0ff;
@primary-bg: #e6f4ff;
@secondary: #00d9ff;
@accent: #722ed1;
@success: #52c41a;
@warning: #faad14;
@error: #ff4d4f;
@dark: #0a1628;
@dark-secondary: #111d32;
@gray-100: #f8fafc;
@gray-200: #e2e8f0;
@gray-300: #cbd5e1;
@gray-400: #94a3b8;
@gray-500: #64748b;
@gray-600: #475569;
@text-primary: #1e293b;
@text-secondary: #64748b;
@card-bg: #ffffff;
@border-color: #e2e8f0;
@shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
@shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
@shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
@shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
@radius-sm: 6px;
@radius-md: 10px;
@radius-lg: 16px;
@radius-xl: 24px;

.scene-center {

  /* Header */

  .header {
    background: @card-bg;
    border-bottom: 1px solid @border-color;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(12px);
  }

  .header-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: @text-primary;
  }

  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, @primary 0%, @secondary 100%);
    border-radius: @radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 14px;
  }

  .logo-text {
    font-weight: 600;
    font-size: 18px;
  }

  .logo-divider {
    width: 1px;
    height: 20px;
    background: @gray-300;
    margin: 0 8px;
  }

  .logo-subtitle {
    font-size: 14px;
    color: @text-secondary;
  }

  .header-nav {
    display: flex;
    align-items: center;
    gap: 32px;
  }

  .nav-link {
    font-size: 14px;
    color: @text-secondary;
    text-decoration: none;
    transition: color 0.2s;
  }

  .nav-link:hover, .nav-link.active {
    color: @primary;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .search-box {
    display: flex;
    align-items: center;
    background: @gray-100;
    border: 1px solid @border-color;
    border-radius: @radius-md;
    padding: 8px 16px;
    gap: 8px;
    width: 280px;
    transition: all 0.2s;
  }

  .search-box:focus-within {
    border-color: @primary;
    box-shadow: 0 0 0 3px @primary-bg;
  }

  .search-box input {
    border: none;
    background: none;
    outline: none;
    font-size: 14px;
    flex: 1;
    color: @text-primary;
  }

  .search-box input::placeholder {
    color: @gray-400;
  }

  .search-icon {
    color: @gray-400;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, @primary 0%, @accent 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  /* Main Content */

  .main-content {
    max-width: 1440px;
    margin: 0 auto;
    padding: 32px;
  }

  /* Hero Section */

  .hero {
    background: linear-gradient(135deg, @dark 0%, @dark-secondary 100%);
    border-radius: @radius-xl;
    padding: 48px;
    margin-bottom: 40px;
    position: relative;
    overflow: hidden;
  }

  .hero::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 60%;
    height: 100%;
    background: radial-gradient(ellipse at top right, rgba(24, 144, 255, 0.15) 0%, transparent 70%);
  }

  .hero::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 40%;
    height: 50%;
    background: radial-gradient(ellipse at bottom, rgba(0, 217, 255, 0.1) 0%, transparent 70%);
  }

  .hero-content {
    position: relative;
    z-index: 1;
    max-width: 600px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(24, 144, 255, 0.15);
    border: 1px solid rgba(24, 144, 255, 0.3);
    color: @primary-light;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 20px;
    margin-bottom: 20px;
  }

  .hero-badge::before {
    content: '';
    width: 6px;
    height: 6px;
    background: @primary-light;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .hero h1 {
    font-size: 36px;
    font-weight: 700;
    color: white;
    margin-bottom: 16px;
    line-height: 1.3;
  }

  .hero p {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 28px;
    line-height: 1.8;
  }

  .hero-stats {
    display: flex;
    gap: 40px;
  }

  .hero-stat {
    text-align: left;
  }

  .hero-stat-value {
    font-size: 28px;
    font-weight: 700;
    color: white;
    font-family: 'JetBrains Mono', monospace;
  }

  .hero-stat-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
  }

  /* Filter Section */

  .filter-section {
    margin-bottom: 32px;
  }

  .filter-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-tab {
    padding: 10px 20px;
    border-radius: @radius-md;
    font-size: 14px;
    font-weight: 500;
    color: @text-secondary;
    background: @card-bg;
    border: 1px solid @border-color;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-tab:hover {
    border-color: @primary;
    color: @primary;
  }

  .filter-tab.active {
    background: @primary;
    border-color: @primary;
    color: white;
  }

  .filter-tab .count {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.1);
  }

  .filter-tab.active .count {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Scene Grid */

  .scene-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 24px;
  }

  .scene-card {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    overflow: hidden;
    transition: all 0.3s ease;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    display: block;
  }

  .scene-card:hover {
    transform: translateY(-4px);
    box-shadow: @shadow-xl;
    border-color: @primary-light;
  }

  .scene-card-cover {
    height: 180px;
    position: relative;
    overflow: hidden;
  }

  .scene-card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }

  .scene-card:hover .scene-card-cover img {
    transform: scale(1.05);
  }

  .scene-card-cover::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
  }

  .scene-card-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .scene-card-badge.hot {
    background: linear-gradient(135deg, #ff4d4f, #ff7a45);
    color: white;
  }

  .scene-card-badge.new {
    background: linear-gradient(135deg, @primary, @secondary);
    color: white;
  }

  .scene-card-badge.popular {
    background: linear-gradient(135deg, @accent, #b37feb);
    color: white;
  }

  .scene-card-industry {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.95);
    color: @text-primary;
  }

  .scene-card-content {
    padding: 20px;
  }

  .scene-card-title {
    font-size: 17px;
    font-weight: 600;
    margin-bottom: 8px;
    color: @text-primary;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .scene-card-desc {
    font-size: 13px;
    color: @text-secondary;
    line-height: 1.7;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .scene-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .scene-tag {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: @gray-100;
    color: @gray-600;
    border: 1px solid @border-color;
  }

  .scene-tag.vision {
    background: #fff0f6;
    color: #c41d7f;
    border-color: #ffadd2;
  }

  .scene-tag.ai {
    background: #f0f5ff;
    color: #2f54eb;
    border-color: #adc6ff;
  }

  .scene-tag.iot {
    background: #e6fffb;
    color: #08979c;
    border-color: #87e8de;
  }

  .scene-tag.video {
    background: #fff7e6;
    color: #d46b08;
    border-color: #ffd591;
  }

  .scene-tag.edge {
    background: #f6ffed;
    color: #389e0d;
    border-color: #b7eb8f;
  }

  .scene-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px solid @border-color;
  }

  .scene-card-meta {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .scene-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: @text-secondary;
  }

  .scene-meta-item svg {
    width: 14px;
    height: 14px;
  }

  .scene-card-action {
    padding: 8px 16px;
    border-radius: @radius-sm;
    font-size: 13px;
    font-weight: 500;
    background: @primary;
    color: white;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .scene-card-action:hover {
    background: @primary-dark;
  }

  /* Section Header */

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 20px;
    font-weight: 600;
    color: @text-primary;
  }

  .view-all {
    font-size: 14px;
    color: @primary;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .view-all:hover {
    text-decoration: underline;
  }

  /* Capability Badges */

  .capability-section {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    padding: 24px;
    margin-bottom: 32px;
  }

  .capability-title {
    font-size: 14px;
    font-weight: 500;
    color: @text-secondary;
    margin-bottom: 16px;
  }

  .capability-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .capability-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: @gray-100;
    border-radius: @radius-md;
    border: 1px solid @border-color;
    transition: all 0.2s;
    cursor: pointer;
  }

  .capability-item:hover {
    background: @primary-bg;
    border-color: @primary-light;
  }

  .capability-icon {
    width: 36px;
    height: 36px;
    border-radius: @radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .capability-icon.iot {
    background: linear-gradient(135deg, #e6fffb, #87e8de);
  }

  .capability-icon.visual {
    background: linear-gradient(135deg, #fff7e6, #ffd591);
  }

  .capability-icon.video {
    background: linear-gradient(135deg, #f0f5ff, #adc6ff);
  }

  .capability-icon.edge {
    background: linear-gradient(135deg, #f6ffed, #b7eb8f);
  }

  .capability-icon.ai {
    background: linear-gradient(135deg, #fff0f6, #ffadd2);
  }

  .capability-icon.agent {
    background: linear-gradient(135deg, #f9f0ff, #d3adf7);
  }

  .capability-info {
    flex: 1;
  }

  .capability-name {
    font-size: 14px;
    font-weight: 500;
    color: @text-primary;
  }

  .capability-count {
    font-size: 12px;
    color: @text-secondary;
  }

  /* Footer */

  .footer {
    background: @dark;
    color: rgba(255, 255, 255, 0.7);
    padding: 40px 32px;
    margin-top: 60px;
  }

  .footer-inner {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-text {
    font-size: 13px;
  }

  .footer-links {
    display: flex;
    gap: 24px;
  }

  .footer-link {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: white;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .header-inner {
      padding: 0 16px;
    }

    .header-nav {
      display: none;
    }

    .search-box {
      width: 200px;
    }

    .main-content {
      padding: 16px;
    }

    .hero {
      padding: 32px 24px;
    }

    .hero h1 {
      font-size: 28px;
    }

    .hero-stats {
      gap: 24px;
    }

    .scene-grid {
      grid-template-columns: 1fr;
    }

    .filter-tabs {
      overflow-x: auto;
      padding-bottom: 8px;
    }
  }

  /* Animations */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .scene-card {
    animation: fadeInUp 0.5s ease forwards;
    opacity: 0;
  }

  .scene-card:nth-child(1) {
    animation-delay: 0.1s;
  }

  .scene-card:nth-child(2) {
    animation-delay: 0.15s;
  }

  .scene-card:nth-child(3) {
    animation-delay: 0.2s;
  }

  .scene-card:nth-child(4) {
    animation-delay: 0.25s;
  }

  .scene-card:nth-child(5) {
    animation-delay: 0.3s;
  }

  .scene-card:nth-child(6) {
    animation-delay: 0.35s;
  }

  .scene-card:nth-child(7) {
    animation-delay: 0.4s;
  }

  .scene-card:nth-child(8) {
    animation-delay: 0.45s;
  }

  .scene-card:nth-child(9) {
    animation-delay: 0.5s;
  }
}
</style>
