// Next.js 只为 CSS Modules（`*.module.css`）提供类型声明，普通样式表
// `import './globals.css'` 在 TS 5.6+ 的 `noUncheckedSideEffectImports`
// 检查下会报 TS2882。这里补上普通样式表的副作用导入声明。
declare module '*.css';
