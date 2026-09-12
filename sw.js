// 서비스 워커: HTML과 핵심 파일을 항상 네트워크에서 새로 가져오게 강제
// (사파리가 index.html을 캐시해서 새로고침해도 옛 버전 뜨는 문제 해결)
self.addEventListener('install', function(e){
  self.skipWaiting();  // 새 SW 즉시 활성화
});
self.addEventListener('message', function(e){
  if(e.data === 'skip') self.skipWaiting();
});
self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());  // 열려 있는 모든 탭을 즉시 제어
});
self.addEventListener('fetch', function(e){
  var url = e.request.url;
  // HTML 문서와 ver.json은 항상 네트워크 우선 (캐시 무시)
  if(e.request.mode === 'navigate' || url.indexOf('.html') >= 0 || url.indexOf('ver.json') >= 0){
    e.respondWith(
      fetch(e.request, {cache:'no-store'}).catch(function(){
        return caches.match(e.request);  // 오프라인이면 캐시 fallback
      })
    );
    return;
  }
  // 나머지(데이터 JSON 등)는 기본 동작
});
