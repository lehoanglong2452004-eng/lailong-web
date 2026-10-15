import json, urllib.request, time
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept": "*/*"}
U = {
 "cboe_qqq": "https://cdn.cboe.com/api/global/delayed_quotes/options/QQQ.json",
 "cboe_spx": "https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json",
 "cboe_gld": "https://cdn.cboe.com/api/global/delayed_quotes/options/GLD.json",
 "yahoo_tnx": "https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?range=60d&interval=5m",
 "yahoo_btc1h": "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=730d&interval=1h",
 "farside_eth": "https://farside.co.uk/eth/",
 "fred_dff": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF&cosd=2026-09-01",
}
out = {}
for k, u in U.items():
    t = time.time()
    try:
        data = None
        if k == "hl_info":
            data = json.dumps({"type": "metaAndAssetCtxs"}).encode()
        req = urllib.request.Request(u, data=data, headers={**H, **({"Content-Type": "application/json"} if data else {})})
        with urllib.request.urlopen(req, timeout=20) as r:
            b = r.read()
            out[k] = {"code": r.status, "len": len(b), "ms": int((time.time()-t)*1000), "head": b[:400].decode("utf-8", "replace"), "cors": r.headers.get("Access-Control-Allow-Origin")}
    except Exception as e:
        out[k] = {"err": str(e)[:200]}
json.dump(out, open("probe/result.json", "w"), indent=1, ensure_ascii=False)
