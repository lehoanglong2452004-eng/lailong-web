import json, sys, urllib.request, gzip, time
out = sys.argv[1]
def get(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"}), timeout=30)
    b = r.read()
    if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
    return b
res = {}
for s in ["_SPX", "QQQ", "GLD", "SPY", "_NDX", "IWM", "SLV", "USO", "TLT"]:
    t = time.time()
    try:
        b = get(f"https://cdn.cboe.com/api/global/delayed_quotes/options/{s}.json")
        d = json.loads(b)
        data = d.get("data", {})
        opts = data.get("options", [])
        res[s] = {"bytes": len(b), "sec": round(time.time()-t,1), "top": list(d.keys()), "keys": [k for k in data.keys() if k != "options"],
                  "meta": {k: data[k] for k in data if k != "options"}, "n": len(opts), "first": opts[:2], "ts": d.get("timestamp")}
    except Exception as e:
        res[s] = {"err": str(e)}
for c in ["BTC", "ETH"]:
    try:
        b = get(f"https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency={c}&kind=option")
        d = json.loads(b)["result"]; res["deribit_"+c] = {"n": len(d), "first": d[:2], "bytes": len(b)}
    except Exception as e:
        res["deribit_"+c] = {"err": str(e)}
json.dump(res, open(out + "/markets.json", "w"), indent=1, default=str)
print("ok")
