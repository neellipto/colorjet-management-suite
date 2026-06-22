let _baseUrl = '';

export function setBaseUrl(url: string) {
  _baseUrl = url;
}

export function getBaseUrl(): string {
  return _baseUrl;
}
