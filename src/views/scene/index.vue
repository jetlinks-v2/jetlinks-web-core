<template>
  <div class="scene-center">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <a href="#" class="logo">
          <div class="logo-icon">JL</div>
          <span class="logo-text">JetLinks</span>
          <span class="logo-divider"></span>
          <span class="logo-subtitle">场景广场</span>
        </a>

        <nav class="header-nav">
          <a href="#" class="nav-link active">场景广场</a>
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

      <!-- Scene Grid -->
      <section class="scene-grid">
        <a @click="onClick(scene)" class="scene-card" v-for="scene in scenes" :key="scene.id">
          <div class="scene-card-cover">
            <img :src="scene.image" :alt="scene.title"/>
            <span v-if="scene.badge" class="scene-card-badge" :class="scene.badgeType">{{ scene.badge }}</span>
            <span class="scene-card-industry">{{ scene.industry }}</span>
          </div>
          <div class="scene-card-content">
            <h3 class="scene-card-title">{{ scene.title }}</h3>
            <p class="scene-card-desc">{{ scene.description }}</p>
            <div class="scene-card-tags">
              <span v-for="(tag, index) in scene.tags" :key="index" class="scene-tag" :class="tag.type">{{ tag.name }}</span>
            </div>
            <div class="scene-card-footer">
              <div class="scene-card-meta">
                <span class="scene-meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {{ scene.deployments }} 部署
                </span>
                <span class="scene-meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  {{ scene.rating }}
                </span>
              </div>
              <button class="scene-card-action">
                立即创建
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
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

const scenes = [
  {
    id: 1,
    title: "交通违章停车智能识别",
    description: "基于机器视觉识别交通违章停车,通过多模态大模型进行复判,有效提升识别准确率至99.2%,降低人工复核成本。",
    industry: "智慧交通",
    badge: "热门",
    badgeType: "hot",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=400&fit=crop",
    tags: [
      {name: "机器视觉", type: "vision"},
      {name: "多模态AI", type: "ai"},
      {name: "视频中台", type: "video"}
    ],
    deployments: 328,
    rating: 4.9
  },
  {
    id: 2,
    title: "智慧路灯管控系统",
    description: "通过物联感知技术实现路灯状态实时监测、故障自动告警、远程调光控制,降低能耗30%,节省维护成本50%。",
    industry: "智慧城市",
    badge: "新上线",
    badgeType: "new",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop",
    tags: [
      {name: "物联网平台", type: "iot"},
      {name: "边缘计算", type: "edge"}
    ],
    deployments: 156,
    rating: 4.8
  },
  {
    id: 3,
    title: "智能设备运维助手",
    description: "基于大语言模型结合设备知识库,提供7×24小时智能问答、故障诊断、维护建议,降低运维门槛,提升响应效率。",
    industry: "智慧工业",
    badge: "推荐",
    badgeType: "popular",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=400&fit=crop",
    tags: [
      {name: "大语言模型", type: "ai"},
      {name: "知识库", type: "ai"},
      {name: "物联网平台", type: "iot"}
    ],
    deployments: 245,
    rating: 4.9
  },
  {
    id: 4,
    title: "消防设施智能监测",
    description: "实时采集消防设施状态数据,结合AI算法分析,实现设施健康度评估、异常预警、维保提醒等功能。",
    industry: "智慧消防",
    badge: null,
    badgeType: null,
    image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&h=400&fit=crop",
    tags: [
      {name: "物联网平台", type: "iot"},
      {name: "AI分析", type: "ai"},
      {name: "边缘计算", type: "edge"}
    ],
    deployments: 89,
    rating: 4.7
  },
  {
    id: 5,
    title: "危化品仓储安全监测",
    description: "整合温湿度、气体浓度、视频监控等多源数据,构建全方位安全防护体系,实现风险预警和应急联动。",
    industry: "智慧化工",
    badge: "热门",
    badgeType: "hot",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop",
    tags: [
      {name: "物联网平台", type: "iot"},
      {name: "视频中台", type: "video"},
      {name: "机器视觉", type: "vision"}
    ],
    deployments: 112,
    rating: 4.8
  },
  {
    id: 6,
    title: "智慧社区人车管理",
    description: "融合人脸识别、车牌识别、物联感知,实现人员车辆智能通行、访客预约、异常告警等社区安全管理功能。",
    industry: "智慧社区",
    badge: null,
    badgeType: null,
    image: "https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=600&h=400&fit=crop",
    tags: [
      {name: "机器视觉", type: "vision"},
      {name: "物联网平台", type: "iot"},
      {name: "边缘计算", type: "edge"}
    ],
    deployments: 76,
    rating: 4.6
  },
  {
    id: 7,
    title: "交通信号自适应控制",
    description: "基于实时车流量数据和AI预测算法,动态调整信号配时方案,提升路口通行效率20%以上。",
    industry: "智慧交通",
    badge: "新上线",
    badgeType: "new",
    image: "https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=600&h=400&fit=crop",
    tags: [
      {name: "AI分析", type: "ai"},
      {name: "物联网平台", type: "iot"},
      {name: "视频中台", type: "video"}
    ],
    deployments: 45,
    rating: 4.7
  },
  {
    id: 8,
    title: "设备预测性维护",
    description: "采集设备振动、温度、电流等运行参数,结合机器学习算法预测故障趋势,实现从被动维修到主动预防的转变。",
    industry: "智慧工业",
    badge: "推荐",
    badgeType: "popular",
    image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&h=400&fit=crop",
    tags: [
      {name: "物联网平台", type: "iot"},
      {name: "机器学习", type: "ai"},
      {name: "边缘计算", type: "edge"}
    ],
    deployments: 198,
    rating: 4.9
  },
  {
    id: 9,
    title: "城市环境质量监测",
    description: "部署空气质量、噪音、扬尘等多类传感器,实现城市环境数据实时采集、可视化展示和智能预警。",
    industry: "智慧城市",
    badge: null,
    badgeType: null,
    image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600&h=400&fit=crop",
    tags: [
      {name: "物联网平台", type: "iot"},
      {name: "AI分析", type: "ai"}
    ],
    deployments: 67,
    rating: 4.5
  }
]

const router = useRouter();
const onClick = () => {
  router.push("/scene/center/detail");
}
</script>

<style scoped lang="less">
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
@shadow-sm: var(--shadow-1);
@shadow-md: var(--shadow-1);
@shadow-lg: var(--shadow-pop);
@shadow-xl: var(--shadow-lifted);
@radius-sm: var(--r-2);
@radius-md: var(--r-3);
@radius-lg: var(--r-3);
@radius-xl: var(--r-3);

.scene-center {

  /* Header */

  .header {
    background: @card-bg;
    border-bottom: 1px solid @border-color;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(0.75rem);
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
    background: linear-gradient(135deg, @primary 0%, @secondary 100%);
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

  .logo-divider {
    width: 0.0625rem;
    height: 1.25rem;
    background: @gray-300;
    margin: 0 0.5rem;
  }

  .logo-subtitle {
    font-size: var(--fs-14);
    color: @text-secondary;
  }

  .header-nav {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .nav-link {
    font-size: var(--fs-14);
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
    gap: var(--space-4);
  }

  .search-box {
    display: flex;
    align-items: center;
    background: @gray-100;
    border: 1px solid @border-color;
    border-radius: @radius-md;
    padding: 0.5rem 1rem;
    gap: var(--space-2);
    width: 17.5rem;
    transition: all 0.2s;
  }

  .search-box:focus-within {
    border-color: @primary;
    box-shadow: 0 0 0 0.1875rem @primary-bg;
  }

  .search-box input {
    border: none;
    background: none;
    outline: none;
    font-size: var(--fs-14);
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
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: linear-gradient(135deg, @primary 0%, @accent 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-ink);
    font-size: var(--fs-14);
    font-weight: 500;
    cursor: pointer;
  }

  /* Main Content */

  .main-content {
    max-width: 90rem;
    margin: 0 auto;
    padding: var(--space-8);
  }

  /* Hero Section */

  .hero {
    background: linear-gradient(135deg, @dark 0%, @dark-secondary 100%);
    border-radius: @radius-xl;
    padding: var(--space-12);
    margin-bottom: var(--space-10);
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
    background: radial-gradient(ellipse at top right, color-mix(in srgb, var(--jet-theme-primary) 15%, transparent) 0%, transparent 70%);
  }

  .hero::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 40%;
    height: 50%;
    background: radial-gradient(ellipse at bottom, color-mix(in srgb, var(--jet-theme-primary-hover) 10%, transparent) 0%, transparent 70%);
  }

  .hero-content {
    position: relative;
    z-index: 1;
    max-width: 37.5rem;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: color-mix(in srgb, var(--jet-theme-primary) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--jet-theme-primary) 30%, transparent);
    color: @primary-light;
    font-size: var(--fs-12);
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border-radius: 1.25rem;
    margin-bottom: var(--space-5);
  }

  .hero-badge::before {
    content: '';
    width: 0.375rem;
    height: 0.375rem;
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
    font-size: var(--fs-36);
    font-weight: 700;
    color: var(--accent-ink);
    margin-bottom: var(--space-4);
    line-height: 1.3;
  }

  .hero p {
    font-size: var(--fs-16);
    color: color-mix(in srgb, var(--accent-ink) 70%, transparent);
    margin-bottom: var(--space-7);
    line-height: 1.8;
  }

  .hero-stats {
    display: flex;
    gap: var(--space-10);
  }

  .hero-stat {
    text-align: left;
  }

  .hero-stat-value {
    font-size: var(--fs-28);
    font-weight: 700;
    color: var(--accent-ink); }

  .hero-stat-label {
    font-size: var(--fs-13);
    color: color-mix(in srgb, var(--accent-ink) 50%, transparent);
    margin-top: var(--space-1);
  }

  /* Filter Section */

  .filter-section {
    margin-bottom: var(--space-8);
  }

  .filter-tabs {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .filter-tab {
    padding: 0.625rem 1.25rem;
    border-radius: @radius-md;
    font-size: var(--fs-14);
    font-weight: 500;
    color: @text-secondary;
    background: @card-bg;
    border: 1px solid @border-color;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .filter-tab:hover {
    border-color: @primary;
    color: @primary;
  }

  .filter-tab.active {
    background: @primary;
    border-color: @primary;
    color: var(--accent-ink);
  }

  .filter-tab .count {
    font-size: var(--fs-12);
    padding: 0.125rem 0.5rem;
    border-radius: 0.625rem;
    background: color-mix(in srgb, var(--code-dark-bg) 10%, transparent);
  }

  .filter-tab.active .count {
    background: color-mix(in srgb, var(--accent-ink) 20%, transparent);
  }

  /* Scene Grid */

  .scene-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(21.25rem, 1fr));
    gap: var(--space-6);
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
    transform: translateY(-0.25rem);
    box-shadow: @shadow-xl;
    border-color: @primary-light;
  }

  .scene-card-cover {
    height: 11.25rem;
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
    background: linear-gradient(to top, color-mix(in srgb, var(--code-dark-bg) 60%, transparent), transparent);
  }

  .scene-card-badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 2;
    padding: 0.25rem 0.625rem;
    border-radius: var(--r-1);
    font-size: var(--fs-12);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03125rem;
  }

  .scene-card-badge.hot {
    background: linear-gradient(135deg, var(--jet-theme-error), color-mix(in srgb, var(--jet-theme-warning) 72%, var(--jet-theme-error)));
    color: var(--accent-ink);
  }

  .scene-card-badge.new {
    background: linear-gradient(135deg, @primary, @secondary);
    color: var(--accent-ink);
  }

  .scene-card-badge.popular {
    background: linear-gradient(135deg, @accent, color-mix(in srgb, var(--jet-theme-primary-active) 35%, var(--jet-theme-bg-container)));
    color: var(--accent-ink);
  }

  .scene-card-industry {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 2;
    padding: 0.25rem 0.625rem;
    border-radius: var(--r-1);
    font-size: var(--fs-12);
    font-weight: 500;
    background: color-mix(in srgb, var(--jet-theme-bg-container) 95%, transparent);
    color: @text-primary;
  }

  .scene-card-content {
    padding: var(--space-5);
  }

  .scene-card-title {
    font-size: var(--fs-17);
    font-weight: 600;
    margin-bottom: var(--space-2);
    color: @text-primary;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .scene-card-desc {
    font-size: var(--fs-13);
    color: @text-secondary;
    line-height: 1.7;
    margin-bottom: var(--space-4);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .scene-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: var(--space-4);
  }

  .scene-tag {
    padding: 0.25rem 0.625rem;
    border-radius: var(--r-1);
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

  .scene-tag.iot {
    background: color-mix(in srgb, var(--jet-theme-primary-hover) 12%, var(--jet-theme-bg-container));
    color: var(--jet-theme-primary-hover);
    border-color: color-mix(in srgb, var(--jet-theme-primary-hover) 28%, var(--jet-theme-bg-container));
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

  .scene-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: var(--space-4);
    border-top: 1px solid @border-color;
  }

  .scene-card-meta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .scene-meta-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--fs-12);
    color: @text-secondary;
  }

  .scene-meta-item svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .scene-card-action {
    padding: 0.5rem 1rem;
    border-radius: @radius-sm;
    font-size: var(--fs-13);
    font-weight: 500;
    background: @primary;
    color: var(--accent-ink);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .scene-card-action:hover {
    background: @primary-dark;
  }

  /* Section Header */

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-6);
  }

  .section-title {
    font-size: var(--fs-20);
    font-weight: 600;
    color: @text-primary;
  }

  .view-all {
    font-size: var(--fs-14);
    color: @primary;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .view-all:hover {
    text-decoration: underline;
  }

  /* Capability Badges */

  .capability-section {
    background: @card-bg;
    border-radius: @radius-lg;
    border: 1px solid @border-color;
    padding: var(--space-6);
    margin-bottom: var(--space-8);
  }

  .capability-title {
    font-size: var(--fs-14);
    font-weight: 500;
    color: @text-secondary;
    margin-bottom: var(--space-4);
  }

  .capability-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-3);
  }

  .capability-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
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
    width: 2.25rem;
    height: 2.25rem;
    border-radius: @radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-18);
  }

  .capability-icon.iot {
    background: linear-gradient(135deg, color-mix(in srgb, var(--jet-theme-primary-hover) 12%, var(--jet-theme-bg-container)), color-mix(in srgb, var(--jet-theme-primary-hover) 34%, var(--jet-theme-bg-container)));
  }

  .capability-icon.visual {
    background: linear-gradient(135deg, var(--warn-bg), color-mix(in srgb, var(--jet-theme-warning) 32%, var(--jet-theme-bg-container)));
  }

  .capability-icon.video {
    background: linear-gradient(135deg, var(--jet-theme-primary-soft), color-mix(in srgb, var(--jet-theme-primary) 28%, var(--jet-theme-bg-container)));
  }

  .capability-icon.edge {
    background: linear-gradient(135deg, var(--ok-bg), color-mix(in srgb, var(--jet-theme-success) 32%, var(--jet-theme-bg-container)));
  }

  .capability-icon.ai {
    background: linear-gradient(135deg, var(--err-bg), color-mix(in srgb, var(--jet-theme-error) 28%, var(--jet-theme-bg-container)));
  }

  .capability-icon.agent {
    background: linear-gradient(135deg, color-mix(in srgb, var(--jet-theme-primary-active) 8%, var(--jet-theme-bg-container)), color-mix(in srgb, var(--jet-theme-primary-active) 28%, var(--jet-theme-bg-container)));
  }

  .capability-info {
    flex: 1;
  }

  .capability-name {
    font-size: var(--fs-14);
    font-weight: 500;
    color: @text-primary;
  }

  .capability-count {
    font-size: var(--fs-12);
    color: @text-secondary;
  }

  /* Footer */

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
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: var(--accent-ink);
  }

  /* Responsive */
  @media (max-width: 48rem) {
    .header-inner {
      padding: 0 1rem;
    }

    .header-nav {
      display: none;
    }

    .search-box {
      width: 12.5rem;
    }

    .main-content {
      padding: var(--space-4);
    }

    .hero {
      padding: 2rem 1.5rem;
    }

    .hero h1 {
      font-size: var(--fs-28);
    }

    .hero-stats {
      gap: var(--space-6);
    }

    .scene-grid {
      grid-template-columns: 1fr;
    }

    .filter-tabs {
      overflow-x: auto;
      padding-bottom: var(--space-2);
    }
  }

  /* Animations */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(1.25rem);
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
}</style>
