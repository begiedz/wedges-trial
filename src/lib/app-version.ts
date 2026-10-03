export const appVersion =
  process.env.NODE_ENV === 'development'
    ? 'DEV'
    : `v${process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'}`;
