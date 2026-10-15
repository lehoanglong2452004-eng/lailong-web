// Lai Long Web: cảnh báo bằng tiếng và thông báo trình duyệt.
// Loại cảnh báo: nghi iceberg, tường bị rút khi giá tới gần, Big Trade, giá chạm mức đã đặt.
// Cài đặt và các mức giá được lưu trên máy này (sessionStorage). Mỗi loại kêu tối đa một lần mỗi 5 giây.

const KEY = "lailong.alerts";
const DEF = { ice: true, spoof: true, big: false, newsEv: true, newsHot: false, sound: true, notify: false, levels: [] };
const TONES = { up: [880, 1175], down: [523, 392], ice: [988, 988], price: [1319, 1047, 1319] };

export class Alerts {
  constructor(show) {
    this.show = show; this.last = {}; this.hist = [];
    try { this.cfg = { ...DEF, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; } catch { this.cfg = { ...DEF }; }
    if (!Array.isArray(this.cfg.levels)) this.cfg.levels = [];
  }
  save() { try { sessionStorage.setItem(KEY, JSON.stringify(this.cfg)); } catch { /* chế độ riêng tư */ } }

  fire(kind, text, tone = "price", force = false) {
    const now = Date.now();
    if (!force && now - (this.last[kind] || 0) < 5000) return false;
    this.last[kind] = now;
    this.hist.unshift({ t: now, text }); if (this.hist.length > 20) this.hist.pop();
    this.show(text);
    if (this.cfg.sound) this.beep(tone);
    if (this.cfg.notify && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      try { new Notification("Lai Long Quant", { body: text, tag: kind, icon: "icons/icon-192.png" }); } catch { /* trình duyệt không hỗ trợ */ }
    }
    if (this.onFire) this.onFire();
    return true;
  }

  beep(tone) {
    try {
      const ac = this.ac || (this.ac = new (window.AudioContext || window.webkitAudioContext)());
      if (ac.state === "suspended") ac.resume();
      (TONES[tone] || TONES.price).forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.13;
        o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.start(t); o.stop(t + 0.13);
      });
    } catch { /* không có âm thanh */ }
  }

  addLevel(sym, price) { if (!(price > 0)) return; this.cfg.levels.push({ sym, price }); this.save(); }
  removeLevel(i) { this.cfg.levels.splice(i, 1); this.save(); }
  levelsOf(sym) { return this.cfg.levels.map((l, i) => ({ ...l, i })).filter(l => l.sym === sym); }

  // giá đi từ prev sang cur: mức nào bị đi qua thì kêu một lần rồi xoá
  checkPrice(sym, prev, cur, dec) {
    if (prev == null || cur == null || prev === cur) return;
    const lo = Math.min(prev, cur), hi = Math.max(prev, cur);
    for (let i = this.cfg.levels.length - 1; i >= 0; i--) {
      const l = this.cfg.levels[i];
      if (l.sym !== sym || l.price < lo || l.price > hi) continue;
      this.cfg.levels.splice(i, 1); this.save();
      this.fire("price" + i, `${sym} chạm ${l.price.toFixed(dec)} (giá ${cur > prev ? "đi lên" : "đi xuống"})`, "price", true);
    }
  }
}
