// iPhone/iPad: stop Safari from zooming in when a text field is focused (pinch-zoom still works on iOS).
// Lives in its own file so index.html needs no inline script and can carry a strict Content-Security-Policy.
if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.querySelector('meta[name=viewport]').content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
}
