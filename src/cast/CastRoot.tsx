import React from 'react';
import { ThemeProvider } from '@castui/cast-ui';
import './sheet';
import { varScheme } from './theme';

/**
 * Every island renders inside this. The scheme's colours are CSS variables (see theme.ts), so colorMode only picks the
 * shape of the defaults Cast fills in; the light/dark switch itself happens in CSS.
 */
export default function CastRoot({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider colorMode="dark" scheme={varScheme}>
      {children}
    </ThemeProvider>
  );
}
