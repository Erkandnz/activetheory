import { useEffect } from 'react';

const ACTIVE_THEORY_CONFIG = {
  cacheKey: '1746999829739', // 原站构建缓存号，用于定位完全一致的 JS bundle。
  appScriptPath: '/assets/js/app.1746999829739.js', // 原站核心 WebGL 与页面动效入口。
  preloadLinkId: 'active-theory-app-preload', // 预加载标签 ID，避免 React 热更新重复创建。
  appScriptId: 'active-theory-app-script', // 主脚本标签 ID，避免重复执行原站 bundle。
  analyticsScriptId: 'active-theory-analytics-script', // 统计脚本标签 ID，保持原站加载顺序。
  analyticsScriptPath: '/vendor/www.googletagmanager.com/gtag/js_id=G-J7TMDT4F8N', // 本地化后的 Google Tag 脚本路径。
  analyticsId: 'G-J7TMDT4F8N', // 原站统计 ID，仅用于复刻原始运行环境。
  unsupportedPage: '/unsupported.html', // 原站低版本浏览器兜底页。
  uilStaticPath: '/assets/data/uil.1746999829739.json', // 原站静态 UI 数据文件。
} as const;

declare global {
  interface Window {
    _ENV_: 'production';
    _CMS_: string;
    _CACHE_: string;
    _UNSUPPORTED_PAGE_: string;
    UIL_STATIC_PATH: string;
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function ensurePreloadLink(id: string, href: string): void {
  if (document.getElementById(id)) {
    return;
  }

  const preloadLink = document.createElement('link');
  preloadLink.id = id;
  preloadLink.href = href;
  preloadLink.rel = 'preload';
  preloadLink.as = 'script';
  document.head.appendChild(preloadLink);
}

function ensureScript(id: string, src: string, async = true): void {
  if (document.getElementById(id)) {
    return;
  }

  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  script.async = async;
  document.head.appendChild(script);
}

function configureOriginalRuntime(): void {
  window._ENV_ = 'production';
  window._CMS_ = '%CMS%';
  window._CACHE_ = ACTIVE_THEORY_CONFIG.cacheKey;
  window._UNSUPPORTED_PAGE_ = ACTIVE_THEORY_CONFIG.unsupportedPage;
  window.UIL_STATIC_PATH = ACTIVE_THEORY_CONFIG.uilStaticPath;
}

function configureAnalytics(): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', ACTIVE_THEORY_CONFIG.analyticsId);
}

export default function App() {
  useEffect(() => {
    configureOriginalRuntime();
    configureAnalytics();
    ensurePreloadLink(ACTIVE_THEORY_CONFIG.preloadLinkId, ACTIVE_THEORY_CONFIG.appScriptPath);
    ensureScript(ACTIVE_THEORY_CONFIG.appScriptId, ACTIVE_THEORY_CONFIG.appScriptPath);
    ensureScript(ACTIVE_THEORY_CONFIG.analyticsScriptId, ACTIVE_THEORY_CONFIG.analyticsScriptPath);
  }, []);

  return null;
}
