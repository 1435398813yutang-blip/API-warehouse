const CACHE_NAME = 'api-warehouse-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json'
];

// 安装 Service Worker，缓存基础静态资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求，策略：网络优先，断网时使用缓存
self.addEventListener('fetch', (e) => {
  // 如果是请求接口数据（包括 registry.json 或者代理请求），不缓存，直接走网络
  if (e.request.url.includes('registry.json') || e.request.url.includes('?target=')) {
    return; 
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // 如果网络请求成功，克隆一份放进缓存（只缓存自己域名下的资源）
        if (response.ok && e.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败（断网），从缓存里拿
        return caches.match(e.request);
      })
  );
});
