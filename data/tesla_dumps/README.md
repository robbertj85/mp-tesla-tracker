# Tesla.com inventory dumps

Tesla's used-inventory API sits behind Akamai Bot Manager, which blocks every
automated browser we tried (data-center *and* residential IPs, headless and
headed). So the reliable way to feed Tesla.com occasions into the tracker is to
copy the inventory JSON from your own browser and drop it here.

## How to save a dump (per model)

1. Open the inventory page in your normal browser (you can solve any check):
   - Model Y → <https://www.tesla.com/nl_NL/inventory/used/my?arrangeby=plh&zip=3012&range=0>
   - Model 3 → `.../used/m3?...`
   - Model S → `.../used/ms?...`
2. Open **DevTools → Network**, filter on `inventory-results`, and reload.
3. Click the `inventory-results` request → **Response** → copy the whole JSON.
   - To get *all* cars (not just the first ~50), scroll/next through the pages
     and copy each response. You can paste them into one file as a **JSON array
     of responses** `[ {…}, {…} ]` — the parser flattens that automatically.
4. Save it here as the model slug:
   - `my.json`, `m3.json`, `ms.json`

The file may be a full API payload (`{"results": […]}`), a bare results array
(`[…]`), or a list of either — all are accepted.

## Easier: the bookmarklet (recommended)

Instead of copying responses by hand, make a browser bookmark whose **URL** is
the one-liner below. Open any used-inventory page (my / m3 / ms) and click the
bookmark — it fetches *all* pages in your real session (where Akamai lets it
through) and downloads `<slug>.json` straight into your Downloads. Move that
file here.

```
javascript:(async()=>{const m=location.pathname.match(/inventory\/used\/(\w+)/);if(!m){alert('Open a /inventory/used/<model> page first');return;}const slug=m[1];const q=o=>'https://www.tesla.com/inventory/api/v4/inventory-results?query='+encodeURIComponent(JSON.stringify({query:{model:slug,condition:'used',options:{},arrangeby:'Price',order:'asc',market:'NL',language:'nl',super_region:'north america',lng:4.4813,lat:51.9235,zip:'3012',range:0,region:'NL'},offset:o,count:50,outsideOffset:0,outsideSearch:false}));let all=[],off=0;for(;;){const r=await fetch(q(off),{headers:{accept:'application/json'}});if(!r.ok){alert('HTTP '+r.status+' — reload the page and retry');break;}const j=await r.json();const res=Array.isArray(j.results)?j.results:((j.results&&j.results.exact)||[]);all.push(...res);const tot=parseInt(j.total_matches_found||0,10);off+=50;if(res.length<50||(tot&&off>=tot))break;}const b=new Blob([JSON.stringify(all)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=slug+'.json';document.body.appendChild(a);a.click();a.remove();alert('Saved '+all.length+' '+slug+' cars to '+slug+'.json');})();
```

The alert shows `Saved N cars`. Compare N with the count the page shows — if the
page lists more, reload it and click the bookmark again (Akamai sometimes serves a
short first page), or use the capture bookmarklet below.

### If the fetch bookmarklet returns HTTP 403/404

Akamai soft-blocks repeated direct calls from one session. Use this **capture**
bookmarklet instead — it never calls the API itself; it records the responses the
inventory page already makes (which always succeed). Click it once to arm, then
scroll/▸ through **all** result pages so every car loads, then click it **again**
to download `<slug>.json`.

```
javascript:(()=>{const slug=(location.pathname.match(/used\/(\w+)/)||[])[1]||'tesla';const dl=()=>{const all=[...window.__teslaCap.values()];const b=new Blob([JSON.stringify(all)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=slug+'.json';document.body.appendChild(a);a.click();a.remove();alert('Downloaded '+all.length+' captured '+slug+' cars to '+slug+'.json');};if(window.__teslaCap){dl();return;}window.__teslaCap=new Map();const grab=t=>{try{const j=JSON.parse(t);const arr=Array.isArray(j.results)?j.results:[...((j.results&&j.results.exact)||[]),...((j.results&&j.results.approximate)||[])];for(const c of arr){const v=c.VIN||c.Vin;if(v)window.__teslaCap.set(v,c);}}catch(e){}};const of=window.fetch;window.fetch=async(...a)=>{const r=await of(...a);try{const u=(a[0]&&a[0].url)||a[0];if(typeof u==='string'&&u.includes('inventory-results'))r.clone().text().then(grab);}catch(e){}return r;};const ox=XMLHttpRequest.prototype.open,os=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return ox.apply(this,arguments);};XMLHttpRequest.prototype.send=function(){try{this.addEventListener('load',()=>{if(String(this.__u).includes('inventory-results'))grab(this.responseText);});}catch(e){}return os.apply(this,arguments);};alert('Capture armed for '+slug+'. Now scroll the list and click through ALL result pages so every car loads, then click this bookmark AGAIN to download.');})();
```

## Validate a save

```
cd scraper && source .venv/bin/activate
python -m mp_tesla.tesla_inventory --model my --check-file ../data/tesla_dumps/my.json
```

It prints how many cars parsed and a sample (price/year/km/drivetrain/url). If a
field looks wrong, send that sample over and the parser mapping can be tuned.

## Then run the scraper

```
python -m mp_tesla.run --brand tesla       # ingests my.json + m3.json
python -m mp_tesla.run --brand model-s      # ingests ms.json
```

Dumps in this folder are used in preference to the (blocked) live fetch. Refresh
them whenever you want updated Tesla.com prices; the daily GitHub Actions run has
no dumps, so it simply skips Tesla and keeps scraping Marktplaats as before.
