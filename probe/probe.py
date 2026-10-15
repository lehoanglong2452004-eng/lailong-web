import json, urllib.request, time
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept": "*/*"}
U = {
 "yahoo_cl": "https://query1.finance.yahoo.com/v8/finance/chart/CLZ26.NYM?range=5d&interval=1d",
 "yahoo_cl_front": "https://query1.finance.yahoo.com/v8/finance/chart/CL=F?range=5d&interval=1d",
 "yahoo_dxy5m": "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=5d&interval=5m",
 "yahoo_quote": "https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F,CL=F",
 "yahoo_spark": "https://query1.finance.yahoo.com/v7/finance/spark?symbols=GC=F,CL=F,SI=F&range=1d&interval=1d",
 "bis_cbpol": "https://stats.bis.org/api/v1/data/WS_CBPOL/D.US+XM+GB+JP+CA+AU+CH+NZ+CN+SE/all?lastNObservations=1&format=csv",
 "cg_treasury_btc": "https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin",
 "cg_treasury_eth": "https://api.coingecko.com/api/v3/companies/public_treasury/ethereum",
 "cg_markets": "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=10",
 "cnbc_econ": "https://www.cnbc.com/id/20910258/device/rss/rss.html",
 "cnbc_world": "https://www.cnbc.com/id/100727362/device/rss/rss.html",
 "oilprice": "https://oilprice.com/rss/main",
 "kitco": "https://www.kitco.com/rss/news.xml",
 "mining_com": "https://www.mining.com/feed/",
 "forexlive": "https://www.forexlive.com/feed/news",
 "fxstreet": "https://www.fxstreet.com/rss/news",
 "bbc_world": "https://feeds.bbci.co.uk/news/world/rss.xml",
 "aljazeera": "https://www.aljazeera.com/xml/rss/all.xml",
 "marketwatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
 "investing_commod": "https://www.investing.com/rss/news_11.rss",
 "investing_econ": "https://www.investing.com/rss/news_14.rss",
 "fed_press": "https://www.federalreserve.gov/feeds/press_all.xml",
 "ecb_press": "https://www.ecb.europa.eu/rss/press.html",
 "hl_info": "https://api.hyperliquid.xyz/info",
 "hl_leader": "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard",
 "stooq": "https://stooq.com/q/l/?s=cl.f,gc.f&f=sd2t2ohlcv&h&e=csv",
 "cme_vol": "https://www.cmegroup.com/CmeWS/mvc/Volume/Details/F/425/20261014/P?tradeDate=20261014",
 "farside": "https://farside.co.uk/btc/",
 "frankfurter": "https://api.frankfurter.app/latest",
 "fred_csv": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF",
 "tradingeconomics_rss": "https://tradingeconomics.com/rss/news.aspx",
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
            out[k] = {"code": r.status, "len": len(b), "ms": int((time.time()-t)*1000), "head": b[:600].decode("utf-8", "replace"), "cors": r.headers.get("Access-Control-Allow-Origin")}
    except Exception as e:
        out[k] = {"err": str(e)[:200]}
json.dump(out, open("probe/result.json", "w"), indent=1, ensure_ascii=False)
