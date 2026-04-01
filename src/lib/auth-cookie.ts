const ACCESS_TOKEN_COOKIE = 'access_token';
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

export function setFrontendAuthCookie(token: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const securePart = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie =
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${SEVEN_DAYS_IN_SECONDS}; samesite=lax${securePart}`;
}

export function clearFrontendAuthCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function getFrontendAuthToken() {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.split('=').slice(1).join('='));
}
