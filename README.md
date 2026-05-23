# Active Theory React Replica

这是一个使用 Vite + React 承载的 Active Theory 页面复刻项目，复刻来源为 [activetheory.net](https://activetheory.net/)。

本项目仅用于前端复刻学习与本地展示。如涉及版权、品牌、素材或其他权益问题，请联系项目维护者，收到通知后将及时删除相关内容。

## 运行环境

- Node.js 24+
- npm 11+

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev -- --port 5173
```

启动后访问：

```text
http://127.0.0.1:5173/
```

## 生产构建

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

## 本地预览构建产物

```bash
npm run preview -- --port 4173
```

## 项目结构

```text
public/
  assets/          原站静态资源，包含模型、纹理、字体、音视频和脚本
  vendor/          原站外部依赖的本地化副本
src/
  App.tsx          配置并加载原站运行时脚本
  activeTheory.css 原站基础样式适配
  main.tsx         React 应用入口
```

## 实现说明

项目采用 React 作为承载外壳，核心 3D、WebGL、动画与页面逻辑仍由原站打包脚本 `public/assets/js/app.1746999829739.js` 驱动。这样可以最大程度保持画面、动效、资源路径和运行时表现与原站一致。
