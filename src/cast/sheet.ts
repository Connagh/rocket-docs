import { StyleSheet } from 'react-native';

// react-native-web collects component CSS in one stylesheet as islands render. Expose it on the server so
// src/middleware.ts can inline it into each built page.
if (import.meta.env.SSR) (globalThis as { __castSheet?: unknown }).__castSheet = StyleSheet;
