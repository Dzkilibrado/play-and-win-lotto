import asyncio, json, os
from playwright.async_api import async_playwright

ROUTES = ["/login","/dashboard","/generate","/games","/games/importar","/results","/contests","/pools","/pools/new","/notifications","/profile","/settings","/admin","/statistics","/lotteries","/"]
VPS = [(320,568),(360,800),(390,844),(768,1024),(1280,720),(1440,900)]

async def main():
    out=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for w,h in VPS:
            ctx = await b.new_context(viewport={"width":w,"height":h})
            cj=os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
            if cj: await ctx.add_cookies([{**c,"url":"http://localhost:8080"} for c in json.loads(cj)])
            page = await ctx.new_page()
            await page.goto("http://localhost:8080", wait_until="domcontentloaded")
            k=os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"); s=os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
            if k and s: await page.evaluate(f"localStorage.setItem({json.dumps(k)}, {json.dumps(s)})")
            for r in ROUTES:
                try:
                    await page.goto("http://localhost:8080"+r, wait_until="domcontentloaded")
                    await page.wait_for_timeout(1200)
                    res = await page.evaluate("""() => {
                      const d=document.documentElement;
                      const over=[];
                      if (d.scrollWidth>d.clientWidth) {
                        for (const el of document.querySelectorAll('body *')) {
                          const rc=el.getBoundingClientRect();
                          if (rc.right> d.clientWidth+1 || rc.left < -1) over.push((el.tagName+'.'+(el.className&&el.className.baseVal!==undefined?el.className.baseVal:String(el.className||''))).slice(0,140)+' r='+Math.round(rc.right));
                        }
                      }
                      return {sw:d.scrollWidth, cw:d.clientWidth, over:over.slice(0,6)};
                    }""")
                    out.append({"vp":f"{w}x{h}","route":r,**res})
                except Exception as e:
                    out.append({"vp":f"{w}x{h}","route":r,"err":str(e)[:100]})
            await ctx.close()
        await b.close()
    bad=[o for o in out if o.get("sw",0)>o.get("cw",1)]
    print("TOTAL",len(out),"BAD",len(bad))
    for o in bad: print(json.dumps(o))
asyncio.run(main())
