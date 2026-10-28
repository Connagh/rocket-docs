import { defineMiddleware } from 'astro:middleware';

// react-native-web writes its atomic CSS into a stylesheet as components render. Islands render on the server at build
// time, so collect that sheet once the page is done and put it in <head>; the browser then reuses it on hydration
// instead of flashing unstyled controls.
export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  const html = await res.text();
  const sheet = (globalThis as { __castSheet?: { getSheet(): { id: string; textContent: string } } }).__castSheet;
  if (!sheet) return new Response(html, res);
  const { id, textContent } = sheet.getSheet();
  const tag = `<style id="${id}">${textContent}</style>`;
  return new Response(html.replace('</head>', `${tag}</head>`), res);
});
