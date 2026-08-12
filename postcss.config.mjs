/**
 * PostCSS 配置 —— 启用 @tailwindcss/postcss 插件，让 Tailwind 4 在 Next.js 构建里跑。
 * 改 plugins 必过 `pnpm build`（确保 CSS 能编译）。
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
