/* DOM、Chrome API与数据校验分离，便于独立验证。 */
(function (scope) {
  'use strict';
  const IMAGE_HOSTS = ['alicdn.com','taobao.com','tmall.com','jd.com','360buyimg.com','pddpic.com','pinduoduo.com','yangkeduo.com'];
  const SHOP_HOSTS = ['taobao.com','tmall.com','jd.com','pinduoduo.com','yangkeduo.com'];
  const MAX_IMAGES = 500, MAX_BYTES = 12 * 1024 * 1024, MAX_PIXELS = 32000000;
  function under(host, domain) { return host === domain || host.endsWith('.' + domain); }
  function parsed(value, base) { try { return new URL(String(value).trim().replace(/&amp;/g,'&'), base); } catch { return null; } }
  function normalizeURL(value, base) {
    const url = parsed(value, base);
    if (!url || url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  }
  function shopURL(value) {
    const url = parsed(value);
    return !!url && url.protocol === 'https:' && !url.username && !url.password && SHOP_HOSTS.some(d => under(url.hostname,d));
  }
  function productURL(value) {
    const url = parsed(value);
    if (!url || !shopURL(value)) return false;
    if (under(url.hostname,'taobao.com') || under(url.hostname,'tmall.com')) return /item\.htm/i.test(url.pathname) && /^\d+$/.test(url.searchParams.get('id') || '');
    if (under(url.hostname,'jd.com')) return /^\/(?:product\/)?\d+\.html$/i.test(url.pathname);
    return /(?:goods|product|detail)/i.test(url.pathname) && (/\d/.test(url.pathname) || ['goods_id','goodsId','id'].some(k => /^\d+$/.test(url.searchParams.get(k)||'')));
  }
  function allowedImageURL(value) {
    const url = parsed(value);
    return !!url && url.protocol === 'https:' && !url.username && !url.password && IMAGE_HOSTS.some(d => under(url.hostname,d));
  }
  function originPattern(value) { const url=parsed(value); return allowedImageURL(value) ? url.origin + '/*' : null; }
  function srcsetURLs(value) { return String(value||'').split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean); }
  function backgroundURLs(value) { const result=[]; const re=/url\(\s*(['"]?)(.*?)\1\s*\)/gi; let match; while((match=re.exec(String(value||''))))result.push(match[2]); return result; }
  function sizeOK(width,height,min=100) { return Number.isFinite(width) && Number.isFinite(height) && width>=min && height>=min && width*height<=MAX_PIXELS && width<=16384 && height<=16384; }
  function mergeCandidates(items, base) {
    const map=new Map();
    for (const item of items) {
      const url=normalizeURL(item.url,base);
      if(!url)continue;
      const width=Number(item.width)||0, height=Number(item.height)||0;
      if(width<0 || height<0 || width>16384 || height>16384 || width*height>MAX_PIXELS)continue;
      if(width>0 && height>0 && !sizeOK(width,height))continue;
      if(/(?:favicon|logo|avatar|qrcode|spacer|transparent|loading|placeholder)(?:[_.\/-]|$)/i.test(new URL(url).pathname))continue;
      const prior=map.get(url);
      if(!prior || width*height>prior.width*prior.height)map.set(url,{url,width,height,source:String(item.source||'图片').slice(0,40)});
      if(map.size>=MAX_IMAGES)break;
    }
    return [...map.values()];
  }
  function filename(index) { if(!Number.isInteger(index)||index<1||index>MAX_IMAGES)throw new Error('图片序号无效'); return 'ImageGrab/商品图_'+String(index).padStart(3,'0')+'.png'; }
  function isPNG(bytes) { return bytes && bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v); }
  scope.ImageGrabCore=Object.freeze({IMAGE_HOSTS,MAX_IMAGES,MAX_BYTES,MAX_PIXELS,normalizeURL,shopURL,productURL,allowedImageURL,originPattern,srcsetURLs,backgroundURLs,sizeOK,mergeCandidates,filename,isPNG});
})(globalThis);
